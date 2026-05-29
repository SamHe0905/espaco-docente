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
from .llm import LLMError
from .schemas import (
    GenerateRequest,
    GenerateResponse,
    SearchBNCCRequest,
    SearchBNCCResponse,
)
from .search import search_curriculum

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
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
