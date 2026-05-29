"""Logica de busca semantica curricular."""
from __future__ import annotations

from .embeddings import embed
from .schemas import CurriculumHit
from .supabase_client import get_client


def search_curriculum(
    query: str,
    top_k: int = 5,
    etapa: str | None = None,
    disciplina: str | None = None,
) -> list[CurriculumHit]:
    """Busca habilidades curriculares por similaridade semantica.

    Usa a funcao RPC `match_curriculum` criada no Supabase.
    """
    vec = embed(query)
    client = get_client()
    resp = client.rpc(
        "match_curriculum",
        {
            "query_embedding": vec,
            "match_count": top_k,
            "filter_etapa": etapa,
            "filter_disciplina": disciplina,
        },
    ).execute()

    return [CurriculumHit(**row) for row in (resp.data or [])]


def get_by_codigo(codigo: str) -> CurriculumHit | None:
    """Recupera uma habilidade especifica pelo codigo BNCC ou MS."""
    client = get_client()
    # tenta exato em qualquer fonte
    resp = (
        client.table("curriculum_items")
        .select("codigo,fonte,etapa,serie,disciplina,habilidades,texto")
        .eq("codigo", codigo)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        return None
    r = rows[0]
    return CurriculumHit(
        codigo=r["codigo"],
        fonte=r["fonte"],
        etapa=r["etapa"],
        serie=r.get("serie"),
        disciplina=r.get("disciplina"),
        habilidades=r.get("habilidades"),
        texto=r["texto"],
        similarity=1.0,
    )
