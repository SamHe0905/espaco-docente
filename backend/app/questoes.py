"""Busca semantica no banco de questoes de vestibular."""
from __future__ import annotations

from .embeddings import embed
from .schemas import Alternativa, QuestaoHit
from .supabase_client import get_client


def search_questoes(
    query: str,
    top_k: int = 8,
    disciplina: str | None = None,
    ano_min: int | None = None,
    ano_max: int | None = None,
) -> list[QuestaoHit]:
    vec = embed(query)
    client = get_client()
    resp = client.rpc(
        "match_questoes",
        {
            "query_embedding": vec,
            "match_count": top_k,
            "filter_disciplina": disciplina,
            "filter_ano_min": ano_min,
            "filter_ano_max": ano_max,
        },
    ).execute()

    hits: list[QuestaoHit] = []
    for row in resp.data or []:
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
                similarity=row["similarity"],
            )
        )
    return hits
