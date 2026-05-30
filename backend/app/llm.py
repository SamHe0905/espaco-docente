"""Cliente LLM com cadeia de N providers OpenAI-compativeis.

Providers suportados:
  - groq      https://api.groq.com/openai/v1/chat/completions
  - cerebras  https://api.cerebras.ai/v1/chat/completions
  - gemini    https://generativelanguage.googleapis.com/v1beta/openai/chat/completions

Comportamento:
  chat() tenta os providers da chain (LLM_CHAIN) em ordem.
  Se um da 429 (cota), tenta o proximo. Se todos falharem por cota,
  propaga LLMRateLimitError com mensagem agregada.
  Erros que nao sao 429 sao tambem encadeados (tenta proximo).
"""
from __future__ import annotations

import re

import httpx

from .config import get_settings

# URLs OpenAI-compativeis de cada provider
PROVIDERS_URL = {
    "groq":     "https://api.groq.com/openai/v1/chat/completions",
    "cerebras": "https://api.cerebras.ai/v1/chat/completions",
    "gemini":   "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
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
    if provider not in PROVIDERS_URL:
        raise LLMError(f"Provider desconhecido: {provider}")
    url = PROVIDERS_URL[provider]

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
                    f"{provider}: cota esgotada por enquanto.",
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
        msg = data["choices"][0]["message"]
    except (KeyError, IndexError) as e:
        raise LLMError(f"{provider}: resposta inesperada: {data}") from e
    # gpt-oss e modelos reasoning separam content de reasoning.
    # Preferimos content; se vazio, usamos reasoning como fallback.
    content = msg.get("content") or ""
    if not content:
        content = msg.get("reasoning") or ""
    if not content:
        raise LLMError(f"{provider}: resposta sem conteudo utilizavel: {data}")
    return content


async def chat(
    messages: list[dict],
    *,
    temperature: float = 0.4,
    max_tokens: int = 2000,
    response_format: dict | None = None,
) -> str:
    """Tenta cada provider da chain em ordem. Pula os sem api_key configurada."""
    settings = get_settings()
    chain = settings.get_chain()

    errors: list[LLMError] = []
    rate_limit_hits: list[LLMRateLimitError] = []
    skipped_no_key: list[str] = []

    for provider in chain:
        api_key, model = settings.get_provider_config(provider)
        if not api_key:
            skipped_no_key.append(provider)
            continue
        try:
            return await _call_provider(
                provider=provider,
                model=model,
                api_key=api_key,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )
        except LLMRateLimitError as e:
            rate_limit_hits.append(e)
            continue  # tenta proximo da cadeia
        except LLMError as e:
            errors.append(e)
            continue  # tenta proximo da cadeia

    # Todos os providers falharam.
    if rate_limit_hits and not errors:
        # Todos sao rate-limit -> erro de cota agregado
        retry = next(
            (e.retry_after_seconds for e in rate_limit_hits if e.retry_after_seconds),
            None,
        )
        nomes = ", ".join(chain)
        raise LLMRateLimitError(
            f"Todos os provedores de IA configurados ({nomes}) estao sem cota agora.",
            retry_after_seconds=retry,
        )

    if skipped_no_key and not errors and not rate_limit_hits:
        raise LLMError(
            "Nenhum provider LLM configurado tem API key. "
            f"Configure ao menos um dos: {', '.join(chain)} no .env",
        )

    # Houve erros nao-429: reporta o primeiro com contexto da cadeia
    if errors:
        primeiro = errors[0]
        raise LLMError(
            f"Todos providers da cadeia falharam. Primeiro erro: {primeiro}",
            kind=primeiro.kind,
        )

    raise LLMError("LLM chain vazia ou todos providers sem credenciais.")
