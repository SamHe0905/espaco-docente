"""Tracker persistente do uso dos providers LLM.

Arquitetura hibrida:
  - Cache em memoria com janelas deslizantes (60s, 24h) -> snapshot rapido
  - Persiste cada registro na tabela llm_usage do Supabase
  - Na inicializacao, carrega ultimas 24h do banco -> sobrevive a restart

Thread-safe via lock simples (FastAPI single-process).
"""
from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

# Limites conhecidos de free tier por provider (atualizar quando providers mudam).
LIMITS: dict[str, dict[str, int | None]] = {
    "groq": {
        "rpm": 30,
        "tpm": 6_000,
        "rpd": 14_400,
        "tpd": 100_000,
    },
    "cerebras": {
        "rpm": 30,
        "tpm": 60_000,
        "rpd": 14_400,
        "tpd": 1_000_000,
    },
    "gemini": {
        "rpm": 15,
        "tpm": 250_000,
        "rpd": 500,
        "tpd": None,
    },
    "openrouter": {
        # Modelos :free do OpenRouter — limites bem conservadores
        "rpm": 20,
        "tpm": None,
        "rpd": 50,
        "tpd": None,
    },
}

_WINDOW_MIN = 60.0
_WINDOW_DAY = 24 * 60 * 60.0


@dataclass
class _ProviderState:
    minute: deque = field(default_factory=deque)  # (ts, tokens)
    day: deque = field(default_factory=deque)


class UsageTracker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict[str, _ProviderState] = {}
        self._loaded_from_db = False

    # ---------------------------------------------------------------------
    # Persistencia
    # ---------------------------------------------------------------------
    def _ensure_loaded_from_db(self) -> None:
        """Carrega ultimas 24h da tabela llm_usage pra dentro do cache."""
        if self._loaded_from_db:
            return
        self._loaded_from_db = True  # marca antes pra nao reentrar
        try:
            from .supabase_client import get_client
            client = get_client()
            since = (
                datetime.now(timezone.utc) - timedelta(seconds=_WINDOW_DAY)
            ).isoformat()
            resp = (
                client.table("llm_usage")
                .select("provider, tokens, created_at")
                .gte("created_at", since)
                .order("created_at", desc=False)
                .limit(50_000)
                .execute()
            )
            now = time.time()
            for row in resp.data or []:
                ts_str = row["created_at"]
                if ts_str.endswith("Z"):
                    ts_str = ts_str.replace("Z", "+00:00")
                ts = datetime.fromisoformat(ts_str).timestamp()
                tokens = int(row["tokens"])
                provider = row["provider"]
                st = self._state.setdefault(provider, _ProviderState())
                if ts > now - _WINDOW_MIN:
                    st.minute.append((ts, tokens))
                if ts > now - _WINDOW_DAY:
                    st.day.append((ts, tokens))
        except Exception as e:
            print(f"[usage] falha ao carregar do DB: {e}")

    def _persist_async(self, provider: str, tokens: int) -> None:
        """Grava 1 registro no Supabase em thread separada (fire-and-forget)."""
        def _job():
            try:
                from .supabase_client import get_client
                client = get_client()
                client.table("llm_usage").insert({
                    "provider": provider,
                    "tokens": tokens,
                }).execute()
            except Exception as e:
                print(f"[usage] falha ao persistir {provider}/{tokens}: {e}")

        threading.Thread(target=_job, daemon=True).start()

    # ---------------------------------------------------------------------
    # API publica
    # ---------------------------------------------------------------------
    def record(self, provider: str, tokens: int) -> None:
        now = time.time()
        with self._lock:
            self._ensure_loaded_from_db()
            st = self._state.setdefault(provider, _ProviderState())
            st.minute.append((now, tokens))
            st.day.append((now, tokens))
            self._cleanup(st, now)
        # persiste em background pra nao bloquear a resposta
        self._persist_async(provider, tokens)

    def _cleanup(self, st: _ProviderState, now: float) -> None:
        while st.minute and st.minute[0][0] < now - _WINDOW_MIN:
            st.minute.popleft()
        while st.day and st.day[0][0] < now - _WINDOW_DAY:
            st.day.popleft()

    def snapshot(self) -> dict:
        """Retorna estatisticas atuais de todos os providers conhecidos."""
        now = time.time()
        out: dict = {"providers": {}}
        with self._lock:
            self._ensure_loaded_from_db()
            providers = set(self._state.keys()) | set(LIMITS.keys())
            for p in sorted(providers):
                st = self._state.get(p)
                if st:
                    self._cleanup(st, now)
                    rpm = len(st.minute)
                    tpm = sum(t for _, t in st.minute)
                    rpd = len(st.day)
                    tpd = sum(t for _, t in st.day)
                else:
                    rpm = tpm = rpd = tpd = 0
                lim = LIMITS.get(p, {})
                out["providers"][p] = {
                    "rpm": rpm,
                    "tpm": tpm,
                    "rpd": rpd,
                    "tpd": tpd,
                    "limits": lim,
                }
        return out


tracker = UsageTracker()
