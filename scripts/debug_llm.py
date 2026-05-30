"""Debug: chama Groq direto e mostra raw output."""
from __future__ import annotations

import asyncio
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.llm import chat
from app.prompts import build_messages
from app.schemas import AulaInput, GenerateRequest
from app.search import get_by_codigo, search_curriculum


async def main(modo: str):
    req = GenerateRequest(
        modo=modo,
        etapa="Ensino Medio",
        serie="2 ano",
        disciplina="Ciencias Humanas e Sociais Aplicadas",
        tema="Globalizacao",
        codigos_bncc=["EM13CHS502"],
        aulas=[AulaInput(data=date(2026, 6, 12))],
    )

    hits = []
    for cod in req.codigos_efetivos():
        h = get_by_codigo(cod)
        if h:
            hits.append(h)
    hits.extend(search_curriculum(req.tema, top_k=5, etapa=req.etapa))
    hits = hits[:5]

    messages = build_messages(req, hits)
    print(f"=== SYSTEM PROMPT (len={len(messages[0]['content'])}) ===")
    print(messages[0]["content"][:1000])
    print("...")
    print(f"\n=== USER PROMPT (len={len(messages[1]['content'])}) ===")
    print(messages[1]["content"])
    print(f"\n=== CHAMANDO GROQ ===")
    raw = await chat(messages, temperature=0.5, max_tokens=4000)
    print(f"\n=== RAW OUTPUT ===")
    print(raw)
    print(f"\n=== TAMANHO: {len(raw)} chars ===")


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else "lista_de_exercicios"
    asyncio.run(main(modo))
