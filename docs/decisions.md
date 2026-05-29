# Decisões e pendências

## Pendentes (precisam de você)

### 1. Host do backend FastAPI
Vercel não roda FastAPI bem. Opções:
- **Render** — free tier dorme após 15min de ociosidade (ruim pro "intervalo entre aulas")
- **Fly.io** — free tier mais generoso, sem dormir
- **Railway** — pago desde o início, mas barato e rápido
- **Recomendação:** Fly.io para começar.

### 2. Provider Llama 3.3
- **Groq** — Llama 3.3 70B, latência baixíssima (~200ms), free tier ~14k req/dia. Recomendado.
- **Together AI** — também tem 3.3 70B, pago.
- **Auto-hospedar** — inviável (GPU cara).

### 3. Fontes do Currículo de Referência de MS
- BNCC: site MEC, formato disponível.
- Currículo MS: confirmar se existe versão em texto/JSON ou só PDF. Se só PDF mal-escaneado → adicionar etapa de OCR.

### 4. Supabase
Criar projeto novo (separado do Foco Pedagógico) e habilitar extensão `pgvector` no painel SQL:
```sql
create extension if not exists vector;
```

## Decididas

- Stack confirmada no manifesto (2026-05-29).
- Pasta: `C:\dev\espaco_docente`.
- Output: parágrafo único 40–60 palavras, formato `Aula X – [Código] – [Data]`.
- Limite: máx 5 aulas por geração.
- Embeddings locais com bge-m3 (1024 dim) — sem custo de API de embedding.
- Escopo curricular ampliado (2026-05-29): inclui Educação Infantil + Fundamental I + Fundamental II + Ensino Médio + Ensino Médio Técnico. (Manifesto original previa só Fund II+; usuário pediu ampliação.)

## Decisões de produto/UX (2026-05-29)

### Output das aulas: parágrafo corrido (manifesto)
- Cada aula = 1 parágrafo único de 40-60 palavras.
- Formato: `Aula X – [Código BNCC] – [DD/MM]`
- NÃO usar labels Objetivo:/Metodologia:/Recursos:/Avaliação:
- O mockup que o usuário mandou mostra estruturado, mas a decisão consciente foi manter o manifesto.
- **Por quê:** soar como "professor escrevendo de verdade" é central no projeto. Estruturado vira IA óbvia.
- **Aplicação:** o mockup vira casca visual (2 colunas, wizard 5 steps, painel de resultado). Mas cada aula no resultado mostra parágrafo corrido. Avaliação/Adaptações/Dica viram seções opcionais no fim do documento (não por aula).

### Histórico de planejamentos: localStorage
- Sem auth, sem cadastro. Salva no navegador.
- Botão "Meu histórico" lista planejamentos salvos localmente.
- Some se professor limpar cache ou mudar de dispositivo.

### Export: PDF + Word com normas ABNT
- Word: docx via biblioteca (provavelmente `docx` JS no frontend ou `python-docx` no backend)
- PDF: gerar via `react-pdf` ou backend
- ABNT básico: fonte Times New Roman ou Arial 12, espaçamento 1.5, margens 3cm/2cm/3cm/2cm, recuo 1.25cm primeiro parágrafo.
- Cabeçalho institucional: escola, professor, série, disciplina, data (campos opcionais no form).

### Outras decisões autônomas (escopo MVP completo)
- Stack frontend: React 18 + Vite + TS + Tailwind + Framer Motion + react-hook-form + zod
- State management: useReducer + Context (sem Zustand/Redux)
- Roteamento: state manual (single page app com modos)
- Limite hard de 5 aulas por geração
- Top-K busca BNCC: 5
- Retry do LLM se formato 40-60 palavras quebrar: 1 vez máximo
- Aviso ético em cada resultado: "Sugestão gerada por IA. Revise antes de usar."
- Duração padrão por aula: 50min, ajustável
