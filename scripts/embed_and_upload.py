"""Gera embeddings (bge-m3) e faz upsert na tabela curriculum_items.

Device:
  - tenta DirectML (AMD GPU no Windows via torch-directml)
  - fallback CPU se nao disponivel ou se ocorrer erro no encode

Lotes:
  - encode: batch_size pequeno pra caber na VRAM (8 funciona bem em GPUs ~12GB)
  - upsert: 200 linhas por chamada Supabase (limite de payload razoavel)
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
load_dotenv(BACKEND / ".env")

BNCC = ROOT / "data" / "bncc" / "processed" / "bncc.json"
MS = ROOT / "data" / "curriculo_ms" / "processed" / "curriculo_ms.json"

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-m3")


def detect_device():
    """Retorna (device_obj_for_torch, label_str). Prefere DirectML."""
    try:
        import torch_directml  # type: ignore
        dev = torch_directml.device()
        name = torch_directml.device_name(0)
        return dev, f"DirectML ({name.strip()})"
    except Exception as e:
        print(f"[device] DirectML indisponivel: {e}; usando CPU", file=sys.stderr)
        return "cpu", "CPU"


def load_items() -> list[dict]:
    items: list[dict] = []
    for path in (BNCC, MS):
        if not path.exists():
            print(f"[warn] {path} nao existe; pulando")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        items.extend(data)
        print(f"Carregado {len(data)} de {path.name}")
    return items


def main() -> None:
    t0 = time.time()

    items = load_items()
    if not items:
        print("Nada pra processar.")
        return
    print(f"Total: {len(items)} itens curriculares")

    # imports pesados depois pra dar feedback rapido
    from sentence_transformers import SentenceTransformer
    from supabase import create_client

    device, device_label = detect_device()
    print(f"Device: {device_label}")
    print(f"Carregando modelo {EMBEDDING_MODEL} (pode baixar ~2.3 GB na primeira vez)...")
    model = SentenceTransformer(EMBEDDING_MODEL, device=device)
    print(f"Modelo carregado em {time.time() - t0:.1f}s")

    # textos a embeddar
    texts = [it["texto"] for it in items]

    print("Gerando embeddings...")
    t_emb = time.time()
    try:
        embeddings = model.encode(
            texts,
            batch_size=8,
            show_progress_bar=True,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
    except Exception as e:
        print(f"[device] erro no encode com {device_label}: {e}")
        if device != "cpu":
            print("[device] caindo pra CPU...")
            model = SentenceTransformer(EMBEDDING_MODEL, device="cpu")
            embeddings = model.encode(
                texts,
                batch_size=16,
                show_progress_bar=True,
                normalize_embeddings=True,
                convert_to_numpy=True,
            )
        else:
            raise
    print(f"Embeddings gerados em {time.time() - t_emb:.1f}s (shape {embeddings.shape})")

    # monta payload pro Supabase
    rows = []
    for it, emb in zip(items, embeddings):
        rows.append({
            "fonte": it["fonte"],
            "codigo": it["codigo"],
            "disciplina": it.get("disciplina"),
            "etapa": it["etapa"],
            "modalidade": it.get("modalidade", "regular"),
            "serie": it.get("serie"),
            "competencias": it.get("competencias", []),
            "habilidades": it.get("habilidades"),
            "objetos_conhecimento": it.get("objetos_conhecimento", []),
            "temas": it.get("temas", []),
            "palavras_chave": it.get("palavras_chave", []),
            "texto": it["texto"],
            "embedding": emb.tolist(),
        })

    print(f"Subindo {len(rows)} linhas para Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    table = client.table("curriculum_items")

    batch_size = 200
    uploaded = 0
    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        # upsert por (fonte, codigo) — chave unica no schema
        table.upsert(chunk, on_conflict="fonte,codigo").execute()
        uploaded += len(chunk)
        print(f"  {uploaded}/{len(rows)}")

    print(f"\nOK. Tempo total: {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
