"""Cache de respostas geradas — exato + semantico.

Aplicado por modo (manifesto pedagogico):
  CACHE_MODES_ATIVOS = modos onde cache faz sentido (texto generico,
    pouca variacao por turma)
  Modos sensitivos (exercicios, recomp, adapt) sao SEMPRE regerados.

Camadas:
  1. Cache exato: hash determinístico de (modo, etapa, serie, disciplina,
     codigos, tema, foco, recursos, observacoes, prefs). Hit instantaneo.
  2. Cache semantico: embedding da consulta busca respostas similares
     com sim > 0.95. Hit se achar.

TTL padrao: 7 dias (configurado no expires_at default da tabela).
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from typing import Any

from .embeddings import embed
from .schemas import GenerateRequest, GenerateResponse
from .supabase_client import get_client

# Modos onde cache faz sentido (respostas generalizaveis)
CACHE_EXATO_MODES = {
    "plano_de_aula",
    "sugestao_de_aula",
    "projetos_e_trabalhos",
}

# Modos onde cache semantico tambem se aplica (respostas com alta tolerancia)
CACHE_SEMANTICO_MODES = {
    "plano_de_aula",
    "projetos_e_trabalhos",
}

SIMILARITY_THRESHOLD = 0.95

# Versao do prompt — incrementar quando o formato de output mudar.
# Faz com que respostas cacheadas com versao anterior nao sejam mais retornadas,
# evitando que mudancas de prompt fiquem "presas" 7 dias por causa do TTL.
PROMPT_VERSION = "v2-secoes-md"


# ---------------------------------------------------------------------------
# Hash determinístico
# ---------------------------------------------------------------------------

def _hash_request(req: GenerateRequest) -> str:
    """Hash SHA-256 dos campos relevantes pra cache exato.

    Quanto mais campos no hash, menor a chance de colisao indevida.
    Aulas (datas) NAO entram no hash — datas mudam a cada professor e
    nao afetam o conteudo pedagogico.
    """
    payload: dict[str, Any] = {
        "_prompt_version": PROMPT_VERSION,
        "modo": req.modo,
        "etapa": req.etapa,
        "serie": req.serie or "",
        "disciplina": req.disciplina,
        "tema": (req.tema or "").strip().lower(),
        "foco": (req.foco_especifico or "").strip().lower(),
        "codigos": sorted(req.codigos_efetivos()),
        "metodologia": (req.metodologia or "").strip().lower(),
        "recursos": (req.recursos or "").strip().lower(),
        "obs_turma": (req.observacoes_turma or "").strip().lower(),
        # campos por modo
        "lacuna": (req.lacuna_aprendizagem or "").strip().lower(),
        "defasagem": req.nivel_defasagem,
        "adapt_tipo": req.tipo_necessidade,
        "adapt_detail": (req.adaptacao_necessaria or "").strip().lower(),
        "apoios": (req.apoios_disponiveis or "").strip().lower(),
        "qtd_questoes": req.quantidade_questoes,
        "dificuldade": req.dificuldade,
        "tipo_questoes": req.tipo_questoes,
        "duracao": (req.duracao_projeto or "").strip().lower(),
        "produto": (req.produto_final or "").strip().lower(),
        "publico": (req.publico_apresentacao or "").strip().lower(),
        "tipo_recomp": req.tipo_recomposicao,
        # numero de aulas afeta tamanho/distribuicao
        "n_aulas": len(req.aulas),
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _texto_pra_embedding(req: GenerateRequest) -> str:
    """Texto curto que representa a 'intencao' do request, pra embedding."""
    partes = [
        req.modo,
        req.disciplina,
        req.etapa,
        req.tema or "",
        req.foco_especifico or "",
        " ".join(req.codigos_efetivos()),
    ]
    return " | ".join(p for p in partes if p)


# ---------------------------------------------------------------------------
# API publica
# ---------------------------------------------------------------------------

def hash_request(req: GenerateRequest) -> str:
    """API publica para obter o hash de uma request (uso externo)."""
    return _hash_request(req)


def cache_pode_usar(modo: str) -> bool:
    return modo in CACHE_EXATO_MODES


def cache_pode_semantico(modo: str) -> bool:
    return modo in CACHE_SEMANTICO_MODES


def cache_lookup_exato(req: GenerateRequest) -> tuple[GenerateResponse | None, str]:
    """Tenta cache exato. Retorna (resposta_ou_none, hash)."""
    h = _hash_request(req)
    if not cache_pode_usar(req.modo):
        return None, h
    try:
        client = get_client()
        resp = (
            client.table("cache_respostas")
            .select("id, response")
            .eq("hash_consulta", h)
            .gt("expires_at", "now()")
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            return None, h
        row = rows[0]
        # incrementa hit_count async
        _bump_hit_async(row["id"])
        return GenerateResponse(**row["response"]), h
    except Exception as e:
        print(f"[cache] lookup exato falhou: {e}")
        return None, h


def cache_lookup_semantico(req: GenerateRequest) -> GenerateResponse | None:
    """Tenta cache semantico. Retorna resposta_ou_none."""
    if not cache_pode_semantico(req.modo):
        return None
    try:
        vec = embed(_texto_pra_embedding(req))
        client = get_client()
        resp = client.rpc(
            "match_cache_semantico",
            {
                "query_embedding": vec,
                "filter_modo": req.modo,
                "similarity_threshold": SIMILARITY_THRESHOLD,
                "match_count": 1,
            },
        ).execute()
        rows = resp.data or []
        if not rows:
            return None
        row = rows[0]
        _bump_hit_async(row["id"])
        return GenerateResponse(**row["response"])
    except Exception as e:
        print(f"[cache] lookup semantico falhou: {e}")
        return None


def cache_save(req: GenerateRequest, resp: GenerateResponse, hash_consulta: str) -> None:
    """Grava resposta no cache (fire-and-forget pra nao bloquear)."""
    if not cache_pode_usar(req.modo):
        return

    def _job():
        try:
            embedding = None
            if cache_pode_semantico(req.modo):
                embedding = embed(_texto_pra_embedding(req))
            payload = {
                "hash_consulta": hash_consulta,
                "modo": req.modo,
                "request_summary": {
                    "tema": req.tema,
                    "foco": req.foco_especifico,
                    "disciplina": req.disciplina,
                    "etapa": req.etapa,
                    "serie": req.serie,
                    "codigos": req.codigos_efetivos(),
                },
                "response": resp.model_dump(mode="json"),
            }
            if embedding is not None:
                payload["embedding"] = embedding

            client = get_client()
            # upsert pra caso hash ja existe (race condition)
            client.table("cache_respostas").upsert(
                payload, on_conflict="hash_consulta"
            ).execute()
        except Exception as e:
            print(f"[cache] save falhou: {e}")

    threading.Thread(target=_job, daemon=True).start()


def _bump_hit_async(row_id: int) -> None:
    """Incrementa hit_count em background."""
    def _job():
        try:
            client = get_client()
            client.rpc(
                "match_cache_semantico", {}  # placeholder, vamos usar SQL direto
            )
            # supabase-py nao tem increment nativo; usa upsert/update
            client.table("cache_respostas").update(
                {"hit_count": _next_hit_count(row_id)}
            ).eq("id", row_id).execute()
        except Exception:
            pass
    threading.Thread(target=_job, daemon=True).start()


def _next_hit_count(row_id: int) -> int:
    """Le hit_count atual + 1 (com race condition aceitavel pra metric)."""
    try:
        client = get_client()
        r = (
            client.table("cache_respostas")
            .select("hit_count")
            .eq("id", row_id)
            .limit(1)
            .execute()
        )
        rows = r.data or []
        return (rows[0]["hit_count"] if rows else 0) + 1
    except Exception:
        return 1


# ---------------------------------------------------------------------------
# Metricas de cache (in-memory simples)
# ---------------------------------------------------------------------------

_metrics_lock = threading.Lock()
_metrics: dict[str, int] = {
    "exato_hits": 0,
    "semantico_hits": 0,
    "misses": 0,
    "skips_modo_sensivel": 0,
}


def metric_exato_hit() -> None:
    with _metrics_lock:
        _metrics["exato_hits"] += 1


def metric_semantico_hit() -> None:
    with _metrics_lock:
        _metrics["semantico_hits"] += 1


def metric_miss() -> None:
    with _metrics_lock:
        _metrics["misses"] += 1


def metric_skip() -> None:
    with _metrics_lock:
        _metrics["skips_modo_sensivel"] += 1


def metrics_snapshot() -> dict:
    with _metrics_lock:
        total = sum(_metrics.values())
        hits = _metrics["exato_hits"] + _metrics["semantico_hits"]
        hit_rate = (hits / total * 100) if total else 0.0
        return {
            **_metrics,
            "total": total,
            "hit_rate_pct": round(hit_rate, 1),
        }
