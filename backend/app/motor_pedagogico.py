"""Motor Pedagogico — banco de elementos didaticos sorteados por aula.

Cada chamada de geracao monta um "kit pedagogico" rotacionando:
  - 1 metodologia por aula (filtrando por disciplina/etapa quando aplicavel)
  - 1 verbo do nivel de Bloom apropriado
  - 1 estrategia por momento (abertura/desenvolvimento/fechamento)
  - 1 progressao posicional (inicio/meio/fim) conforme N de aulas

Esses elementos sao injetados no prompt do LLM, dando direcao concreta
e variando entre requests. Reduz a tendencia da IA repetir-se e melhora
qualidade pedagogica sem aumentar tokens (sao palavras curtas).

Cache em memoria: ledo do Supabase 1 vez e reutilizado.
"""
from __future__ import annotations

import random
import threading
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from .supabase_client import get_client


@dataclass
class KitPedagogicoAula:
    """Elementos sorteados para uma aula especifica."""
    numero: int
    metodologia: str | None = None
    verbo: str | None = None
    estrategia_abertura: str | None = None
    estrategia_desenvolvimento: str | None = None
    estrategia_fechamento: str | None = None
    fase: str | None = None
    foco_fase: str | None = None


# ---------------------------------------------------------------------------
# Cache em memoria (carrega 1 vez por instancia)
# ---------------------------------------------------------------------------

_lock = threading.Lock()


def _safe_fetch(table: str) -> list[dict[str, Any]]:
    try:
        client = get_client()
        resp = client.table(table).select("*").eq("ativo", True).execute()
        return resp.data or []
    except Exception as e:
        print(f"[motor] falha ao ler {table}: {e}")
        return []


@lru_cache(maxsize=1)
def _metodologias() -> list[dict]:
    return _safe_fetch("metodologias")


@lru_cache(maxsize=1)
def _verbos() -> list[dict]:
    return _safe_fetch("verbos_pedagogicos")


@lru_cache(maxsize=1)
def _estrategias() -> list[dict]:
    return _safe_fetch("estrategias_didaticas")


@lru_cache(maxsize=1)
def _progressao() -> list[dict]:
    return _safe_fetch("progressao_didatica")


def recarregar() -> None:
    """Limpa caches — chamar se conteudo das tabelas mudar em runtime."""
    with _lock:
        _metodologias.cache_clear()
        _verbos.cache_clear()
        _estrategias.cache_clear()
        _progressao.cache_clear()


# ---------------------------------------------------------------------------
# Helpers de sorteio
# ---------------------------------------------------------------------------

def _filtra(itens: list[dict], chave: str, valor: str | None) -> list[dict]:
    """Filtra itens que tenham a coluna (list[text]) contendo o valor
    ou que tenham essa coluna nula (= serve pra qualquer)."""
    if not valor:
        return itens
    out = []
    for it in itens:
        lista = it.get(chave)
        if not lista or valor in lista:
            out.append(it)
    return out or itens  # se filtro for vazio, devolve tudo


def _sortear_metodologia(
    disciplina: str | None,
    etapa: str | None,
    ja_usadas: set[str],
) -> str | None:
    candidatas = _filtra(_metodologias(), "disciplinas", disciplina)
    candidatas = _filtra(candidatas, "etapas", etapa)
    # tenta evitar repetir as ja usadas
    novas = [m for m in candidatas if m["nome"] not in ja_usadas]
    pool = novas or candidatas
    if not pool:
        return None
    return random.choice(pool)["nome"]


def _sortear_verbo(taxonomia_desejada: str | None) -> str | None:
    verbos = _verbos()
    if not verbos:
        return None
    if taxonomia_desejada:
        filtrado = [v for v in verbos if v.get("taxonomia") == taxonomia_desejada]
        if filtrado:
            return random.choice(filtrado)["verbo"]
    return random.choice(verbos)["verbo"]


def _sortear_estrategia(momento: str) -> str | None:
    estr = [e for e in _estrategias() if e.get("momento") == momento]
    if not estr:
        return None
    return random.choice(estr)["nome"]


