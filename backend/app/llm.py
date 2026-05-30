"""Cliente LLM com suporte a multiplos providers + fallback automatico.

Providers suportados (todos com API compativel OpenAI):
  - groq:      https://api.groq.com/openai/v1/chat/completions
  - cerebras:  https://api.cerebras.ai/v1/chat/completions

Comportamento:
  - chat() tenta o LLM_PROVIDER primario
  - se receber 429 (rate limit/cota) E houver fallback configurado,
    re-tenta automaticamente no LLM_FALLBACK_PROVIDER
"""
from __future__ import annotations

import re

import httpx

from .config import get_settings

PROVIDERS = {
    "groq":     "https://api.groq.com/openai/v1/chat/completions",
    "cerebras": "https://api.cerebras.ai/v1/chat/completions",
}


class LLMError(Exception):
    def __init__(self, message: str, kind: str = "generic") -> None:
        super().__init__(message)
        self.kind = kind


class LLMRateLimitError(LLMError):
    def __init__(self, message: str, retry_after_seconds: int | None = None) -> None:
        super().__init__(message, kind="rate_limit")
        self.retry_after_seconds = retry_after_seconds


def _parse_retry_after(body_text: str, headers) -> int | None:
    """Extrai 'try again in 42m21s' ou Retry-After dos headers."""
    m = re.search(r"in (\d+)m(\d+)", body_text or "")
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))
    h = headers.get("Retry-After") if headers else None
    if h and h.isdigit():
        return int(h)
    return None


async def _call_provider(
    provider: str,
    model: str,
    api_key: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    response_format: dict | None,
) -> str:
    if provider not in PROVIDERS:
        raise LLMError(f"Provider desconhecido: {provider}")
    url = PROVIDERS[provider]

    payload: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        payload["response_format"] = response_format

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            body_text = e.response.text or ""
            if status == 429:
                raise LLMRateLimitError(
                    f"{provider}: cota da IA esgotada por enquanto.",
                    retry_after_seconds=_parse_retry_after(body_text, e.response.headers),
                ) from e
            raise LLMError(
                f"{provider} {status}: {body_text[:200]}",
                kind="upstream",
            ) from e
        except httpx.HTTPError as e:
            raise LLMError(f"{provider}: erro de rede: {e}", kind="network") from e

    data = r.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise LLMError(f"{provider}: resposta inesperada: {data}") from e


async def chat(
    messages: list[dict],
    *,
    temperature: float = 0.4,
    max_tokens: int = 2000,
    response_format: dict | None = None,
) -> str:
    """Tenta provider primario; se 429, tenta fallback (se configurado)."""
    settings = get_settings()

    try:
        return await _call_provider(
            provider=settings.llm_provider,
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
        )
    except LLMRateLimitError as primary_error:
        # Se ha fallback configurado, tenta nele
        if (
            settings.llm_fallback_provider
            and settings.llm_fallback_api_key
            and settings.llm_fallback_model
        ):
            try:
                return await _call_provider(
                    provider=settings.llm_fallback_provider,
                    model=settings.llm_fallback_model,
                    api_key=settings.llm_fallback_api_key,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=response_format,
                )
            except LLMRateLimitError as fallback_error:
                # Ambos rate-limited
                retry = (
                    primary_error.retry_after_seconds
                    or fallback_error.retry_after_seconds
                )
                raise LLMRateLimitError(
                    "Ambos os provedores de IA estao com cota esgotada agora.",
                    retry_after_seconds=retry,
                )
            except LLMError as fallback_error:
                # Fallback falhou por outro motivo: reporta o erro primario
                raise primary_error from fallback_error
        # sem fallback configurado: propaga o erro primario
        raise
