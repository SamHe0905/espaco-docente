"""Templates de prompt para cada modo de geracao.

REGRA CENTRAL: o output deve ser texto corrido humanizado, parágrafo único
de 40-60 palavras por aula. SEM labels Objetivo:/Metodologia:/Recursos:.
Formato: `Aula X – [Código BNCC] – [DD/MM]`
"""
from __future__ import annotations

from datetime import date

from . import motor_pedagogico as motor
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
    "sugestao_de_aula": """MODO: ROTEIRO DETALHADO DE UMA AULA (planejamento profundo, pronto pra usar).

Este modo NÃO é um plano breve um pouco mais longo. É um ROTEIRO COMPLETO de UMA aula, com profundidade real pra o professor entrar em sala sem precisar planejar mais nada. Foco em UMA aula por vez (se o professor solicitar várias datas, gere um roteiro completo e independente para cada — sem repetir as mesmas ideias em aulas diferentes).

CORPO de cada aula: 500 a 900 palavras, estruturado nas SEÇÕES abaixo, na ordem, separadas por linha em branco. Cada título de seção deve aparecer EXATAMENTE no formato `## Título da Seção` (dois sustenidos + espaço + título em formato Capitalize As Iniciais — isso garante negrito ao exportar). Dentro de cada seção, use prosa direta — SEM bullets, SEM listas com hífen, SEM outros marcadores markdown. Cada seção deve trazer INFORMAÇÃO NOVA e CONCRETA — proibido reformular o que já foi dito.

Aula X – [CÓDIGO] – DD/MM

## Visão Geral da Aula
Um parágrafo de 50 a 80 palavras: o que esta aula entrega ao final, qual a grande pergunta que ela responde, e por que esse recorte importa pro estudante. Sem rodeios, sem palavras vazias.

## Objetivos de Aprendizagem
3 a 5 objetivos em verbos no infinitivo, derivados da habilidade BNCC desta aula. Cada um deve ser observável (o que o estudante demonstrará saber/fazer). Apresente em prosa corrida, separados por ponto-e-vírgula — não use lista com hífen.

## Materiais e Preparação Prévia
Em prosa, descreva APENAS o que é necessário pra esta aula específica e o que o professor precisa providenciar antes (impressos, links, imagens, organização da sala). Considere a realidade da escola pública — sem materiais caros ou difíceis. Sem bullets.

## Sequência Didática
Divida a aula em 4 a 6 momentos sequenciais. Para cada um indique entre parênteses o tempo aproximado em minutos. Descreva em prosa o que o PROFESSOR faz, o que os ESTUDANTES fazem, e como a transição pro próximo momento acontece. Seja específico: cite a pergunta exata da abertura, o exemplo concreto usado, o comando que o professor dá. NÃO repita conteúdo da Visão Geral. Esta é a parte mais densa do roteiro. Cada momento em um parágrafo próprio (separado por linha em branco), sem bullets.

## Atividade Central
Detalhe SÓ a atividade-chave da aula (a que mais demora ou produz a aprendizagem central): enunciado completo que será passado aos estudantes, organização da turma (individual/duplas/grupos), critério de execução, e o que o professor faz enquanto eles trabalham (circulação, intervenções típicas, perguntas mediadoras). Prosa única, sem listas.

## Avaliação Formativa
Como o professor sabe, AINDA NESTA AULA, se os estudantes alcançaram os objetivos. Indique 2 ou 3 evidências observáveis (uma resposta esperada, um registro produzido, uma participação característica) e o que fazer com cada uma. Não é prova ao final do bimestre — é leitura em tempo real. Texto em prosa.

## Possíveis Dificuldades e Mediações
Antecipe 2 ou 3 obstáculos reais (conceitos que confundem, perfis de estudante que travam, dispersão típica) e descreva a mediação concreta para cada — uma frase prática que o professor pode usar, um ajuste de organização, um exemplo alternativo. Em prosa.

## Fechamento e Próximos Passos
Como a aula termina (síntese conduzida, registro coletivo, pergunta de saída) e o que conecta com a próxima aula da sequência. Se houver tarefa de casa pertinente, descreva-a aqui em uma frase — sem inventar tarefa por inventar.

REGRAS DURAS DE QUALIDADE:
Cada seção traz informação NOVA. É proibido parafrasear o que já foi dito antes. Linguagem operacional, com ações concretas e perguntas/falas exatas — não descrições genéricas tipo "fazer atividade interessante". Considere turma de escola pública (~35 estudantes, recursos limitados). Total da aula: 500 a 900 palavras. Se ficar abaixo de 500 está raso demais; se passar de 900 está prolixo.

REGRA DE FORMATAÇÃO (CRÍTICA):
Os títulos de seção DEVEM aparecer literalmente como `## Título da Seção` no início de uma linha, sem outros caracteres antes. NÃO use CAIXA ALTA, NÃO use negrito com asteriscos, NÃO use bullets, NÃO use markdown além do `## ` nos títulos. O corpo de cada seção é prosa pura.
""",
    # ------------------------------------------------------------------
    "lista_de_exercicios": """MODO: LISTA DE EXERCÍCIOS.

CORPO de cada aula: N questões relacionadas à habilidade, seguidas do GABARITO.

O professor informa nas PREFERÊNCIAS PEDAGÓGICAS:
- Quantidade de questões (padrão: 5)
- Nível de dificuldade ('basico', 'intermediario', 'avancado' ou 'misto'; padrão: misto)
- Tipo ('objetivas', 'discursivas', 'mista'; padrão: mista)

Formato exato:

Aula 1 – EM13CHS502 – 12/06

1. [enunciado curto]
a) [alternativa]
b) [alternativa]
c) [alternativa]
d) [alternativa]

2. [enunciado]
a) ...
b) ...
c) ...
d) ...

(... N questões totais)

Gabarito: 1-c, 2-a, 3-d, 4-b, 5-a

Regras:
- Se misto: distribua niveis equilibradamente.
- Se mista (tipo): proporção 80% objetivas + 20% discursivas.
- Questoes discursivas nao tem alternativas; gabarito traz a resposta esperada em ate 30 palavras.
""",
    # ------------------------------------------------------------------
    "projetos_e_trabalhos": """MODO: ESQUELETO DE PROJETO (brainstorm pro professor adaptar).

IMPORTANTE: este modo NÃO segue o formato 'Aula X – CÓDIGO – DD/MM'.
Em vez disso, gere UM documento estruturado descrevendo o projeto como um todo,
pro professor usar como ponto de partida.

NÃO descreva o que acontece em cada aula individual. NÃO simule sequência de aulas.
O objetivo é dar ao professor o ARCABOUÇO do projeto pra ele adaptar à sua realidade.

FORMATO EXATO DA SAÍDA (use estes cabeçalhos em maiúsculas, na ordem):

TÍTULO DO PROJETO
[título conciso e instigante baseado no tema do professor]

PERGUNTA-PROBLEMA
[a pergunta central que vai mover o projeto, em formato pergunta]

JUSTIFICATIVA
[parágrafo único de 50 a 80 palavras conectando o tema à realidade do estudante e à relevância pedagógica]

OBJETIVOS DE APRENDIZAGEM
[3 a 5 objetivos em forma de verbo no infinitivo, derivados das habilidades BNCC informadas]
- objetivo 1
- objetivo 2
- ...

PRODUTO FINAL
[descrição do entregável esperado, considerando o que o professor pediu em 'produto_final'. Especifique formato, extensão e características.]

ETAPAS SUGERIDAS
[de 4 a 6 etapas, cada uma com NOME em negrito breve + 1 frase curta descrevendo o foco. NÃO atribua a aulas específicas, NÃO coloque datas.]
1. **Sensibilização** — apresenta a pergunta-problema e levanta concepções prévias.
2. **Pesquisa** — investigação em fontes diversas sobre os subtemas.
3. ...

RECURSOS NECESSÁRIOS
[lista enxuta de materiais, ferramentas digitais, espaços; baseada em 'recursos' informados]
- recurso 1
- recurso 2

AVALIAÇÃO
[parágrafo de 40 a 80 palavras sobre como avaliar processo + produto, considerando 'publico_apresentacao' se informado]

DICAS PARA O PROFESSOR
[3 a 5 sugestões práticas pra adaptar, conduzir ou diferenciar o projeto pra realidade da turma]
- dica 1
- dica 2
- ...

Considere o tempo informado em 'duracao_projeto' pra dimensionar profundidade das etapas (sem listar datas).
""",
    # ------------------------------------------------------------------
    "recomposicao_paralela": """MODO: RECOMPOSIÇÃO PARALELA (foco na LACUNA DE APRENDIZAGEM).

Este modo tem DUAS variantes possíveis, escolhidas pelo professor em 'Preferências':
- tipo_recomposicao = 'aula' (padrão): gera AULAS de recomposição
- tipo_recomposicao = 'atividades': gera LISTA DE ATIVIDADES práticas

--- VARIANTE 'aula' (padrão) ---

CORPO de cada aula: UM PARÁGRAFO de 50 a 80 palavras descrevendo atividade pedagógica para trabalhar a LACUNA informada, com retomada de conceitos básicos antes da progressão.

Sem labels nem bullets. Descreva a atividade concreta, o suporte do professor e o critério de avanço.

EXEMPLO:

Aula 1 – EF07MA23 – 12/06
A aula retomará os conceitos de fração e proporção com material concreto (tiras de papel e recipientes graduados), partindo de situações cotidianas familiares aos estudantes. O professor acompanhará individualmente as duplas com mais dificuldade, sugerindo registros pictóricos antes da notação simbólica e propondo desafios graduais conforme o avanço de cada grupo.

--- VARIANTE 'atividades' ---

CORPO de cada aula: LISTA DE 5 a 10 exercícios práticos focados em vencer a LACUNA informada, com progressão de fácil para mais desafiador, seguidos de GABARITO.

Inclua ao menos 2 questões DISCURSIVAS com resposta esperada no gabarito (para o professor avaliar compreensão), além das objetivas.

Formato exato:

Aula 1 – EF07MA23 – 12/06

1. [enunciado simples e direto, retomando conceito basico]
a) ...
b) ...
c) ...
d) ...

2. [enunciado de mesmo nivel basico]
...

(progressao do mais facil para o mais desafiador; misture objetivas e discursivas)

Gabarito: 1-b, 2-a, 3-(discursiva: resposta esperada em ate 30 palavras), ...
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

    # Motor pedagogico: sorteia metodologia/verbo/estrategia/fase por aula
    # Pra projetos_e_trabalhos nao faz sentido (e documento unico)
    if req.modo == "projetos_e_trabalhos":
        kits = []
    else:
        kits = motor.montar_kits_para_plano(
            n_aulas=len(req.aulas) or 1,
            disciplina=req.disciplina,
            etapa=req.etapa,
        )

    aulas_linhas = []
    for i, a in enumerate(req.aulas):
        linha = f"- Aula {i+1}: {a.data.strftime('%d/%m')}"
        if a.observacoes:
            linha += f" (observacao: {a.observacoes})"
        if i < len(kits):
            kit_txt = motor.kit_para_texto(kits[i])
            if kit_txt:
                linha += f"\n    diretrizes pedagogicas: {kit_txt}"
        aulas_linhas.append(linha)
    aulas_solicitadas = "\n".join(aulas_linhas)

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

    # Recomposicao
    if req.lacuna_aprendizagem:
        pref_lines.append(f"- LACUNA DE APRENDIZAGEM: {req.lacuna_aprendizagem}")
    if req.nivel_defasagem:
        pref_lines.append(f"- Nível de defasagem: {req.nivel_defasagem}")
    if req.tipo_recomposicao:
        pref_lines.append(f"- tipo_recomposicao: {req.tipo_recomposicao}")

    # Adaptacao
    if req.tipo_necessidade:
        pref_lines.append(f"- NECESSIDADE EDUCACIONAL: {req.tipo_necessidade}")
    if req.adaptacao_necessaria:
        pref_lines.append(f"- Detalhes da adaptação: {req.adaptacao_necessaria}")
    if req.apoios_disponiveis:
        pref_lines.append(f"- Apoios disponíveis: {req.apoios_disponiveis}")

    # Lista de exercicios
    if req.quantidade_questoes:
        pref_lines.append(f"- Quantidade de questões: {req.quantidade_questoes}")
    if req.dificuldade:
        pref_lines.append(f"- Nível de dificuldade: {req.dificuldade}")
    if req.tipo_questoes:
        pref_lines.append(f"- Tipo de questões: {req.tipo_questoes}")

    # Projetos
    if req.duracao_projeto:
        pref_lines.append(f"- Duração do projeto: {req.duracao_projeto}")
    if req.produto_final:
        pref_lines.append(f"- Produto/entregável final: {req.produto_final}")
    if req.publico_apresentacao:
        pref_lines.append(f"- Público da apresentação: {req.publico_apresentacao}")

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


def build_retry_message(original: str, problemas: list[str], modo: str = "plano_de_aula") -> list[dict]:
    """Mensagem de retry quando a primeira saida nao respeita o formato.

    O lembrete final usa as instrucoes do MODO atual (importante: cada modo
    tem faixa de palavras e formato diferentes — o retry NAO pode fixar uma
    faixa unica).
    """
    instrucao_modo = MODO_INSTRUCOES.get(modo, MODO_INSTRUCOES["plano_de_aula"])
    return [
        {
            "role": "system",
            "content": SYSTEM_BASE
            + "\n\n"
            + instrucao_modo
            + "\n\nVocê acabou de gerar um output que NÃO seguiu as regras acima. "
            "Corrija e responda APENAS com as aulas no formato pedido.",
        },
        {"role": "user", "content": f"Output anterior:\n\n{original}"},
        {
            "role": "user",
            "content": "Problemas detectados:\n- "
            + "\n- ".join(problemas)
            + "\n\nReescreva mantendo o mesmo conteúdo geral, mas corrigindo "
            "TODOS os problemas listados. Siga EXATAMENTE o formato e a faixa de "
            "palavras descritos no SYSTEM PROMPT acima — NÃO use outra faixa.",
        },
    ]
