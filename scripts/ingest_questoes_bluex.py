"""Ingestao BLUEX (FUVEST + UNICAMP 2018-2024).

Dataset: github.com/Portuguese-Benchmark-Datasets/BLUEX
Esperado extraido em data/bluex/data/extracted/questions/{USP|UNICAMP}/{YYYY}[/day1|day2]/*.json
Imagens em                  data/bluex/data/extracted/imgs/{USP|UNICAMP}/{YYYY}/{numero}/*.jpg

Mapping:
  USP   -> vestibular="FUVEST"
  UNICAMP -> vestibular="UNICAMP"

Cada questao vira uma linha em questoes_vestibular usando o mesmo schema do ENEM.
Imagens sao referenciadas como markdown no enunciado: ![](https://raw...)
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
load_dotenv(BACKEND / ".env")

QUESTIONS_DIR = ROOT / "data" / "bluex" / "data" / "extracted" / "questions"

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-m3")

# URL bruta do GitHub pras imagens (clone era depth=1 do main)
GH_RAW = "https://raw.githubusercontent.com/Portuguese-Benchmark-Datasets/BLUEX/main/data/imgs/{path}"

INSTITUTION_TO_VESTIBULAR = {
    "USP": "FUVEST",
    "UNICAMP": "UNICAMP",
}

# Mapeamento BLUEX subject -> nossa "disciplina" (alinhada com BNCC EM)
SUBJECT_TO_DISCIPLINA = {
    "biology":      "Ciencias da Natureza e suas Tecnologias",
    "chemistry":    "Ciencias da Natureza e suas Tecnologias",
    "physics":      "Ciencias da Natureza e suas Tecnologias",
    "mathematics":  "Matematica e suas Tecnologias",
    "geography":    "Ciencias Humanas e Sociais Aplicadas",
    "history":      "Ciencias Humanas e Sociais Aplicadas",
    "philosophy":   "Ciencias Humanas e Sociais Aplicadas",
    "english":      "Linguagens, Codigos e suas Tecnologias",
    "portuguese":   "Linguagens, Codigos e suas Tecnologias",
}

# Pra debug/agrupamento mais fino, mantemos o subject original em area_enem
SUBJECT_TO_AREA = {
    "biology": "biologia",
    "chemistry": "quimica",
    "physics": "fisica",
    "mathematics": "matematica",
    "geography": "geografia",
    "history": "historia",
    "philosophy": "filosofia",
    "english": "ingles",
    "portuguese": "portugues",
}

# Regex pras alternativas: "a) texto" / "A) texto" / "(a)" etc
RX_ALT = re.compile(r"^\s*[\(\[]?\s*([a-eA-E])\s*[\)\.\]]\s*(.*)", re.DOTALL)


def parse_alternativa(raw: str) -> dict | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    m = RX_ALT.match(raw)
    if m:
        return {"letter": m.group(1).upper(), "text": m.group(2).strip()}
    # fallback: assume que ja vem so o texto
    return {"letter": "?", "text": raw}


def replace_image_placeholders(text: str, images: list[str]) -> str:
    """Substitui [IMAGE N] no texto por markdown ![](url) apontando pro GH raw.

    `images` traz paths relativos tipo 'imgs/USP/2018/1/0.jpg'.
    """
    out = text or ""
    for i, img_path in enumerate(images):
        url = GH_RAW.format(path=img_path.removeprefix("imgs/"))
        # placeholder pode aparecer como [IMAGE 0], [IMAGE0], [Image 0] etc
        out = re.sub(rf"\[\s*IMAGE\s*{i}\s*\]", f"![]({url})", out, flags=re.IGNORECASE)
    return out


def coletar_questoes() -> list[dict]:
    """Le todos os JSONs e normaliza pro nosso schema."""
    rows: list[dict] = []
    for json_path in QUESTIONS_DIR.rglob("*.json"):
        try:
            d = json.loads(json_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[warn] falha lendo {json_path}: {e}", file=sys.stderr)
            continue

        parts = json_path.relative_to(QUESTIONS_DIR).parts
        institution = parts[0]  # USP / UNICAMP
        ano = parts[1]
        try:
            ano_int = int(ano)
        except ValueError:
            continue
        vestibular = INSTITUTION_TO_VESTIBULAR.get(institution)
        if not vestibular:
            continue

        numero = d.get("number")
        if numero is None:
            continue

        # subject pode ser lista; usamos o primeiro (o mais relevante)
        subjects = d.get("subject") or []
        subj = subjects[0] if subjects else None
        disciplina = SUBJECT_TO_DISCIPLINA.get(subj) if subj else None
        area = SUBJECT_TO_AREA.get(subj) if subj else None

        enunciado_raw = (d.get("question") or "").strip()
        if not enunciado_raw:
            continue

        imgs = d.get("associated_images") or []
        enunciado = replace_image_placeholders(enunciado_raw, imgs)

        alts_raw = d.get("alternatives") or []
        alternativas = [a for a in (parse_alternativa(x) for x in alts_raw) if a]
        gabarito = (d.get("answer") or "").upper().strip()
        if not gabarito or not alternativas:
            continue

        # imagens referenciadas viram URLs em coluna jsonb imagens[]
        imagens_urls = [GH_RAW.format(path=p.removeprefix("imgs/")) for p in imgs]

        # texto_busca = enunciado limpo (sem markdown de imagem)
        texto_busca = re.sub(r"!\[.*?\]\(.*?\)", " ", enunciado).strip()[:3000]

        row = {
            "vestibular": vestibular,
            "ano": ano_int,
            "numero": int(numero),
            "disciplina": disciplina,
            "area_enem": area,  # reaproveitando coluna pra "subject"
            "idioma": None,
            "contexto": None,
            "enunciado": enunciado,
            "alternativas": alternativas,
            "gabarito": gabarito,
            "imagens": imagens_urls,
            "texto_busca": texto_busca,
            # dedup composite — algumas USP tem mesmo numero em dias diferentes
            "_dedup_extra": parts[2] if len(parts) > 3 else "",
        }
        rows.append(row)
    return rows


def main() -> None:
    t0 = time.time()

    print(f"Lendo JSONs em {QUESTIONS_DIR}...")
    rows = coletar_questoes()
    print(f"Coletadas: {len(rows)}")

    # Dedup leve por (vestibular, ano, numero, _dedup_extra)
    # — a UNICAMP 2021 tem day1/day2 entao deslocamos numeros do day2 +100
    final = []
    seen: set[tuple] = set()
    for r in rows:
        suf = r.pop("_dedup_extra", "")
        if suf == "day2":
            r["numero"] = r["numero"] + 1000  # garante unicidade
        key = (r["vestibular"], r["ano"], r["numero"], r["idioma"])
        if key in seen:
            continue
        seen.add(key)
        final.append(r)
    print(f"Apos dedup: {len(final)}")

    # breakdown
    from collections import Counter
    by_vest = Counter(r["vestibular"] for r in final)
    by_disc = Counter(r["disciplina"] for r in final)
    print("Por vestibular:", dict(by_vest))
    print("Top disciplinas:", by_disc.most_common(5))

    # snapshot local
    out_dir = ROOT / "data" / "bluex" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "bluex_questoes.json").write_text(
        json.dumps(final, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Snapshot salvo em {out_dir / 'bluex_questoes.json'}")

    print("\nCarregando modelo bge-m3...")
    from sentence_transformers import SentenceTransformer
    from supabase import create_client

    model = SentenceTransformer(EMBEDDING_MODEL, device="cpu")
    textos = [r["texto_busca"] for r in final]
    print(f"Gerando {len(textos)} embeddings...")
    embs = model.encode(
        textos,
        batch_size=8,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    payload = [{**r, "embedding": e.tolist()} for r, e in zip(final, embs)]
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
