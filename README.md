# Espaço Docente

Plataforma de apoio pedagógico para professores da escola pública brasileira. Usa IA generativa + busca vetorial (RAG) sobre BNCC e Currículo de Referência de Mato Grosso do Sul para auxiliar planejamento, sequência didática, recomposição de aprendizagem e adaptação de atividades.

O professor segue sendo o **centro do processo** — a IA organiza e sugere; nunca decide.

## 6 modos de geração

1. **Plano de Aula** — texto breve para registro escolar
2. **Sugestão de Aula** — roteiro mais detalhado
3. **Lista de Exercícios** — questões por nível
4. **Projetos e Trabalhos** — aprendizagem baseada em projetos
5. **Recomposição Paralela** — atividades focadas em lacunas
6. **Adaptação Ed. Especial** — material adaptado conforme necessidade

Cada aula é gerada como **parágrafo único de 40–60 palavras**, no formato `Aula X – [Código BNCC] – DD/MM`, como um professor experiente escreveria de fato.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS + Framer Motion
- **Backend:** Python 3.12 + FastAPI (Pydantic v2)
- **LLM:** Llama 3.3 70B via [Groq](https://groq.com) (free tier)
- **Embeddings:** `BAAI/bge-m3` (1024 dim, local, CPU)
- **Banco:** Supabase (Postgres + pgvector, HNSW + cosine distance)

## Estrutura

```
backend/        FastAPI: /search-bncc, /generate (RAG + Groq)
  app/
    main.py         entrypoint
    config.py       env vars
    schemas.py      Pydantic models
    search.py       busca vetorial via RPC
    embeddings.py   bge-m3 singleton
    supabase_client.py
    llm.py          cliente Groq async
    prompts.py      templates por modo
    generation.py   pipeline RAG -> LLM -> valida -> retry

frontend/       React app (Vite)
  src/
    App.tsx
    main.tsx
    screens/    HomeScreen, WizardScreen, HistoryScreen
    components/ Button, Input, StepBlock, HabilidadeBox, ResultPane...
    lib/        api, types, constants, storage, export (Word/PDF ABNT)

data/           BNCC + Currículo MS (raw PDFs e JSON processados)
scripts/        Parsers, embedder/uploader, validador de busca
docs/           Decisões do projeto
```

## Setup local

### Pré-requisitos
- Python 3.12+
- Node 20+
- Conta Supabase + Groq

### 1. Banco
No SQL Editor do Supabase, rode (uma vez):
```sql
create extension if not exists vector;
```
Schema, índices e função RPC `match_curriculum` estão no histórico desta conversa — execute na ordem.

### 2. Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# preencha .env (copiando .env.example)
uvicorn app.main:app --port 8000 --reload
```

### 3. Ingestão curricular (uma vez)
Coloque PDFs em `data/bncc/raw/` e `data/curriculo_ms/raw/`, depois:
```powershell
cd ..
backend\.venv\Scripts\python.exe scripts\parse_bncc.py
backend\.venv\Scripts\python.exe scripts\parse_curriculo_ms.py
backend\.venv\Scripts\python.exe scripts\embed_and_upload.py
```
Demora ~20 min em CPU. Faz upsert em `curriculum_items` — 3000+ habilidades.

### 4. Frontend
```powershell
cd frontend
npm install
# .env aponta VITE_API_URL pra http://localhost:8000 (proxy em /api)
npm run dev
```
Abre em http://localhost:5173.

## Notas técnicas

- **Latência alvo:** queries de RAG retornam em 200–700ms; geração completa (Groq) em 3–8s.
- **Privacidade:** sem auth no MVP, sem dados sensíveis. Histórico fica em `localStorage` do navegador.
- **Export:** Word e PDF aplicam **normas ABNT básicas** (Times New Roman 12, espaçamento 1.5, margens 3/2/3/2 cm, recuo 1.25 cm, paginação superior direita).
- **Aviso ético:** todo output traz disclaimer de IA e responsabilidade docente.

## Limitações conhecidas

- Llama 3.3 às vezes gera parágrafos abaixo do mínimo de 40 palavras (retry implementado, mas nem sempre corrige). Continuar afinando prompt em produção.
- Bundle frontend ~1MB (docx + jspdf são grandes). Code-splitting fica pra otimização posterior.
- Sem GPU local viável no Windows com AMD (DirectML quebra na bge-m3). Ingestão em CPU é one-shot, então OK; queries diárias são pequenas e rodam em ms na CPU.

## Decisões do projeto

Ver [docs/decisions.md](docs/decisions.md).
