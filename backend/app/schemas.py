"""Schemas Pydantic compartilhados pelos endpoints."""
from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Busca BNCC
# ---------------------------------------------------------------------------

class SearchBNCCRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    etapa: str | None = None
    disciplina: str | None = None
    top_k: int = Field(5, ge=1, le=20)


class CurriculumHit(BaseModel):
    codigo: str
    fonte: str
    etapa: str | None
    serie: str | None
    disciplina: str | None
    habilidades: str | None
    texto: str
    similarity: float


class SearchBNCCResponse(BaseModel):
    hits: list[CurriculumHit]


# ---------------------------------------------------------------------------
# Geracao
# ---------------------------------------------------------------------------

Modo = Literal[
    "plano_de_aula",
    "sugestao_de_aula",
    "lista_de_exercicios",
    "projetos_e_trabalhos",
    "recomposicao_paralela",
    "adaptacao_educacao_especial",
]


class AulaInput(BaseModel):
    data: date
    observacoes: str | None = None


class GenerateRequest(BaseModel):
    modo: Modo
    etapa: str
    serie: str | None = None
    disciplina: str
    tema: str = Field(..., min_length=2)
    foco_especifico: str | None = None
    codigo_bncc: str | None = None
    aulas: list[AulaInput] = Field(..., min_length=1, max_length=5)
    metodologia: str | None = None
    recursos: str | None = None
    observacoes_turma: str | None = None
    adaptacao_necessaria: str | None = None  # so usado pelo modo adaptacao
    lacuna_aprendizagem: str | None = None    # so usado pelo modo recomposicao

    @field_validator("aulas")
    @classmethod
    def _max5(cls, v):
        if len(v) > 5:
            raise ValueError("maximo 5 aulas por geracao")
        return v


class AulaOutput(BaseModel):
    numero: int
    codigo_bncc: str | None
    data: date
    texto: str  # paragrafo corrido 40-60 palavras
    palavras: int


class GenerateResponse(BaseModel):
    modo: Modo
    tema: str
    aulas: list[AulaOutput]
    habilidades_usadas: list[CurriculumHit]
    aviso: str = (
        "Sugestão gerada por IA. O professor é responsável pela validação "
        "pedagógica antes do uso em sala de aula."
    )
