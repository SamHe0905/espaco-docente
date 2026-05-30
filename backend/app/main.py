"""Espaco Docente — FastAPI entrypoint.

Endpoints:
  GET  /                         -> health
  POST /search-bncc              -> busca semantica curricular
  POST /generate                 -> RAG + Llama 3.3 -> planejamento humanizado
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .generation import gerar
from .llm import LLMError, LLMRateLimitError
from .questoes import search_questoes
from .schemas import (
    GenerateRequest,
    GenerateResponse,
    SearchBNCCRequest,
    SearchBNCCResponse,
    SearchQuestoesRequest,
    SearchQuestoesResponse,
)
from .search import search_curriculum
from .usage import tracker as usage_tracker

settings = get_settings()

app = FastAPI(
    title="Espaço Docente API",
    description="Apoio pedagógico para professores da escola pública brasileira.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def health() -> dict:
    return {"status": "ok", "service": "espaco-docente", "version": app.version}


@app.get("/llm-usage")
def get_llm_usage() -> dict:
    """Snapshot atual do uso dos providers LLM (TPM/RPM/TPD/RPD) e cache."""
    from .cache import metrics_snapshot as cache_metrics
    snap = usage_tracker.snapshot()
    snap["cache"] = cache_metrics()
    return snap


@app.get("/admin/stats")
def get_admin_stats() -> dict:
    """Estatisticas agregadas dos ultimos 30 dias pro dashboard admin."""
    from . import admin as admin_mod
    return admin_mod.stats()


@app.post("/search-bncc", response_model=SearchBNCCResponse)
def post_search(req: SearchBNCCRequest) -> SearchBNCCResponse:
    hits = search_curriculum(
        query=req.query,
        top_k=req.top_k,
        etapa=req.etapa,
        disciplina=req.disciplina,
    )
    return SearchBNCCResponse(hits=hits)


@app.post("/generate", response_model=GenerateResponse)
async def post_generate(req: GenerateRequest) -> GenerateResponse:
    try:
        return await gerar(req)
    except LLMRateLimitError as e:
        # 429: cota esgotada — front mostra mensagem humana
        retry_min = (
            f" Tente novamente em ~{e.retry_after_seconds // 60} min."
            if e.retry_after_seconds
            else ""
        )
        raise HTTPException(
            status_code=429,
            detail=(
                "A cota gratuita da IA acabou por enquanto."
                + retry_min
                + " Você pode esperar o reset ou ativar billing na Groq."
            ),
        )
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/search-questoes", response_model=SearchQuestoesResponse)
def post_search_questoes(req: SearchQuestoesRequest) -> SearchQuestoesResponse:
    hits = search_questoes(
        query=req.query,
        top_k=req.top_k,
        disciplina=req.disciplina,
        ano_min=req.ano_min,
        ano_max=req.ano_max,
        vestibulares=req.vestibulares,
    )
    return SearchQuestoesResponse(hits=hits)
