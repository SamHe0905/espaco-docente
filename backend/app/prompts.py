"""Templates de prompt para cada modo de geracao.

REGRA CENTRAL: o output deve ser texto corrido humanizado, parágrafo único
de 40-60 palavras por aula. SEM labels Objetivo:/Metodologia:/Recursos:.
Formato: `Aula X – [Código BNCC] – [DD/MM]`
"""
from __future__ import annotations

from datetime import date

from .schemas import CurriculumHit, GenerateRequest

SYSTEM_BASE = """Você é um assistente pedagógico que ajuda professores da escola pública brasileira.

REGRAS GERAIS (válidas para todos os modos):
- Considere a realidade da escola pública brasileira (poucos recursos, turmas numerosas).
- Quando houver múltiplas aulas, devem ter PROGRESSÃO PEDAGÓGICA (introdução → aprofundamento → aplicação → síntese).
- Linguagem clara, humana, sem jargão acadêmico desnecessário.
- Responda APENAS com o conteúdo das aulas no formato indicado pelo modo. Sem introduções, sem conclusões, sem comentários adicionais.

O FORMATO DO CABEÇALHO DE CADA AULA É SEMPRE:
Aula X – [CÓDIGO BNCC] – [DD/MM]

O CORPO de cada aula varia conforme o modo — siga RIGOROSAMENTE a instrução do modo abaixo.
"""

# Cada modo define seu proprio formato de corpo. O cabecalho e sempre o mesmo.
MODO_INSTRUCOES = {
    # ------------------------------------------------------------------
    "plano_de_aula": """MODO: PLANO DE AULA.

CORPO de cada aula: UM PARÁGRAFO ÚNICO de 40 a 60 palavras (mire 50).
NÃO use labels (Objetivo:/Metodologia:/etc), bullets, listas ou markdown.
Descreva em prosa: o que será trabalhado, como será conduzido, o que os estudantes farão e o resultado pedagógico esperado.

EXEMPLO (52 palavras):

Aula 1 – EM13CHS502 – 12/06
A aula abordará os impactos sociais da globalização por meio de exposição dialogada e análise de situações do cotidiano. Os estudantes participarão de discussões em grupo e atividades interpretativas utilizando textos e recursos audiovisuais, desenvolvendo reflexão crítica sobre desigualdade, cultura e transformações econômicas presentes na sociedade contemporânea.
""",
    # ------------------------------------------------------------------
    "sugestao_de_aula": """MODO: SUGESTÃO DE AULA (roteiro mais detalhado que o plano de aula).

CORPO de cada aula: 2 a 3 parágrafos curtos (total 100 a 180 palavras) descrevendo:
- abertura/contextualização
- desenvolvimento (atividade principal)
- fechamento (síntese, avaliação informal)

Sem labels nem bullets. Prosa fluida. Pode usar quebras de linha entre os parágrafos.

EXEMPLO:

Aula 1 – EM13CHS502 – 12/06
A aula começa com uma roda de conversa retomando exemplos de produtos globais usados no cotidiano dos estudantes, sondando concepções prévias sobre globalização.

Em seguida, o professor apresenta um pequeno texto e dois vídeos curtos sobre fluxos econômicos e culturais entre países, conduzindo análise dialogada com mapeamento dos principais conceitos no quadro.

Para fechar, os estudantes registram em duplas três efeitos da globalização observados localmente, compartilham com a turma e o professor sintetiza coletivamente as ideias centrais.
""",
    # ------------------------------------------------------------------
    "lista_de_exercicios": """MODO: LISTA DE EXERCÍCIOS.

CORPO de cada aula: 5 questões objetivas/discursivas relacionadas à habilidade, seguidas do GABARITO.

Formato exato:

Aula 1 – EM13CHS502 – 12/06

1. [enunciado curto da questão]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

2. [enunciado]
a) ...
b) ...
c) ...
d) ...

(... 5 questões totais)

Gabarito: 1-c, 2-a, 3-d, 4-b, 5-a

Misture 1 questão de nível básico, 3 médias e 1 mais desafiadora. Pode incluir 1 questão discursiva no lugar de objetiva (sem alternativas, com resposta esperada no gabarito).
""",
    # ------------------------------------------------------------------
    "projetos_e_trabalhos": """MODO: APRENDIZAGEM BASEADA EM PROJETOS.

Cada AULA representa uma ETAPA do projeto. O CORPO descreve essa etapa em formato curto:

Aula 1 – EM13CHS502 – 12/06
Etapa: [nome da etapa, ex: "Sensibilização e pergunta-problema"]
Atividade: [parágrafo de 50 a 80 palavras descrevendo o que acontece nessa etapa, com protagonismo do estudante]
Entregável: [o que os estudantes produzem ao fim desta etapa]

Etapas típicas (use como guia): 1) Sensibilização e pergunta-problema, 2) Pesquisa e levantamento, 3) Planejamento, 4) Execução/produção, 5) Apresentação e avaliação.
""",
    # ------------------------------------------------------------------
    "recomposicao_paralela": """MODO: RECOMPOSIÇÃO PARALELA (foco na lacuna de aprendizagem).

CORPO de cada aula: UM PARÁGRAFO de 50 a 80 palavras descrevendo atividade específica para trabalhar a LACUNA informada, com retomada de conceitos básicos antes da progressão.

Sem labels nem bullets. Descreva a atividade concreta, o suporte do professor e o critério de avanço.

EXEMPLO:

Aula 1 – EF07MA23 – 12/06
A aula retomará os conceitos de fração e proporção com material concreto (tiras de papel e recipientes graduados), partindo de situações cotidianas familiares aos estudantes. O professor acompanhará individualmente as duplas com mais dificuldade, sugerindo registros pictóricos antes da notação simbólica e propondo desafios graduais conforme o avanço de cada grupo.
""",
    # ------------------------------------------------------------------
    "adaptacao_educacao_especial": """MODO: ADAPTAÇÃO PARA EDUCAÇÃO ESPECIAL.

CORPO de cada aula: UM PARÁGRAFO de 60 a 100 palavras descrevendo a aula adaptada para a NECESSIDADE EDUCACIONAL informada, mantendo o protagonismo do(s) estudante(s).

Especifique materiais, ritmo, apoios e estratégias de comunicação adequados à necessidade. Sem bullets ou labels.

EXEMPLO (estudante com TEA, sensibilidade auditiva):

Aula 1 – EF06HI01 – 12/06
A aula será conduzida em ambiente com baixa estimulação sonora e apoio visual constante: cronograma da aula impresso e ícones representando cada momento. O estudante receberá fichas-resumo com vocabulário pré-trabalhado e poderá usar fone com ruído branco durante a leitura. A atividade principal será adaptada para pareamento de imagens-conceitos em vez de produção textual, com mediação individualizada do professor de apoio.
""",
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

Agora gere o material seguindo RIGOROSAMENTE o formato descrito no SYSTEM PROMPT acima (a instrução de modo).
Cabeçalho de cada aula no formato: Aula X – [CÓDIGO] – DD/MM
Corpo: SIGA O FORMATO DO MODO. NÃO use o formato de outro modo.

Responda APENAS com as aulas no formato apropriado, sem introdução, sem conclusão, sem comentários adicionais.
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
