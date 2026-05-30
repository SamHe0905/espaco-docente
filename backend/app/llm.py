"""Cliente Groq para inferencia com Llama 3.3.

A Groq tem free tier generoso com latencia ~200ms; ideal pro objetivo de
"usar no intervalo entre aulas".
"""
from __future__ import annotations

import httpx

from .config import get_settings

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(Exception):
    def __init__(self, message: str, kind: str = "generic") -> None:
        super().__init__(message)
        self.kind = kind


class LLMRateLimitError(LLMError):
    def __init__(self, message: str, retry_after_seconds: int | None = None) -> None:
        super().__init__(message, kind="rate_limit")
        self.retry_after_seconds = retry_after_seconds


async def chat(
    messages: list[dict],
    *,
    temperature: float = 0.4,
    max_tokens: int = 2000,
    response_format: dict | None = None,
) -> str:
    """Chama Groq chat completions e retorna o conteudo do assistant."""
    settings = get_settings()
    payload: dict = {
        "model": settings.llm_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        payload["response_format"] = response_format

    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            r = await client.post(GROQ_URL, json=payload, headers=headers)
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            body_text = e.response.text or ""
            # Rate limit / cota -> erro especifico
            if status == 429:
                retry_after: int | None = None
                # tenta extrair "Please try again in 42m21.024s" do body
                import re as _re
                m = _re.search(r"in (\d+)m(\d+)", body_text)
                if m:
                    retry_after = int(m.group(1)) * 60 + int(m.group(2))
                else:
                    h = e.response.headers.get("Retry-After")
                    if h and h.isdigit():
                        retry_after = int(h)
                raise LLMRateLimitError(
                    "Cota da IA esgotada por hoje. Aguarde a renovacao ou ative billing.",
                    retry_after_seconds=retry_after,
                ) from e
            raise LLMError(
                f"Groq {status}: {body_text[:200]}",
                kind="upstream",
            ) from e
        except httpx.HTTPError as e:
            raise LLMError(f"Erro de rede ao chamar a IA: {e}", kind="network") from e

    data = r.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise LLMError(f"Resposta Groq inesperada: {data}") from e
