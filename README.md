# Espaço Docente

Plataforma de apoio pedagógico para professores da escola pública brasileira. Usa IA generativa + busca vetorial sobre BNCC e Currículo de Referência de MS para auxiliar planejamento, sequência didática, recomposição de aprendizagem e adaptação de atividades.

O professor segue sendo o centro do processo — a IA organiza e sugere, nunca decide.

## Stack

- **Frontend:** React + Vite + TypeScript + TailwindCSS + Framer Motion → Vercel
- **Backend:** Python + FastAPI → (host a definir: Render/Fly/Railway)
- **LLM:** Llama 3.3 70B via Groq (a confirmar)
- **Embeddings:** Sentence Transformers `BAAI/bge-m3` (locais, 1024 dim)
- **Banco:** Supabase (Postgres + pgvector)

## Estrutura

```
frontend/   App React
backend/    API FastAPI + RAG
data/       BNCC e Currículo MS (brutos e processados)
scripts/    Ingestão curricular e geração de embeddings
docs/       Decisões e documentação
```

## Rodar localmente

A definir após Fase 0.
