"""Pipeline de geracao: RAG -> LLM -> validacao -> retorno estruturado."""
from __future__ import annotations

import re
from datetime import date

from .llm import LLMError, chat
from .prompts import build_messages, build_retry_message
from .schemas import (
    AulaOutput,
    CurriculumHit,
    GenerateRequest,
    GenerateResponse,
)
from .search import get_by_codigo, search_curriculum

# Faixa de palavras por aula varia conforme o modo. Modos com saida estruturada
# (lista de exercicios, projeto) tem validacao de palavras mais permissiva
# porque o corpo nao e um paragrafo unico.
WORD_RANGE_POR_MODO: dict[str, tuple[int, int]] = {
    "plano_de_aula": (40, 60),
    "sugestao_de_aula": (500, 900),
    "recomposicao_paralela": (50, 90),
    "adaptacao_educacao_especial": (55, 110),
    # Sem limite forte: o formato e estruturado, contagem nao se aplica
    "lista_de_exercicios": (50, 600),
    "projetos_e_trabalhos": (50, 200),
}

# captura "Aula X - CODIGO - DD/MM" com varias variacoes de tracos
# (en-dash, em-dash, hifen, com/sem espacos)
HEADER_RX = re.compile(
    r"Aula\s*(\d+)\s*[\-–—]\s*([A-Z0-9\.]+)\s*[\-–—]\s*(\d{1,2}/\d{1,2})",
    re.IGNORECASE,
)


def count_words(text: str) -> int:
    return len([w for w in re.findall(r"\b[\wÀ-ÿ]+\b", text)])


def parse_llm_output(
    text: str, requested_aulas_count: int, modo: str = "plano_de_aula"
) -> tuple[list[AulaOutput], list[str]]:
    """Faz parse do output do LLM em AulaOutput.

    Retorna (aulas, problemas). Se problemas != [], deve-se considerar retry.
    A faixa de palavras valida varia conforme o modo.

    Caso especial: 'projetos_e_trabalhos' nao segue formato 'Aula X – COD – DD/MM'.
    Gera UM documento estruturado retornado como 1 AulaOutput.
    """
    problemas: list[str] = []
    aulas: list[AulaOutput] = []

    # Modo projeto: o LLM gera um documento unico (sem cabecalhos de aula).
    # Retornamos uma AulaOutput soh com numero=1 e o texto inteiro.
    if modo == "projetos_e_trabalhos":
        corpo = text.strip()
        words = count_words(corpo)
        if words < 200:
            problemas.append(f"Projeto curto demais ({words} palavras, esperado >= 200)")
        return [
            AulaOutput(
                numero=1,
                codigo_bncc=None,
                data=date.today(),
                texto=corpo,
                palavras=words,
            )
        ], problemas

    min_w, max_w = WORD_RANGE_POR_MODO.get(modo, (40, 60))

    # encontra todos os cabecalhos
    matches = list(HEADER_RX.finditer(text))
    if not matches:
        problemas.append("Nenhum cabecalho 'Aula X - CODIGO - DD/MM' detectado")
        return [], problemas

    if len(matches) != requested_aulas_count:
        problemas.append(
            f"Numero de aulas geradas ({len(matches)}) difere do solicitado ({requested_aulas_count})"
        )

    for i, m in enumerate(matches):
        numero = int(m.group(1))
        codigo = m.group(2).strip(".")
        data_str = m.group(3)

        # bloco vai do fim deste header ate o inicio do proximo
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        bloco = text[start:end].strip()

        words = count_words(bloco)
        if words < min_w:
            problemas.append(f"Aula {numero} tem {words} palavras (minimo {min_w})")
        elif words > max_w:
            problemas.append(f"Aula {numero} tem {words} palavras (maximo {max_w})")

        # parse de data DD/MM (assume ano corrente)
        try:
            dia, mes = data_str.split("/")
            data_parsed = date(date.today().year, int(mes), int(dia))
        except ValueError:
            problemas.append(f"Data invalida na Aula {numero}: {data_str}")
            data_parsed = date.today()

        aulas.append(AulaOutput(
            numero=numero,
            codigo_bncc=codigo,
            data=data_parsed,
            texto=bloco,
            palavras=words,
        ))

    return aulas, problemas


