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

MIN_WORDS = 40
MAX_WORDS = 60

# captura "Aula X - CODIGO - DD/MM" com varias variacoes de tracos
# (en-dash, em-dash, hifen, com/sem espacos)
HEADER_RX = re.compile(
    r"Aula\s*(\d+)\s*[\-–—]\s*([A-Z0-9\.]+)\s*[\-–—]\s*(\d{1,2}/\d{1,2})",
    re.IGNORECASE,
)


def count_words(text: str) -> int:
    return len([w for w in re.findall(r"\b[\wÀ-ÿ]+\b", text)])


def parse_llm_output(text: str, requested_aulas_count: int) -> tuple[list[AulaOutput], list[str]]:
    """Faz parse do output do LLM em AulaOutput.

    Retorna (aulas, problemas). Se problemas != [], deve-se considerar retry.
    """
    problemas: list[str] = []
    aulas: list[AulaOutput] = []

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
        if words < MIN_WORDS:
            problemas.append(f"Aula {numero} tem {words} palavras (minimo {MIN_WORDS})")
        elif words > MAX_WORDS:
            problemas.append(f"Aula {numero} tem {words} palavras (maximo {MAX_WORDS})")

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
    # 1. RAG: busca habilidades relevantes
    query = req.tema + (f" {req.foco_especifico}" if req.foco_especifico else "")

    hits: list[CurriculumHit] = []
    # se professor informou codigos, prioriza-os como contexto principal
    for cod in req.codigos_efetivos():
        item = get_by_codigo(cod)
        if item and item.codigo not in {x.codigo for x in hits}:
            hits.append(item)

    # complementa com busca semantica ate ter ate 6 hits
    faltam = max(0, 6 - len(hits))
    if faltam > 0:
        for h in search_curriculum(
            query, top_k=faltam + 2, etapa=req.etapa, disciplina=req.disciplina
        ):
            if h.codigo not in {x.codigo for x in hits}:
                hits.append(h)
                if len(hits) >= 6:
                    break

    if not hits:
        # fallback: sem filtros
        hits = search_curriculum(query, top_k=5)

    # 2. LLM: gera planejamento
    messages = build_messages(req, hits)
    raw = await chat(messages, temperature=0.6, max_tokens=2200)

    # 3. valida
    aulas, problemas = parse_llm_output(raw, len(req.aulas))

    # 4. retry uma vez se houver problemas
    if problemas and aulas:
        retry_msgs = build_retry_message(raw, problemas)
        try:
            raw2 = await chat(retry_msgs, temperature=0.35, max_tokens=2200)
            aulas2, problemas2 = parse_llm_output(raw2, len(req.aulas))
            # so substitui se o retry diminuiu problemas
            if len(problemas2) < len(problemas):
                aulas = aulas2
        except LLMError:
            pass

    return GenerateResponse(
        modo=req.modo,
        tema=req.tema,
        aulas=aulas,
        habilidades_usadas=hits,
    )
