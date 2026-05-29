"""Gerador de embeddings via bge-m3 carregado uma vez (CPU)."""
from __future__ import annotations

from functools import lru_cache

from sentence_transformers import SentenceTransformer

from .config import get_settings


@lru_cache
def get_model() -> SentenceTransformer:
    settings = get_settings()
    # CPU pra evitar mesma dor de cabeca do DirectML no Windows com AMD
    return SentenceTransformer(settings.embedding_model, device="cpu")


def embed(text: str) -> list[float]:
    """Gera um embedding L2-normalizado de um texto."""
    model = get_model()
    vec = model.encode(
        [text],
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )[0]
    return vec.tolist()
