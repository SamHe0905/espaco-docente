"""Cliente Groq para inferencia com Llama 3.3.

A Groq tem free tier generoso com latencia ~200ms; ideal pro objetivo de
"usar no intervalo entre aulas".
"""
from __future__ import annotations

import httpx

from .config import get_settings

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(Exception):
    pass


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
            raise LLMError(f"Groq {e.response.status_code}: {e.response.text}") from e
        except httpx.HTTPError as e:
            raise LLMError(f"Groq erro de rede: {e}") from e

    data = r.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise LLMError(f"Resposta Groq inesperada: {data}") from e
