# Handoff — Espaço Docente

Documento de transferência de contexto entre sessões do Claude.
Atualizado em 2026-05-30.

## 1. O que é o projeto

Plataforma de apoio pedagógico para professores da escola pública brasileira.
Usa RAG (BNCC + Currículo MS) + chain de LLMs gratuitas + cache pra gerar:
Plano de Aula, Sugestão de Aula, Lista de Exercícios, Projetos, Recomposição
Paralela e Adaptação Educação Especial. Mais Banco de Questões reais ENEM
+ FUVEST + UNICAMP buscável e exportável.

## 2. Stack atual (tudo gratuito)

| Camada | Tecnologia | Onde está hospedado |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + Framer Motion + Lucide | **Vercel** — https://project-7ften.vercel.app |
| Backend | FastAPI + Python 3.12 + sentence-transformers (bge-m3) | **HuggingFace Space (Docker)** — https://espacodocente01-api.hf.space |
| Banco | Supabase Postgres + pgvector | URL: `https://bhparvrdqjztqbbgooqc.supabase.co` |
| LLMs (chain) | Groq → Cerebras → Gemini → OpenRouter | API keys em secrets do HF Space |
| Repositório git | GitHub (privado) | https://github.com/SamHe0905/espaco-docente |

## 3. Arquitetura

```
Professor
  ↓
Frontend Vercel
  ↓ (proxy /api → HF Space)
Backend HF Space
  ↓
[1] RAG Curricular (3412 itens BNCC + MS) [pgvector + bge-m3 local]
[2] Cache exato (hash determinístico do request)
[3] Cache semântico (embedding sim > 0.95)
[4] Motor pedagógico (metodologias/verbos/estratégias/fase rotacionando)
[5] LLM chain: Groq → Cerebras → Gemini → OpenRouter
  ↓
Resposta ao professor
```

## 4. Tabelas no Supabase

- `curriculum_items` — habilidades BNCC + MS (3412 linhas)
- `questoes_vestibular` — questões ENEM/FUVEST/UNICAMP (3945 linhas)
- `llm_usage` — uso histórico de tokens por provider (persistente)
- `cache_respostas` — cache exato + semântico de planos gerados
- `metodologias`, `verbos_pedagogicos`, `estrategias_didaticas`, `progressao_didatica` — motor pedagógico
- `professores` — auth simples (username + bcrypt senha_hash)
- `planos_salvos` — atividades salvas no perfil do professor

Funções RPC:
- `match_curriculum` — busca semântica em habilidades
- `match_questoes` — busca semântica em questões
- `match_cache_semantico` — busca em cache de respostas

## 5. Secrets do HF Space

Configurados via UI ou API (precisa do HF token):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `LLM_GROQ_API_KEY`, `LLM_CEREBRAS_API_KEY`, `LLM_GEMINI_API_KEY`, `LLM_OPENROUTER_API_KEY`
- `CORS_ORIGINS` (lista separada por vírgula)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` (painel admin)
- `JWT_SECRET` (assinar tokens de professor)

Token HF de write (pra fazer push e adicionar secrets via API):
- Salvo em `backend/.env` local
- API endpoint: `POST https://huggingface.co/api/spaces/espacodocente01/api/secrets`

## 6. Repositórios git separados

- **Frontend + backend principal**: `C:\dev\espaco_docente` → GitHub `SamHe0905/espaco-docente`
- **Mirror do backend pro HF Space**: `C:\dev\espaco-docente-hf` → HuggingFace
- Workflow: alterar em `espaco_docente`, copiar arquivos relevantes pra `espaco-docente-hf`, push em ambos
- `.github/workflows/keep-alive.yml` no GitHub principal pinga HF a cada 12h pra evitar sleep

## 7. Convenções

