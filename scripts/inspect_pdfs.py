"""Inspeção exploratória dos 3 PDFs curriculares.

Objetivos:
- contar páginas
- amostrar texto de páginas iniciais, meio e final
- detectar padrões de código (BNCC e MS)
- estimar quantas habilidades existem
"""
from __future__ import annotations

import re
from pathlib import Path

import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parents[1]
PDFS = [
    ROOT / "data" / "bncc" / "raw" / "bncc-completa.pdf",
    ROOT / "data" / "curriculo_ms" / "raw" / "curriculo-ms-fund-em.pdf",
    ROOT / "data" / "curriculo_ms" / "raw" / "curriculo-ms-medio.pdf",
]

# Padrões conhecidos de códigos BNCC
# EI = Educação Infantil, EF = Ensino Fundamental, EM = Ensino Médio
BNCC_PATTERNS = [
    re.compile(r"\bEI\d{2}[A-Z]{2}\d{2}\b"),       # Ed Infantil: EI02CG01
    re.compile(r"\bEF\d{2}[A-Z]{2}\d{2}\b"),       # Fundamental: EF06HI01
    re.compile(r"\bEM13[A-Z]{2,4}\d{2,3}\b"),      # Médio: EM13CHS502
]


def sample_pages(doc: fitz.Document, indices: list[int]) -> dict[int, str]:
    out = {}
    for i in indices:
        if 0 <= i < doc.page_count:
            out[i] = doc[i].get_text("text")[:600]
    return out


def count_codes(full_text: str) -> dict[str, int]:
    counts = {}
    all_matches = []
    for p in BNCC_PATTERNS:
        ms = p.findall(full_text)
        all_matches.extend(ms)
    counts["total_matches"] = len(all_matches)
    counts["unique_codes"] = len(set(all_matches))
    # Quebra por etapa
    counts["EI"] = len([m for m in all_matches if m.startswith("EI")])
    counts["EF"] = len([m for m in all_matches if m.startswith("EF")])
    counts["EM"] = len([m for m in all_matches if m.startswith("EM")])
    return counts


for pdf_path in PDFS:
    print("=" * 80)
    print(f"PDF: {pdf_path.name}")
    print("=" * 80)
    if not pdf_path.exists():
        print("  [arquivo nao encontrado]")
        continue
    doc = fitz.open(pdf_path)
    n = doc.page_count
    print(f"Paginas: {n}")

    full = "".join(doc[i].get_text("text") for i in range(n))
    print(f"Caracteres totais: {len(full):,}")

    codes = count_codes(full)
    print(f"Codigos encontrados: {codes}")

    # Amostras
    samples = sample_pages(doc, [0, 1, n // 4, n // 2, 3 * n // 4, n - 1])
    for i, txt in samples.items():
        print(f"\n--- Pagina {i+1} (primeiros 400 chars) ---")
        print(txt[:400].replace("\n", " | "))

    doc.close()
    print()
