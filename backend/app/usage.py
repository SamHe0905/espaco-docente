"""Tracker em memoria do uso dos providers LLM.

Mantem janelas deslizantes de 60s (TPM/RPM) e 24h (TPD/RPD) por provider.
Nao persiste entre restarts — proposito e dar feedback ao vivo na UI.

Thread-safe via lock simples (FastAPI eh single-process, default uvicorn worker=1).
"""
from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, field

# Limites conhecidos de free tier por provider.
# Pode ser sobrescrito via env futuramente.
LIMITS: dict[str, dict[str, int | None]] = {
    "groq": {
        "rpm": 30,
        "tpm": 6_000,
        "rpd": 14_400,
        "tpd": 100_000,
    },
    "cerebras": {
        # Conservador — limites variam por modelo (gpt-oss-120b free)
        "rpm": 30,
        "tpm": 60_000,
        "rpd": 14_400,
        "tpd": 1_000_000,
    },
    "gemini": {
        # Gemini 3.1 Flash Lite free tier (conforme dashboard do usuario)
        "rpm": 15,
        "tpm": 250_000,
        "rpd": 500,
        "tpd": None,  # gemini geralmente nao tem TPD explicito; deixamos sem
    },
}

_WINDOW_MIN = 60.0           # janela TPM/RPM
_WINDOW_DAY = 24 * 60 * 60.0 # janela TPD/RPD


@dataclass
class _ProviderState:
    # cada entrada = (timestamp, tokens)
    minute: deque = field(default_factory=deque)
    day: deque = field(default_factory=deque)


class UsageTracker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: dict[str, _ProviderState] = {}

    def record(self, provider: str, tokens: int) -> None:
        now = time.time()
        with self._lock:
            st = self._state.setdefault(provider, _ProviderState())
            st.minute.append((now, tokens))
            st.day.append((now, tokens))
            self._cleanup(st, now)

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
