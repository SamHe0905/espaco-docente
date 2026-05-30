"""Logica de busca semantica curricular."""
from __future__ import annotations

import re

from .embeddings import embed
from .schemas import CurriculumHit
from .supabase_client import get_client

# Codigos BNCC/MS: EI01EO01, EF06HI01, EM13CHS502, MS.EF05LP22.s.22, MS.EM13MAT2.n.01
RX_CODIGO = re.compile(
    r"^("
    r"(EI|EF|EM)\d{2}[A-Z]{2,4}\d{1,3}|"
    r"MS\.(EI|EF|EM)\d{2}[A-Z]{2,4}\d{1,3}(\.\s*[a-z]\.\s*\d{1,3})?"
    r")$",
    re.IGNORECASE,
)


def is_code(query: str) -> bool:
    return bool(RX_CODIGO.match(query.strip()))


def search_curriculum(
    query: str,
    top_k: int = 5,
    etapa: str | None = None,
    disciplina: str | None = None,
) -> list[CurriculumHit]:
    """Busca habilidades curriculares.

    - Se query parece um codigo BNCC/MS: tenta exact match. Se achar,
      complementa com top-N por similaridade ao TEXTO daquele item.
    - Caso contrario: busca semantica direta via RPC.
    """
    query = query.strip()

    if is_code(query):
        # Normaliza pra caso o usuario digite em lowercase
        codigo_normalizado = query.upper().replace(" ", "")
        # Codigos MS tem sufixo .s.NN em lowercase
        codigo_normalizado = re.sub(
            r"\.([A-Z])\.", lambda m: f".{m.group(1).lower()}.", codigo_normalizado
        )
        # Match exato direto
        client = get_client()
        resp = (
            client.table("curriculum_items")
            .select("codigo,fonte,etapa,serie,disciplina,habilidades,texto")
            .eq("codigo", codigo_normalizado)
            .limit(1)
            .execute()
        )
        hits: list[CurriculumHit] = []
        if resp.data:
            r = resp.data[0]
            hits.append(
                CurriculumHit(
                    codigo=r["codigo"],
                    fonte=r["fonte"],
                    etapa=r["etapa"],
                    serie=r.get("serie"),
                    disciplina=r.get("disciplina"),
                    habilidades=r.get("habilidades"),
                    texto=r["texto"],
                    similarity=1.0,
                )
            )
            # Complementa com proximos por similaridade ao texto encontrado
            if top_k > 1:
                extras = _semantic_search(
                    r["texto"], top_k - 1, etapa, disciplina
                )
                for e in extras:
                    if e.codigo != codigo_normalizado:
                        hits.append(e)
            return hits[:top_k]
        # Sem match exato — cai pra semantica
    return _semantic_search(query, top_k, etapa, disciplina)


def _semantic_search(
    query: str,
    top_k: int,
    etapa: str | None,
    disciplina: str | None,
) -> list[CurriculumHit]:
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
