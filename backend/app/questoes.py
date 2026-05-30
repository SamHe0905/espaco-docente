"""Busca semantica no banco de questoes de vestibular."""
from __future__ import annotations

from .embeddings import embed
from .schemas import Alternativa, QuestaoHit
from .supabase_client import get_client


# Abaixo desse valor, o resultado normalmente nao tem nada a ver com a query
# (textos de questao curtos + embedding bge-m3 produz similaridade baixa).
SIMILARIDADE_MINIMA = 0.42


def search_questoes(
    query: str,
    top_k: int = 8,
    disciplina: str | None = None,
    ano_min: int | None = None,
    ano_max: int | None = None,
) -> list[QuestaoHit]:
    vec = embed(query)
    client = get_client()
    # busca mais que o pedido pra ter margem depois de filtrar irrelevantes
    fetch_k = max(top_k * 2, top_k + 5)
    resp = client.rpc(
        "match_questoes",
        {
            "query_embedding": vec,
            "match_count": fetch_k,
            "filter_disciplina": disciplina,
            "filter_ano_min": ano_min,
            "filter_ano_max": ano_max,
        },
    ).execute()

    hits: list[QuestaoHit] = []
    # dedupe por (ano, numero) — algumas questoes vem em duas linguas (ingles+espanhol)
    seen: set[tuple[int, int]] = set()
    for row in resp.data or []:
        sim = row["similarity"]
        if sim < SIMILARIDADE_MINIMA:
            continue
        key = (row["ano"], row["numero"])
        if key in seen:
            continue
        seen.add(key)

        alts_raw = row.get("alternativas") or []
        alts = [Alternativa(**a) for a in alts_raw if isinstance(a, dict)]
        hits.append(
            QuestaoHit(
                id=row["id"],
                vestibular=row["vestibular"],
                ano=row["ano"],
                numero=row["numero"],
                disciplina=row.get("disciplina"),
                area_enem=row.get("area_enem"),
                idioma=row.get("idioma"),
                contexto=row.get("contexto"),
                enunciado=row["enunciado"],
                alternativas=alts,
                gabarito=row["gabarito"],
                imagens=row.get("imagens") or [],
                similarity=sim,
            )
        )
        if len(hits) >= top_k:
            break
    return hits