- Commits em português, formato `tipo(escopo): descrição` (ex: `feat(cache): cache seletivo`)
- Identidade git no projeto: `samuel@espacodocente.local` (depois trocado pra `287087782+SamHe0905@users.noreply.github.com` pra Vercel aceitar)
- Frontend: TypeScript strict, sem `any`, componentes funcionais, hooks
- Backend: type hints completos, Pydantic v2, FastAPI async, docstrings curtas

## 8. Fases já implementadas

| Fase | Conteúdo | Status |
|---|---|---|
| 0 | Setup repo, .gitignore, README | ✅ |
| 1 | Ingestão BNCC + Currículo MS (3412 itens) | ✅ |
| 2 | Backend FastAPI + RAG + chain LLM | ✅ |
| 3 | Frontend completo, 6 modos, design system | ✅ |
| 3.1 | Banco Questões ENEM + BLUEX | ✅ 3945 questões |
| 3.2 | Custom wizard por modo + toggle Aulas/Atividades | ✅ |
| 3.3 | Cache hit rate + Regerar + persistência usage | ✅ |
| A | Cache seletivo por modo + métricas | ✅ |
| B | OpenRouter como 4º provider | ✅ |
| C | Motor pedagógico (4 tabelas + rotação no prompt) | ✅ |
| D | Dashboard admin com gráficos | ✅ |
| Auth | Login admin + perfil de professores | ✅ código pronto |

## 9. ⚠️ Issue aberta (resolver no próximo chat)

**Endpoint `/auth/register` retornando resposta não-JSON** em produção (HF Space).
- Smoke test confirma `/auth/login` retorna 401 corretamente (endpoint existe)
- Mas `/auth/register` parece estar retornando HTML/string vazia em vez de JSON
- Frontend mostra "Not Found" ao tentar cadastrar
- Hipóteses:
  - Erro 500 no backend ao tentar inserir no Supabase (RLS bloqueando?)
  - bcrypt não instalou direito no Docker do HF
  - Tabela `professores` pode não ter sido criada (ou RLS muito restritiva)

**Como debugar:**
1. Olhar logs do HF Space → https://huggingface.co/spaces/espacodocente01/api/logs
2. Confirmar tabela `professores` existe no Supabase
3. Testar via curl: `curl -X POST .../auth/register -d '{"username":"x","password":"123456"}'`
4. Verificar se RLS da `professores` tá bloqueando inserts (service_role deve passar)

## 10. Próximos passos pendentes (caso usuário queira continuar)

- [ ] Resolver issue do `/auth/register`
- [ ] UI de gestão de professores no painel admin (listar, resetar senha, desativar)
- [ ] Migração automática de localStorage → perfil ao 1º login
- [ ] LGPD: termo de uso + política de privacidade básica
- [ ] (opcional) Multi-tenant por escola

## 11. URLs úteis pra próximo chat ter na mão

- **App público**: https://project-7ften.vercel.app
- **Backend API**: https://espacodocente01-api.hf.space
- **GitHub**: https://github.com/SamHe0905/espaco-docente (privado, owner SamHe0905)
- **HF Space**: https://huggingface.co/spaces/espacodocente01/api
- **Supabase Dashboard**: https://supabase.com/dashboard/project/bhparvrdqjztqbbgooqc

## 12. Como o próximo Claude deve operar

- Pasta de trabalho principal: `C:\dev\espaco_docente`
- Mirror HF: `C:\dev\espaco-docente-hf`
- Sempre rodar `npm run lint` (frontend) após mudanças
- Backend roda em HF Space — qualquer mudança requer git push em **ambos** os repos
- Vercel auto-deploya ao push no GitHub
- HF auto-builda ao push no repo HF (~2-5 min, layer do bge-m3 cacheada)
- Pra evitar HF sleep: cron-job no GitHub Actions já configurado (`.github/workflows/keep-alive.yml`)
- Pra adicionar secret no HF via API: `POST https://huggingface.co/api/spaces/espacodocente01/api/secrets` com Bearer token
