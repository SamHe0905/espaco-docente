"""Estatisticas agregadas para dashboard admin.

Le de:
  - llm_usage (consumo de tokens por provider)
  - cache_respostas (hits e top temas)
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from .supabase_client import get_client


def _safe(fn):
    """Executa fn e retorna o resultado ou estrutura vazia em caso de erro."""
    try:
        return fn()
    except Exception as e:
        print(f"[admin] {fn.__name__}: {e}")
        return None


def _por_provider_30d() -> dict:
    """Total de tokens e requisicoes por provider nos ultimos 30 dias."""
    client = get_client()
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    resp = (
        client.table("llm_usage")
        .select("provider, tokens, created_at")
        .gte("created_at", since)
        .limit(200_000)
        .execute()
    )
    rows = resp.data or []

    by_provider: dict[str, dict] = defaultdict(lambda: {"tokens": 0, "requests": 0})
    by_day_provider: dict[tuple[str, str], int] = defaultdict(int)

    for r in rows:
        prov = r["provider"]
        tokens = int(r["tokens"] or 0)
        by_provider[prov]["tokens"] += tokens
        by_provider[prov]["requests"] += 1
        # bucket por dia (UTC)
        dia = r["created_at"][:10]  # YYYY-MM-DD
        by_day_provider[(dia, prov)] += 1

    # serie temporal: ultimos 30 dias preenchidos (zerando ausentes)
    hoje = datetime.now(timezone.utc).date()
    serie = []
    for d in range(29, -1, -1):
        dia = (hoje - timedelta(days=d)).isoformat()
        ponto = {"dia": dia}
        total = 0
        for prov in by_provider.keys():
            v = by_day_provider.get((dia, prov), 0)
            ponto[prov] = v
            total += v
        ponto["total"] = total
        serie.append(ponto)

    return {
        "por_provider": dict(by_provider),
        "serie_30d": serie,
    }


def _cache_top_temas() -> list[dict]:
    """Top 10 temas mais reaproveitados via cache."""
    client = get_client()
    resp = (
        client.table("cache_respostas")
        .select("request_summary, hit_count, modo, created_at")
        .gt("hit_count", 0)
        .order("hit_count", desc=True)
        .limit(10)
        .execute()
    )
    out = []
    for row in resp.data or []:
        summary = row.get("request_summary") or {}
        out.append({
            "tema": summary.get("tema"),
            "disciplina": summary.get("disciplina"),
            "etapa": summary.get("etapa"),
            "modo": row.get("modo"),
            "hits": int(row.get("hit_count") or 0),
        })
    return out


def _cache_resumo() -> dict:
    """Totais do cache."""
    client = get_client()
    # COUNT + SUM via RPC seria ideal, mas vamos fazer simples paginado
    resp = (
        client.table("cache_respostas")
        .select("id, hit_count, modo, created_at")
        .limit(50_000)
        .execute()
    )
    rows = resp.data or []
    total_entries = len(rows)
    total_hits = sum(int(r.get("hit_count") or 0) for r in rows)
    por_modo: dict[str, int] = defaultdict(int)
    for r in rows:
        por_modo[r.get("modo", "?")] += 1
    return {
        "total_entries": total_entries,
        "total_hits": total_hits,
        "por_modo": dict(por_modo),
    }


def stats() -> dict:
    """Snapshot consolidado pra dashboard."""
    por_provider = _safe(_por_provider_30d) or {"por_provider": {}, "serie_30d": []}
    top_temas = _safe(_cache_top_temas) or []
    cache = _safe(_cache_resumo) or {"total_entries": 0, "total_hits": 0, "por_modo": {}}

    # economia estimada: cada hit = 1 chamada de IA evitada
    # estimativa media de ~3500 tokens por geracao
    tokens_economizados_estimados = cache["total_hits"] * 3500

    return {
        "periodo_dias": 30,
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
        "por_provider": por_provider["por_provider"],
        "serie_30d": por_provider["serie_30d"],
        "cache": {
            **cache,
            "tokens_economizados_estimados": tokens_economizados_estimados,
        },
        "top_cache_temas": top_temas,
    }
