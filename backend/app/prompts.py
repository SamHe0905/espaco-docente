"""Templates de prompt para cada modo de geracao.

REGRA CENTRAL: o output deve ser texto corrido humanizado, parágrafo único
de 40-60 palavras por aula. SEM labels Objetivo:/Metodologia:/Recursos:.
Formato: `Aula X – [Código BNCC] – [DD/MM]`
"""
from __future__ import annotations

from datetime import date

from .schemas import CurriculumHit, GenerateRequest

SYSTEM_BASE = """Você é um assistente pedagógico que ajuda professores da escola pública brasileira a planejar suas aulas.

REGRAS DE ESCRITA ABSOLUTAMENTE OBRIGATÓRIAS:
1. Cada aula deve ser UM PARÁGRAFO ÚNICO de texto corrido.
2. Cada parágrafo deve ter ENTRE 40 E 60 PALAVRAS — MIRE 55 PALAVRAS POR PARÁGRAFO.
3. CONTE as palavras antes de finalizar. Se contar menos de 40, REESCREVA expandindo. Se contar mais de 60, REESCREVA condensando.
4. Você TEM TENDÊNCIA A ESCREVER CURTO DEMAIS. Combata isso: adicione descrições concretas, conexões com contexto, finalidades pedagógicas.
4. NÃO USE labels como "Objetivo:", "Metodologia:", "Recursos:", "Avaliação:", "Conteúdo:".
5. NÃO USE bullet points, listas, tópicos, tabelas ou enumeração.
6. NÃO USE markdown (sem **negrito**, sem # títulos, sem - hífens).
7. Escreva como um professor experiente registraria em seu diário — humano, fluido, descritivo.
8. Cada parágrafo deve descrever: O QUE será trabalhado, COMO será conduzido, e O QUE os estudantes farão. Tudo em prosa contínua.
9. Varie verbos pedagógicos (abordar, explorar, problematizar, analisar, discutir, vivenciar, refletir, construir, comparar, sintetizar).
10. Considere a realidade da escola pública brasileira (poucos recursos, turmas numerosas).
11. Quando houver múltiplas aulas, devem ter PROGRESSÃO PEDAGÓGICA (introdução → aprofundamento → aplicação → síntese).

CADA PARÁGRAFO DEVE OBRIGATORIAMENTE INCLUIR:
- a abordagem pedagógica usada (exposição dialogada, debate, análise de fontes, etc)
- o objeto de estudo da aula (tema/conceito específico)
- o que os estudantes farão concretamente (discutir, analisar, interpretar, produzir, etc)
- o resultado pedagógico esperado (desenvolvimento crítico, compreensão, vivência, etc)
- pelo menos UM elemento de contexto (recurso, exemplo, conexão com cotidiano)

Isso naturalmente leva a 45-55 palavras. Parágrafos curtos (< 40 palavras) SEMPRE estarão violando essa regra.

EXEMPLO DE PARÁGRAFO IDEAL (52 palavras — conte):

"A aula abordará os impactos sociais da globalização por meio de exposição dialogada e análise de situações do cotidiano. Os estudantes participarão de discussões em grupo e atividades interpretativas utilizando textos e recursos audiovisuais, desenvolvendo reflexão crítica sobre desigualdade, cultura e transformações econômicas presentes na sociedade contemporânea."

OUTRO EXEMPLO (48 palavras):

"Os estudantes investigarão o conceito de cidadania por meio de pesquisa em pequenos grupos sobre direitos sociais conquistados ao longo do século XX. A partir das descobertas, produzirão cartazes e participarão de roda de conversa, ampliando a compreensão sobre participação política e responsabilidade coletiva na sociedade brasileira contemporânea."

OUTRO EXEMPLO (44 palavras):

"A partir da leitura compartilhada de fragmentos do livro didático, a aula problematizará as transformações no mundo do trabalho. Os estudantes farão análise comparativa entre profissões tradicionais e contemporâneas, registrando reflexões em diário pedagógico para posterior socialização e síntese coletiva em sala."

FORMATO DE SAÍDA OBRIGATÓRIO:

Aula 1 – [CÓDIGO] – [DD/MM]
[parágrafo único de 40 a 60 palavras descrevendo o que será feito, como, e o que os estudantes farão]

Aula 2 – [CÓDIGO] – [DD/MM]
[parágrafo único de 40 a 60 palavras com progressão em relação à anterior]

(e assim por diante)
"""

MODO_INSTRUCOES = {
    "plano_de_aula": (
        "MODO: PLANO DE AULA. Gere texto BREVE adequado para registro no sistema da escola — "
        "objetivo, atividade e abordagem em um único parágrafo corrido por aula."
    ),
    "sugestao_de_aula": (
        "MODO: SUGESTÃO DE AULA. Gere roteiro um pouco mais detalhado mantendo o formato de "
        "parágrafo único 40-60 palavras — descreva a abordagem, o que será feito e como, "
        "ainda assim em prosa contínua."
    ),
    "lista_de_exercicios": (
        "MODO: LISTA DE EXERCÍCIOS. Para cada aula, descreva em parágrafo corrido de 40-60 "
        "palavras o conjunto de exercícios proposto (quantidade, tipo, nível, foco), sem "
        "listar as questões em si."
    ),
    "projetos_e_trabalhos": (
        "MODO: APRENDIZAGEM BASEADA EM PROJETOS. Cada parágrafo descreve uma etapa do projeto "
        "(investigação, planejamento, execução, apresentação), com pergunta-problema implícita "
        "e protagonismo do estudante."
    ),
    "recomposicao_paralela": (
        "MODO: RECOMPOSIÇÃO PARALELA. Cada parágrafo descreve atividades específicas para "
        "trabalhar a lacuna de aprendizagem identificada, com retomada de conceitos básicos "
        "e progressão suave."
    ),
    "adaptacao_educacao_especial": (
        "MODO: ADAPTAÇÃO PARA EDUCAÇÃO ESPECIAL. Cada parágrafo descreve a aula adaptada para "
        "atender a necessidade educacional informada, com materiais, ritmo e abordagem "
        "ajustados — sempre respeitando o protagonismo do estudante."
    ),
}


