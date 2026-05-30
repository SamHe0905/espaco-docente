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

    # ---- LLM em cadeia ----
    # Define a ordem dos providers tentados. Ex: "groq,cerebras,gemini"
    # Quando um da 429 (rate limit), tenta o proximo da fila automaticamente.
    llm_chain: str = "groq"

    # Cada provider tem chave + modelo proprio (todos opcionais).
    llm_groq_api_key: str | None = None
    llm_groq_model: str = "llama-3.3-70b-versatile"

    llm_cerebras_api_key: str | None = None
    llm_cerebras_model: str = "llama-3.3-70b"

    llm_gemini_api_key: str | None = None
    llm_gemini_model: str = "gemini-2.0-flash-lite"

    # --- compat retroativo (deprecated) ---
    # Se llm_chain="groq" e llm_groq_api_key vazia, usa estes:
    llm_provider: str | None = None
    llm_model: str | None = None
    llm_api_key: str | None = None

    def get_chain(self) -> list[str]:
        items = [p.strip().lower() for p in self.llm_chain.split(",") if p.strip()]
        return items or ["groq"]

    def get_provider_config(self, provider: str) -> tuple[str | None, str]:
        """Retorna (api_key, model) pro provider. Aplica compat retroativo."""
        p = provider.lower()
        if p == "groq":
            key = self.llm_groq_api_key or (
                self.llm_api_key
                if (self.llm_provider or "groq").lower() == "groq"
                else None
            )
            return (key, self.llm_groq_model)
        if p == "cerebras":
            return (self.llm_cerebras_api_key, self.llm_cerebras_model)
        if p == "gemini":
            return (self.llm_gemini_api_key, self.llm_gemini_model)
        return (None, "")

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