async def gerar(req: GenerateRequest) -> GenerateResponse:
    from . import cache as cache_mod

    # 0. Cache. Sempre computamos o hash quando o modo e cacheavel — assim,
    # mesmo se o professor clicou "Regerar" (que ignora o lookup), o resultado
    # novo eh salvo no cache e substitui o anterior pra proximas requests.
    cached_hash = ""
    if cache_mod.cache_pode_usar(req.modo):
        if not req.force_regenerate:
            cached, cached_hash = cache_mod.cache_lookup_exato(req)
            if cached:
                cache_mod.metric_exato_hit()
                cached.fonte = "cache_exato"
                return cached
            # tenta semantico se modo permite
            cached_sem = cache_mod.cache_lookup_semantico(req)
            if cached_sem:
                cache_mod.metric_semantico_hit()
                cached_sem.fonte = "cache_semantico"
                return cached_sem
            cache_mod.metric_miss()
        else:
            # Force regenerate: pula o lookup mas garante o hash pra salvar depois
            cached_hash = cache_mod.hash_request(req)
    else:
        cache_mod.metric_skip()

    # 1. RAG: monta o contexto curricular
    query = req.tema + (f" {req.foco_especifico}" if req.foco_especifico else "")

    hits: list[CurriculumHit] = []
    codigos_solicitados = req.codigos_efetivos()

    if codigos_solicitados:
        # Professor selecionou habilidades explicitamente.
        # Usa APENAS essas, sem enriquecimento por busca semantica.
        for cod in codigos_solicitados:
            item = get_by_codigo(cod)
            if item and item.codigo not in {x.codigo for x in hits}:
                hits.append(item)
    else:
        # Sem habilidades selecionadas: busca semantica por tema/foco
        hits = search_curriculum(
            query, top_k=5, etapa=req.etapa, disciplina=req.disciplina
        )

    if not hits:
        # ultimo fallback: nem com habilidades nem com busca filtrada,
        # tenta semantica sem filtros
        hits = search_curriculum(query, top_k=5)

    # 2. LLM: gera planejamento
    messages = build_messages(req, hits)
    # max_tokens generoso porque modelos reasoning (gpt-oss) gastam parte
    # da janela em pensamento interno
    raw = await chat(messages, temperature=0.6, max_tokens=4000)

    # 3. valida
    # Se recomposicao em modo atividades, usamos a faixa de palavras maior
    # (lista de exercicios) ao validar.
    modo_validacao = req.modo
    if req.modo == "recomposicao_paralela" and (req.tipo_recomposicao or "aula") == "atividades":
        modo_validacao = "lista_de_exercicios"
    aulas, problemas = parse_llm_output(raw, len(req.aulas), modo_validacao)

    # 4. retry uma vez se houver problemas
    if problemas and aulas:
        retry_msgs = build_retry_message(raw, problemas, modo=modo_validacao)
        try:
            raw2 = await chat(retry_msgs, temperature=0.35, max_tokens=4000)
            aulas2, problemas2 = parse_llm_output(raw2, len(req.aulas), modo_validacao)
            # so substitui se o retry diminuiu problemas
            if len(problemas2) < len(problemas):
                aulas = aulas2
        except LLMError:
            pass

    resposta = GenerateResponse(
        modo=req.modo,
        tema=req.tema,
        aulas=aulas,
        habilidades_usadas=hits,
        fonte="llm",
    )

    # Persiste no cache pra requests futuros (so pra modos cacheaveis).
    # IMPORTANTE: salva tambem quando force_regenerate=True, com upsert na
    # mesma chave — assim "Regerar" atualiza a entrada cacheada em vez de
    # deixar o registro antigo continuar valido por 7 dias.
    if cached_hash and aulas:
        cache_mod.cache_save(req, resposta, cached_hash)

    return resposta
