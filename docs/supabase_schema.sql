-- ============================================================================
-- Espaço Docente — schema completo do Supabase
-- ============================================================================
-- Reconstruído em 2026-07-01 a partir do código do backend (nunca tinha sido
-- salvo como arquivo antes — era tudo colado direto no SQL Editor do Supabase).
-- Rodar este arquivo inteiro no SQL Editor de um projeto Supabase novo/limpo.
--
-- Ordem: extensão pgvector -> tabelas -> índices -> funções RPC -> RLS.
-- ============================================================================

-- 1. Extensão pgvector (embeddings BAAI/bge-m3 = 1024 dimensões)
create extension if not exists vector;

-- ============================================================================
-- 2. Tabelas
-- ============================================================================

-- 2.1 curriculum_items — habilidades BNCC + Currículo de Referência MS
create table if not exists curriculum_items (
    id                  bigint generated always as identity primary key,
    fonte               text not null,              -- 'BNCC' | 'MS'
    codigo              text not null,               -- ex: EF06HI01, MS.EM13MAT2.n.01
    disciplina          text,
    etapa               text not null,               -- 'EI' | 'EF' | 'EM'
    modalidade          text not null default 'regular',
    serie               text,
    competencias        text[] default '{}',
    habilidades         text,
    objetos_conhecimento text[] default '{}',
    temas               text[] default '{}',
    palavras_chave      text[] default '{}',
    texto               text not null,
    embedding           vector(1024),
    criado_em           timestamptz not null default now(),
    unique (fonte, codigo)
);

-- 2.2 questoes_vestibular — ENEM + FUVEST (BLUEX/USP) + UNICAMP (BLUEX)
create table if not exists questoes_vestibular (
    id           bigint generated always as identity primary key,
    vestibular   text not null,          -- 'ENEM' | 'FUVEST' | 'UNICAMP'
    ano          int not null,
    numero       int not null,
    disciplina   text,
    area_enem    text,                   -- subject original (biology, chemistry, ...)
    idioma       text,                   -- 'ingles' | 'espanhol' | null
    contexto     text,
    enunciado    text not null,
    alternativas jsonb not null default '[]',  -- [{letter, text}, ...]
    gabarito     text not null,
    imagens      jsonb not null default '[]',  -- [url, ...]
    texto_busca  text not null,          -- texto usado pra gerar o embedding
    embedding    vector(1024),
    criado_em    timestamptz not null default now(),
    unique (vestibular, ano, numero, idioma)
);

-- 2.3 llm_usage — histórico de tokens consumidos por provider (persistente)
create table if not exists llm_usage (
    id         bigint generated always as identity primary key,
    provider   text not null,
    tokens     int not null,
    created_at timestamptz not null default now()
);

-- 2.4 cache_respostas — cache exato (hash) + semântico (embedding) de gerações
create table if not exists cache_respostas (
    id               bigint generated always as identity primary key,
    hash_consulta    text not null unique,
    modo             text not null,
    request_summary  jsonb not null default '{}',
    response         jsonb not null,
    embedding        vector(1024),
    hit_count        int not null default 0,
    created_at       timestamptz not null default now(),
    expires_at       timestamptz not null default (now() + interval '7 days')
);

-- 2.5 Motor pedagógico — elementos didáticos sorteados por aula
create table if not exists metodologias (
    id          bigint generated always as identity primary key,
    nome        text not null,
    disciplinas text[],   -- null = serve pra qualquer disciplina
    etapas      text[],   -- null = serve pra qualquer etapa
    ativo       boolean not null default true
);

create table if not exists verbos_pedagogicos (
    id         bigint generated always as identity primary key,
    verbo      text not null,
    taxonomia  text not null,  -- 'lembrar'|'entender'|'aplicar'|'analisar'|'avaliar'|'criar'
    ativo      boolean not null default true
);

create table if not exists estrategias_didaticas (
    id       bigint generated always as identity primary key,
    nome     text not null,
    momento  text not null,   -- 'abertura' | 'desenvolvimento' | 'fechamento'
    ativo    boolean not null default true
);

create table if not exists progressao_didatica (
    id                bigint generated always as identity primary key,
    nome              text not null,
    posicao_relativa  text not null,  -- 'inicio' | 'meio' | 'fim'
    foco              text,
    ativo             boolean not null default true
);

-- 2.6 professores — auth simples (username + bcrypt)
create table if not exists professores (
    id             bigint generated always as identity primary key,
    username       text not null unique,
    senha_hash     text not null,
    nome_exibicao  text,
    ativo          boolean not null default true,
    criado_em      timestamptz not null default now()
);

-- 2.7 planos_salvos — atividades salvas no perfil do professor
create table if not exists planos_salvos (
    id             bigint generated always as identity primary key,
    professor_id   bigint not null references professores(id) on delete cascade,
    modo           text not null,
    tema           text,
    request_json   jsonb not null,
    response_json  jsonb not null,
    criado_em      timestamptz not null default now()
);

