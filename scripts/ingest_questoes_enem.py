"""Ingestao do banco de questoes ENEM via api.enem.dev.

Faz:
  1. Lista anos disponiveis (GET /v1/exams)
  2. Para cada ano e idioma (ingles/espanhol), pagina as questoes
     (GET /v1/exams/{ano}/questions)
  3. Normaliza pro nosso schema
  4. Gera embeddings com bge-m3
  5. Upserts em batches no Supabase
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
load_dotenv(BACKEND / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-m3")

API_BASE = "https://api.enem.dev/v1"

# Mapeamento de discipline retornado pela API pra nomes amigaveis
DISCIPLINA_NOME = {
    "ciencias-humanas":  "Ciencias Humanas e suas Tecnologias",
    "ciencias-natureza": "Ciencias da Natureza e suas Tecnologias",
    "linguagens":        "Linguagens, Codigos e suas Tecnologias",
    "matematica":        "Matematica e suas Tecnologias",
}


def fetch_years(client: httpx.Client) -> list[dict]:
    r = client.get(f"{API_BASE}/exams")
    r.raise_for_status()
    return r.json()


def _get_with_retry(client: httpx.Client, url: str, params: dict | None = None) -> httpx.Response:
    """GET com retry em 429 (rate limit) usando Retry-After ou backoff exponencial."""
    backoff = 2.0
    for attempt in range(6):
        r = client.get(url, params=params)
        if r.status_code != 429:
            return r
        # respeita Retry-After se vier
        retry_after = r.headers.get("Retry-After")
        wait = float(retry_after) if retry_after and retry_after.isdigit() else backoff
        print(f"  [429] aguardando {wait:.1f}s (tentativa {attempt + 1}/6)...")
        time.sleep(wait)
        backoff = min(backoff * 2, 30.0)
    return r  # devolve o ultimo (vai levantar no raise_for_status do chamador)


def fetch_questions(client: httpx.Client, year: int, language: str | None) -> list[dict]:
    out: list[dict] = []
    limit = 50
    offset = 0
    while True:
        params: dict = {"limit": limit, "offset": offset}
        if language:
            params["language"] = language
        r = _get_with_retry(client, f"{API_BASE}/exams/{year}/questions", params)
        if r.status_code == 404:
            return out
        r.raise_for_status()
        data = r.json()
        items = data.get("questions") or data.get("items") or []
        if not items:
            break
        out.extend(items)
        meta = data.get("metadata") or {}
        total = meta.get("total") or len(items)
        offset += limit
        if offset >= total:
            break
        time.sleep(1.0)  # rate limit baixo da api.enem.dev
    return out


def to_row(q: dict, year: int, language: str | None) -> dict | None:
    """Normaliza uma questao da API pro schema do Supabase."""
    discipline = q.get("discipline") or ""
    disciplina_nome = DISCIPLINA_NOME.get(discipline, discipline)
    correct = (q.get("correctAlternative") or "").upper()
    alternativas_in = q.get("alternatives") or []
    if not correct or not alternativas_in:
        return None

    alternativas = [
        {"letter": a.get("letter"), "text": a.get("text") or ""}
        for a in alternativas_in
        if a.get("letter")
    ]
    contexto = (q.get("context") or "").strip() or None
    enunciado = (q.get("alternativesIntroduction") or "").strip()
    if not enunciado:
        # fallback: usa contexto como enunciado se nao houver intro
        if contexto:
            enunciado = contexto
            contexto = None
        else:
            return None

    # texto pra embedding: tudo concatenado, sem alternativas (so as principais ideias)
    texto_busca = " ".join(filter(None, [contexto, enunciado]))[:3000]

    # imagens: extrai dos files anexos quando houver
    imagens: list[str] = []
    for f in q.get("files") or []:
        if isinstance(f, dict) and f.get("url"):
            imagens.append(f["url"])
        elif isinstance(f, str):
            imagens.append(f)

    return {
        "vestibular": "ENEM",
        "ano": year,
        "numero": q.get("index") or q.get("number") or 0,
        "disciplina": disciplina_nome,
        "area_enem": discipline,
        "idioma": language,
        "contexto": contexto,
        "enunciado": enunciado,
        "alternativas": alternativas,
        "gabarito": correct,
        "imagens": imagens,
        "texto_busca": texto_busca,
    }


def main() -> None:
    t0 = time.time()

    print("Listando anos disponiveis na API ENEM...")
    with httpx.Client(timeout=30, headers={"User-Agent": "espaco-docente/0.1"}) as client:
        years_data = fetch_years(client)
        years = sorted({int(y["year"]) for y in years_data})
        print(f"Anos: {years}")

        all_rows: list[dict] = []
        for year in years:
            # ENEM tem questoes de LE (1 a 5 sao espanhol OU ingles).
            # API retorna por idioma; sem language=, vem ambos os blocos misturados.
            # Vou pegar duas vezes: com espanhol e com ingles, dedupe por (ano, numero, idioma)
            for lang in (None,):  # passar None pega o pacote padrao
                qs = fetch_questions(client, year, lang)
                print(f"  {year} ({lang or 'default'}): {len(qs)} questoes")
                for q in qs:
                    # detectar idioma quando aplicavel
                    detected_lang = q.get("language") or None
                    row = to_row(q, year, detected_lang)
                    if row:
                        all_rows.append(row)

    print(f"\nTotal coletado: {len(all_rows)} questoes")
    if not all_rows:
        print("Nada a fazer.")
        return

    # dedupe por (vestibular, ano, numero, idioma)
    seen = set()
    deduped: list[dict] = []
    for r in all_rows:
        key = (r["vestibular"], r["ano"], r["numero"], r["idioma"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)
    print(f"Apos dedupe: {len(deduped)}")

    # salva snapshot local em data/questoes_enem/processed/
    out_dir = ROOT / "data" / "questoes_enem" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "enem_questoes.json"
    out_path.write_text(json.dumps(deduped, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Snapshot local: {out_path}")

    # imports pesados apenas agora
    print("\nCarregando modelo bge-m3 (~2.3GB primeira vez)...")
    from sentence_transformers import SentenceTransformer
    from supabase import create_client

    model = SentenceTransformer(EMBEDDING_MODEL, device="cpu")
    textos = [r["texto_busca"] for r in deduped]
    print(f"Gerando {len(textos)} embeddings...")
    embeddings = model.encode(
        textos,
        batch_size=8,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    rows_db = []
    for r, emb in zip(deduped, embeddings):
        rows_db.append({**r, "embedding": emb.tolist()})

    print(f"\nSubindo {len(rows_db)} linhas para Supabase...")
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    table = client.table("questoes_vestibular")
    BS = 100  # payload por embedding gigante, lote menor que curriculum
    for i in range(0, len(rows_db), BS):
        chunk = rows_db[i:i + BS]
        table.upsert(chunk, on_conflict="vestibular,ano,numero,idioma").execute()
        print(f"  {min(i + BS, len(rows_db))}/{len(rows_db)}")

    print(f"\nOK. Tempo total: {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
