-- ============================================================
-- Espaço Docente — keep-alive que ESCREVE no banco
--
-- Rede de segurança do free tier. Antes, o único keep-alive tocava
-- o Supabase ATRAVÉS do backend (GET /keep-alive fazia um SELECT).
-- Quando o backend caiu (RUNTIME_ERROR no HF), o banco ficou sem
-- nenhum ping — e teria pausado se demorasse mais.
--
-- Agora o GitHub Actions também chama esta RPC DIRETO, sem depender
-- do backend. E é uma ESCRITA (não um SELECT): escrita conta como
-- atividade sob qualquer critério — leitura pura vinha não segurando
-- projetos free (visto no guia_cg em 2026-07).
--
-- Keep-alive só PREVINE a pausa. Projeto já pausado perde o DNS e só
-- volta por restauração manual no painel.
-- ============================================================

-- Tabela de uma linha só. Guarda apenas o carimbo da última atividade;
-- não tem dado de ninguém.
create table if not exists public.keep_alive (
  id smallint primary key default 1,
  visto_em timestamptz not null default now(),
  constraint keep_alive_uma_linha check (id = 1)
);

-- RLS ligado e sem policy (padrão deny-all do projeto): ninguém lê nem
-- escreve a tabela direto. A escrita entra só pela função abaixo.
alter table public.keep_alive enable row level security;

-- Carimba o timestamp e devolve o valor. security definer roda como dono
-- e ignora o RLS, então a chave pública (anon) dispara a escrita sem ter
-- permissão de escrever na tabela.
create or replace function public.tocar_keep_alive()
returns timestamptz
language sql security definer set search_path = public as $$
  insert into public.keep_alive (id, visto_em)
  values (1, now())
  on conflict (id) do update set visto_em = now()
  returning visto_em;
$$;

-- A anon pode EXECUTAR a função (o PostgREST expõe em /rpc), mas não
-- alcança a tabela. Superfície mínima: só bate um timestamp.
revoke all on function public.tocar_keep_alive() from public;
grant execute on function public.tocar_keep_alive() to anon, authenticated;