-- ============================================================================
-- 3. Índices
-- ============================================================================

create index if not exists idx_curriculum_items_etapa on curriculum_items (etapa);
create index if not exists idx_curriculum_items_disciplina on curriculum_items (disciplina);
create index if not exists idx_curriculum_items_embedding on curriculum_items
    using hnsw (embedding vector_cosine_ops);

create index if not exists idx_questoes_vestibular_disciplina on questoes_vestibular (disciplina);
create index if not exists idx_questoes_vestibular_ano on questoes_vestibular (ano);
create index if not exists idx_questoes_vestibular_embedding on questoes_vestibular
    using hnsw (embedding vector_cosine_ops);

create index if not exists idx_cache_respostas_hash on cache_respostas (hash_consulta);
create index if not exists idx_cache_respostas_expires on cache_respostas (expires_at);
create index if not exists idx_cache_respostas_embedding on cache_respostas
    using hnsw (embedding vector_cosine_ops);

create index if not exists idx_llm_usage_created_at on llm_usage (created_at);

create index if not exists idx_planos_salvos_professor on planos_salvos (professor_id, criado_em desc);

-- ============================================================================
-- 4. Funções RPC (busca semântica via pgvector)
-- ============================================================================

-- 4.1 match_curriculum — busca semântica em habilidades curriculares
create or replace function match_curriculum(
    query_embedding vector(1024),
    match_count int default 5,
    filter_etapa text default null,
    filter_disciplina text default null
)
returns table (
    codigo text,
    fonte text,
    etapa text,
    serie text,
    disciplina text,
    habilidades text,
    texto text,
    similarity float
)
language sql stable
as $$
    select
        c.codigo,
        c.fonte,
        c.etapa,
        c.serie,
        c.disciplina,
        c.habilidades,
        c.texto,
        1 - (c.embedding <=> query_embedding) as similarity
    from curriculum_items c
    where c.embedding is not null
        and (filter_etapa is null or c.etapa = filter_etapa)
        and (filter_disciplina is null or c.disciplina = filter_disciplina)
    order by c.embedding <=> query_embedding
    limit match_count;
$$;

-- 4.2 match_questoes — busca semântica em questões de vestibular
create or replace function match_questoes(
    query_embedding vector(1024),
    match_count int default 8,
    filter_disciplina text default null,
    filter_ano_min int default null,
    filter_ano_max int default null
)
returns table (
    id bigint,
    vestibular text,
    ano int,
    numero int,
    disciplina text,
    area_enem text,
    idioma text,
    contexto text,
    enunciado text,
    alternativas jsonb,
    gabarito text,
    imagens jsonb,
    similarity float
)
language sql stable
as $$
    select
        q.id,
        q.vestibular,
        q.ano,
        q.numero,
        q.disciplina,
        q.area_enem,
        q.idioma,
        q.contexto,
        q.enunciado,
        q.alternativas,
        q.gabarito,
        q.imagens,
        1 - (q.embedding <=> query_embedding) as similarity
    from questoes_vestibular q
    where q.embedding is not null
        and (filter_disciplina is null or q.disciplina = filter_disciplina)
        and (filter_ano_min is null or q.ano >= filter_ano_min)
        and (filter_ano_max is null or q.ano <= filter_ano_max)
    order by q.embedding <=> query_embedding
    limit match_count;
$$;

-- 4.3 match_cache_semantico — cache semântico de respostas geradas
create or replace function match_cache_semantico(
    query_embedding vector(1024),
    filter_modo text default null,
    similarity_threshold float default 0.95,
    match_count int default 1
)
returns table (
    id bigint,
    response jsonb,
    hit_count int,
    similarity float
)
language sql stable
as $$
    select
        r.id,
        r.response,
        r.hit_count,
        1 - (r.embedding <=> query_embedding) as similarity
    from cache_respostas r
    where r.embedding is not null
        and r.expires_at > now()
        and (filter_modo is null or r.modo = filter_modo)
        and 1 - (r.embedding <=> query_embedding) > similarity_threshold
    order by r.embedding <=> query_embedding
    limit match_count;
$$;

-- ============================================================================
-- 5. RLS
-- ============================================================================
-- O backend usa exclusivamente a service_role key (bypassa RLS por definição).
-- O anon key não é usado por nenhum client neste projeto. Habilitar RLS sem
-- nenhuma policy = nega tudo pra anon/authenticated, sem afetar o backend.

alter table curriculum_items enable row level security;
alter table questoes_vestibular enable row level security;
alter table llm_usage enable row level security;
alter table cache_respostas enable row level security;
alter table metodologias enable row level security;
alter table verbos_pedagogicos enable row level security;
alter table estrategias_didaticas enable row level security;
alter table progressao_didatica enable row level security;
alter table professores enable row level security;
alter table planos_salvos enable row level security;
