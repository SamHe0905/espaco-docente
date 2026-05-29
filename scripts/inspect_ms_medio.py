"""Inspecao especifica do PDF do EM do MS pra entender padroes de codigo."""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "data" / "curriculo_ms" / "raw" / "curriculo-ms-medio.pdf"

doc = fitz.open(PDF)
full = "\n".join(p.get_text("text") for p in doc)
doc.close()

# Procura varios padroes
patterns = {
    "MS.XXX.s.NN": re.compile(r"\bMS\.[A-Z0-9]+\.[a-z]\.\d{1,3}\b"),
    "EM13XXX###":  re.compile(r"\bEM13[A-Z]{2,4}\d{2,3}\b"),
    "MS.EM13XXX (sem .s.NN)": re.compile(r"\bMS\.EM13[A-Z]{2,4}\d{2,3}\b"),
}
for name, rx in patterns.items():
    matches = rx.findall(full)
    print(f"{name}: {len(matches)} total, {len(set(matches))} unicos")
    if matches:
        print(f"   amostras: {list(set(matches))[:5]}")

# Encontra todas as paginas que tem "EM13" e mostra contexto da primeira ocorrencia significativa
print("\n--- contexto de 3 ocorrencias do meio do PDF ---")
em13_positions = [m.start() for m in re.finditer(r"\bEM13[A-Z]{2,4}\d{2,3}\b", full)]
for i in (len(em13_positions) // 4, len(em13_positions) // 2, 3 * len(em13_positions) // 4):
    if 0 <= i < len(em13_positions):
        p = em13_positions[i]
        ctx = full[max(0, p - 100):p + 400].replace("\n", " | ")
        print(f"\npos {p}: ...{ctx}...")