def build_messages(req: GenerateRequest, hits: list[CurriculumHit]) -> list[dict]:
    """Monta os mensagens system + user para o LLM."""

    system = SYSTEM_BASE + "\n\n" + MODO_INSTRUCOES[req.modo]

    # contexto curricular: as habilidades recuperadas pelo RAG
    contexto_curricular = "\n\n".join(
        f"[{h.codigo}] {h.disciplina} / {h.serie or '-'}: {h.habilidades or h.texto}"
        for h in hits[:5]
    )

    aulas_solicitadas = "\n".join(
        f"- Aula {i+1}: {a.data.strftime('%d/%m')}"
        + (f" (observacao: {a.observacoes})" if a.observacoes else "")
        for i, a in enumerate(req.aulas)
    )

    # codigos a usar nas aulas: lista informada pelo professor (1 ou N)
    # com fallback no top hit do RAG
    codigos_solicitados = req.codigos_efetivos()
    if not codigos_solicitados and hits:
        codigos_solicitados = [hits[0].codigo]
    if not codigos_solicitados:
        codigos_solicitados = ["—"]

    if len(codigos_solicitados) == 1:
        codigo_referencia = codigos_solicitados[0]
        instrucao_codigos = (
            f"Use SEMPRE o código {codigo_referencia} no cabeçalho de TODAS as aulas."
        )
    else:
        codigo_referencia = codigos_solicitados[0]  # default pra exibicao
        codigos_str = ", ".join(codigos_solicitados)
        instrucao_codigos = (
            f"O professor selecionou MÚLTIPLAS habilidades: {codigos_str}.\n"
            f"DISTRIBUA-AS pelas aulas conforme a progressão pedagógica natural — "
            f"cada aula no cabeçalho deve trazer o código que ela melhor trabalha. "
            f"Você pode repetir um código em mais de uma aula se fizer sentido. "
            f"Use APENAS códigos dessa lista nos cabeçalhos."
        )

    pref_lines = []
    if req.metodologia:
        pref_lines.append(f"- Metodologia desejada: {req.metodologia}")
    if req.recursos:
        pref_lines.append(f"- Recursos disponíveis: {req.recursos}")
    if req.observacoes_turma:
        pref_lines.append(f"- Perfil da turma: {req.observacoes_turma}")
    if req.adaptacao_necessaria:
        pref_lines.append(f"- Adaptação necessária: {req.adaptacao_necessaria}")
    if req.lacuna_aprendizagem:
        pref_lines.append(f"- Lacuna de aprendizagem: {req.lacuna_aprendizagem}")
    preferencias = "\n".join(pref_lines) if pref_lines else "- Sem preferências específicas."

    user = f"""Gere um planejamento para a seguinte turma:

ETAPA: {req.etapa}
SÉRIE: {req.serie or '—'}
DISCIPLINA: {req.disciplina}
TEMA: {req.tema}
FOCO ESPECÍFICO: {req.foco_especifico or '—'}
CÓDIGO(S) BNCC: {', '.join(codigos_solicitados)}

INSTRUÇÃO SOBRE OS CÓDIGOS:
{instrucao_codigos}

CONTEXTO CURRICULAR (habilidades relevantes encontradas):
{contexto_curricular}

AULAS A PLANEJAR:
{aulas_solicitadas}

PREFERÊNCIAS PEDAGÓGICAS:
{preferencias}

Gere agora o planejamento seguindo RIGOROSAMENTE o formato:
Aula X – [CÓDIGO DA LISTA] – DD/MM
[parágrafo único de 40 a 60 palavras]

Responda APENAS com as aulas no formato acima, sem introdução, sem conclusão, sem comentários adicionais.
"""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def build_retry_message(original: str, problemas: list[str]) -> list[dict]:
    """Mensagem de retry quando a primeira saida nao respeita o formato."""
    return [
        {
            "role": "system",
            "content": SYSTEM_BASE
            + "\n\nVocê acabou de gerar um output que NÃO seguiu as regras. "
            "Corrija e responda APENAS com as aulas no formato pedido.",
        },
        {"role": "user", "content": f"Output anterior:\n\n{original}"},
        {
            "role": "user",
            "content": "Problemas detectados:\n- "
            + "\n- ".join(problemas)
            + "\n\nReescreva mantendo o mesmo conteúdo geral, mas corrigindo "
            "TODOS os problemas listados. Cada aula deve ter parágrafo único "
            "com 40 a 60 palavras, no formato 'Aula X – CÓDIGO – DD/MM'.",
        },
    ]
