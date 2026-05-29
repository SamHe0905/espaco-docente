"""Teste manual da busca semantica.

Embedda algumas queries tipicas de professor e ve o que volta do match_curriculum.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.search import search_curriculum  # noqa: E402

QUERIES = [
    ("globalizacao", None, "Geografia"),
    ("revolucao industrial", None, "Historia"),
    ("equacoes do segundo grau", None, "Matematica"),
    ("interpretacao de texto", None, "Lingua Portuguesa"),
    ("celula e seus organelos", None, None),
    ("preconceito racial", None, None),
    ("brincadeiras infantis", "Educacao Infantil", None),
]

for query, etapa, disciplina in QUERIES:
    print(f"\n>>> Query: '{query}' (etapa={etapa}, disciplina={disciplina})")
    t = time.time()
    hits = search_curriculum(query, top_k=5, etapa=etapa, disciplina=disciplina)
    print(f"    [{time.time() - t:.2f}s, {len(hits)} hits]")
    for h in hits:
        print(f"  - {h.codigo} ({h.disciplina} / {h.serie}) sim={h.similarity:.3f}")
        print(f"      {(h.habilidades or '')[:150]}")
