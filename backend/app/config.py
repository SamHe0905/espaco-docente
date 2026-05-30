"""Configuracao da aplicacao via pydantic-settings, lida de backend/.env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str

    # LLM — provider primario
    llm_provider: str = "groq"  # 'groq' ou 'cerebras'
    llm_model: str = "llama-3.3-70b-versatile"
    llm_api_key: str

    # LLM — provider fallback opcional (usado em caso de rate limit no primario)
    llm_fallback_provider: str | None = None  # ex 'cerebras'
    llm_fallback_model: str | None = None     # ex 'llama-3.3-70b'
    llm_fallback_api_key: str | None = None

    # Embeddings
    embedding_model: str = "BAAI/bge-m3"

    # App
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
