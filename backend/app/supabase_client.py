"""Cliente Supabase singleton."""
from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from .config import get_settings


@lru_cache
def get_client() -> Client:
    settings = get_settings()
    # service_key porque algumas operacoes (RPC ja eh public) podem precisar
    # de bypass de RLS no futuro; pra busca leitura ja seria possivel com anon
    return create_client(settings.supabase_url, settings.supabase_service_key)