def _sortear_progressao(posicao: str) -> tuple[str, str] | None:
    progr = [p for p in _progressao() if p.get("posicao_relativa") == posicao]
    if not progr:
        return None
    p = random.choice(progr)
    return p["nome"], p.get("foco") or ""


def _posicao_para_aula(numero: int, total: int) -> str:
    """Decide posicao relativa (inicio/meio/fim) de uma aula no conjunto."""
    if total <= 1:
        return "meio"
    if numero == 1:
        return "inicio"
    if numero == total:
        return "fim"
    pct = (numero - 1) / max(total - 1, 1)
    if pct < 0.34:
        return "inicio"
    if pct > 0.66:
        return "fim"
    return "meio"


# Mapeia Bloom por fase (progressao tipica)
TAXONOMIA_POR_POSICAO = {
    "inicio": ["lembrar", "entender"],
    "meio":   ["entender", "aplicar", "analisar"],
    "fim":    ["analisar", "avaliar", "criar"],
}


# ---------------------------------------------------------------------------
# API publica
# ---------------------------------------------------------------------------

def montar_kit(
    numero: int,
    total: int,
    disciplina: str | None = None,
    etapa: str | None = None,
    ja_usadas: set[str] | None = None,
) -> KitPedagogicoAula:
    """Retorna um kit pedagogico para 1 aula especifica.

    ja_usadas: nomes de metodologias ja usadas em aulas anteriores deste plano,
    pra evitar repeticao excessiva no mesmo plano de aula.
    """
    ja_usadas = ja_usadas or set()
    pos = _posicao_para_aula(numero, total)

    bloom_options = TAXONOMIA_POR_POSICAO.get(pos, [])
    bloom_escolhido = random.choice(bloom_options) if bloom_options else None

    progr = _sortear_progressao(pos)
    fase = progr[0] if progr else None
    foco = progr[1] if progr else None

    return KitPedagogicoAula(
        numero=numero,
        metodologia=_sortear_metodologia(disciplina, etapa, ja_usadas),
        verbo=_sortear_verbo(bloom_escolhido),
        estrategia_abertura=_sortear_estrategia("abertura") if pos == "inicio" else None,
        estrategia_desenvolvimento=_sortear_estrategia("desenvolvimento"),
        estrategia_fechamento=_sortear_estrategia("fechamento") if pos == "fim" else None,
        fase=fase,
        foco_fase=foco,
    )


def montar_kits_para_plano(
    n_aulas: int,
    disciplina: str | None = None,
    etapa: str | None = None,
) -> list[KitPedagogicoAula]:
    """Retorna lista de kits, um por aula, evitando repeticao de metodologia."""
    ja: set[str] = set()
    kits = []
    for i in range(1, n_aulas + 1):
        kit = montar_kit(i, n_aulas, disciplina, etapa, ja)
        if kit.metodologia:
            ja.add(kit.metodologia)
        kits.append(kit)
    return kits


def kit_para_texto(kit: KitPedagogicoAula) -> str:
    """Formata um kit como bloco de texto pra colar no prompt do LLM."""
    linhas = []
    if kit.metodologia:
        linhas.append(f"metodologia: {kit.metodologia}")
    if kit.verbo:
        linhas.append(f"verbo principal: {kit.verbo}")
    if kit.fase:
        foco = f" ({kit.foco_fase})" if kit.foco_fase else ""
        linhas.append(f"fase: {kit.fase}{foco}")
    estr_partes = []
    if kit.estrategia_abertura:
        estr_partes.append(f"abertura={kit.estrategia_abertura}")
    if kit.estrategia_desenvolvimento:
        estr_partes.append(f"desenvolvimento={kit.estrategia_desenvolvimento}")
    if kit.estrategia_fechamento:
        estr_partes.append(f"fechamento={kit.estrategia_fechamento}")
    if estr_partes:
        linhas.append(f"estrategias: {', '.join(estr_partes)}")
    return " | ".join(linhas)
