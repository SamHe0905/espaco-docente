"""Sobe questoes_vestibular a partir dos snapshots locais (ENEM + BLUEX).

Diferente de ingest_questoes_enem.py / ingest_questoes_bluex.py, este script
NAO rebusca API nem reparseia dataset: usa os JSONs ja processados em
  data/questoes_enem/processed/enem_questoes.json
  data/bluex/processed/bluex_questoes.json
gera embeddings bge-m3 e faz upsert. Serve pra restaurar o banco rapido.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv

# Ver nota em embed_and_upload.py: destrava a bge-m3 na GPU AMD (DirectML).
import torch
torch.inference_mode = torch.no_grad

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
load_dotenv(BACKEND / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-m3")

SNAPSHOTS = [
    ROOT / "data" / "questoes_enem" / "processed" / "enem_questoes.json",
    ROOT / "data" / "bluex" / "processed" / "bluex_questoes.json",
]


def load_rows() -> list[dict]:
    rows: list[dict] = []
    for path in SNAPSHOTS:
        if not path.exists():
            print(f"[warn] {path} nao existe; pulando")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        rows.extend(data)
        print(f"Carregado {len(data)} de {path.name}")
    return rows


def main() -> None:
    t0 = time.time()

    rows = load_rows()
    if not rows:
        print("Nada pra processar.")
        return
    print(f"Total: {len(rows)} questoes")

    from sentence_transformers import SentenceTransformer
    from supabase import create_client

    # Prefere GPU (DirectML); cai pra CPU se indisponivel ou se der erro.
    try:
        import torch_directml  # type: ignore
        device = torch_directml.device()
        device_label = f"DirectML ({torch_directml.device_name(0).strip()})"
    except Exception as e:
        print(f"[device] DirectML indisponivel: {e}; usando CPU")
        device, device_label = "cpu", "CPU"

    print(f"Device: {device_label}")
    print(f"Carregando modelo {EMBEDDING_MODEL}...")
    model = SentenceTransformer(EMBEDDING_MODEL, device=device)
    print(f"Modelo carregado em {time.time() - t0:.1f}s")

    textos = [r.get("texto_busca") or r.get("enunciado") or "" for r in rows]
    print("Gerando embeddings...")
    t_emb = time.time()
    try:
        embeddings = model.encode(
            textos,
            batch_size=8,
            show_progress_bar=True,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
    except Exception as e:
        print(f"[device] erro no encode com {device_label}: {e}; caindo pra CPU...")
        model = SentenceTransformer(EMBEDDING_MODEL, device="cpu")
        embeddings = model.encode(
            textos,
            batch_size=16,
            show_progress_bar=True,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
    print(f"Embeddings gerados em {time.time() - t_emb:.1f}s (shape {embeddings.shape})")

    payload = [{**r, "embedding": e.tolist()} for r, e in zip(rows, embeddings)]

    print(f"Subindo {len(payload)} linhas para Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    table = client.table("questoes_vestibular")
    BS = 100
    for i in range(0, len(payload), BS):
        chunk = payload[i:i + BS]
        table.upsert(chunk, on_conflict="vestibular,ano,numero,idioma").execute()
        print(f"  {min(i + BS, len(payload))}/{len(payload)}")

    print(f"\nOK. Tempo total: {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
