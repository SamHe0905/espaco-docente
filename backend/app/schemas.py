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
    # Lista de codigos BNCC selecionados pelo professor (1 a N).
    # Aceita string unica (compat) ou lista.
    codigos_bncc: list[str] = Field(default_factory=list)
    codigo_bncc: str | None = None  # legado, ainda aceito
    aulas: list[AulaInput] = Field(..., min_length=1, max_length=5)
    metodologia: str | None = None
    recursos: str | None = None
    observacoes_turma: str | None = None

    # Campos especificos por modo (todos opcionais; relevantes so em alguns modos)
    # Recomposicao paralela:
    lacuna_aprendizagem: str | None = None
    nivel_defasagem: str | None = None  # 'leve' | 'media' | 'grave'
    tipo_recomposicao: str | None = None  # 'aula' (default) | 'atividades'

    # Adaptacao educacao especial:
    adaptacao_necessaria: str | None = None  # texto livre
    tipo_necessidade: str | None = None      # ex 'TEA', 'TDAH', 'Def. Visual'
    apoios_disponiveis: str | None = None

    # Lista de exercicios:
    quantidade_questoes: int | None = None   # 5..30
    dificuldade: str | None = None           # 'basico' | 'intermediario' | 'avancado' | 'misto'
    tipo_questoes: str | None = None         # 'objetivas' | 'discursivas' | 'mista'

    # Projetos e trabalhos:
    duracao_projeto: str | None = None       # ex '4 semanas'
    produto_final: str | None = None         # ex 'apresentacao', 'banner', 'video'
    publico_apresentacao: str | None = None  # ex 'turma', 'escola', 'familias'

    # Forca regeracao sem usar cache (botao "Regerar" no frontend)
    force_regenerate: bool = False

    @field_validator("aulas")
    @classmethod
    def _max5(cls, v):
        if len(v) > 5:
            raise ValueError("maximo 5 aulas por geracao")
        return v

    def codigos_efetivos(self) -> list[str]:
        """Retorna a lista final de codigos considerando ambos os campos."""
        result: list[str] = []
        for c in self.codigos_bncc:
            c = c.strip()
            if c and c not in result:
                result.append(c)
        if self.codigo_bncc:
            c = self.codigo_bncc.strip()
            if c and c not in result:
                result.append(c)
        return result


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
    # Origem da resposta: 'llm', 'cache_exato', 'cache_semantico'
    fonte: str = "llm"


# ---------------------------------------------------------------------------
# Banco de questoes de vestibular (ENEM)
# ---------------------------------------------------------------------------

class Alternativa(BaseModel):
    letter: str
    text: str


class QuestaoHit(BaseModel):
    id: int
    vestibular: str
    ano: int
    numero: int
    disciplina: str | None
    area_enem: str | None
    idioma: str | None
    contexto: str | None
    enunciado: str
    alternativas: list[Alternativa]
    gabarito: str
    imagens: list[str] = Field(default_factory=list)
    similarity: float


class SearchQuestoesRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    disciplina: str | None = None
    vestibulares: list[str] | None = None  # ex: ["ENEM", "FUVEST"]
    ano_min: int | None = None
    ano_max: int | None = None
    top_k: int = Field(8, ge=1, le=30)


class SearchQuestoesResponse(BaseModel):
    hits: list[QuestaoHit]
