-- ============================================================================
-- Espaço Docente — seed do motor pedagógico
-- ============================================================================
-- Conteúdo RECRIADO do zero em 2026-07-01. O original nunca existiu como
-- arquivo (foi digitado/colado direto no Supabase em sessão anterior e se
-- perdeu junto com o projeto). Revisar se você lembrar de ter customizado
-- nomes/filtros diferentes destes.
--
-- Rodar DEPOIS de supabase_schema.sql, no mesmo projeto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- metodologias — disciplinas/etapas null = serve pra qualquer uma
-- ----------------------------------------------------------------------------
insert into metodologias (nome, disciplinas, etapas) values
    ('Aula expositiva dialogada', null, null),
    ('Sala de aula invertida', null, array['EF','EM']),
    ('Aprendizagem baseada em problemas (PBL)', null, array['EF','EM']),
    ('Aprendizagem baseada em projetos', null, null),
    ('Gamificação', null, null),
    ('Rotação por estações', null, array['EI','EF']),
    ('Ensino híbrido', null, array['EF','EM']),
    ('Estudo de caso', array['Ciencias Humanas e Sociais Aplicadas','Matematica e suas Tecnologias'], array['EM']),
    ('Debate estruturado', array['Linguagens, Codigos e suas Tecnologias','Ciencias Humanas e Sociais Aplicadas'], array['EF','EM']),
    ('Oficina prática (mão na massa)', array['Ciencias da Natureza e suas Tecnologias'], null),
    ('Roda de conversa', null, array['EI','EF']),
    ('Sequência didática investigativa', array['Ciencias da Natureza e suas Tecnologias'], null),
    ('Resolução de problemas em grupo', array['Matematica e suas Tecnologias'], null),
    ('Contação de histórias', array['Linguagens, Codigos e suas Tecnologias'], array['EI','EF']),
    ('Peer instruction (instrução por pares)', null, array['EF','EM']),
    ('Storytelling com dados', array['Matematica e suas Tecnologias','Ciencias da Natureza e suas Tecnologias'], array['EM']),
    ('Simulação/dramatização', array['Ciencias Humanas e Sociais Aplicadas'], null),
    ('Mapa mental colaborativo', null, null),
    ('Ensino por pesquisa (webquest)', null, array['EF','EM']),
    ('Portfólio reflexivo', null, array['EF','EM']);

-- ----------------------------------------------------------------------------
-- verbos_pedagogicos — Taxonomia de Bloom (revisada), em português
-- ----------------------------------------------------------------------------
insert into verbos_pedagogicos (verbo, taxonomia) values
    ('identificar', 'lembrar'),
    ('listar', 'lembrar'),
    ('nomear', 'lembrar'),
    ('reconhecer', 'lembrar'),
    ('explicar', 'entender'),
    ('resumir', 'entender'),
    ('descrever', 'entender'),
    ('interpretar', 'entender'),
    ('aplicar', 'aplicar'),
    ('resolver', 'aplicar'),
    ('demonstrar', 'aplicar'),
    ('utilizar', 'aplicar'),
    ('comparar', 'analisar'),
    ('classificar', 'analisar'),
    ('investigar', 'analisar'),
    ('relacionar', 'analisar'),
    ('argumentar', 'avaliar'),
    ('justificar', 'avaliar'),
    ('avaliar', 'avaliar'),
    ('julgar criticamente', 'avaliar'),
    ('criar', 'criar'),
    ('produzir', 'criar'),
    ('propor', 'criar'),
    ('elaborar', 'criar');

-- ----------------------------------------------------------------------------
-- estrategias_didaticas — por momento da aula
-- ----------------------------------------------------------------------------
insert into estrategias_didaticas (nome, momento) values
    ('Pergunta disparadora sobre o tema', 'abertura'),
    ('Retomada rápida da aula anterior', 'abertura'),
    ('Situação-problema do cotidiano', 'abertura'),
    ('Enquete ou levantamento de conhecimentos prévios', 'abertura'),
    ('Explicação dialogada com exemplos', 'desenvolvimento'),
    ('Atividade em duplas ou grupos pequenos', 'desenvolvimento'),
    ('Prática guiada com feedback imediato', 'desenvolvimento'),
    ('Análise de fontes/dados/textos', 'desenvolvimento'),
    ('Resolução de exercícios progressivos', 'desenvolvimento'),
    ('Síntese coletiva do que foi aprendido', 'fechamento'),
    ('Autoavaliação rápida (o que aprendi hoje)', 'fechamento'),
    ('Ponte para a próxima aula', 'fechamento');

-- ----------------------------------------------------------------------------
-- progressao_didatica — posição relativa dentro do conjunto de aulas
-- ----------------------------------------------------------------------------
insert into progressao_didatica (nome, posicao_relativa, foco) values
    ('Sondagem e contextualização', 'inicio', 'ativar conhecimentos prévios e apresentar o tema'),
    ('Introdução de conceitos-chave', 'inicio', 'apresentar vocabulário e ideias centrais'),
    ('Aprofundamento e prática', 'meio', 'consolidar conceitos com exercícios e discussão'),
    ('Aplicação em novos contextos', 'meio', 'transferir o conhecimento pra situações diferentes'),
    ('Síntese e consolidação', 'fim', 'amarrar os aprendizados e checar compreensão'),
    ('Avaliação e produção final', 'fim', 'produzir algo que demonstre o aprendizado');
