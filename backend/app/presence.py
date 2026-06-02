"""Contador de sessoes ativas em tempo real (in-memory).

Cada cliente do frontend gera um session_id e faz POST /presence/ping a cada
15s. Sessoes sem ping ha mais de 35s sao consideradas offline.

Limitacoes (aceitas):
- Reinicio do HF Space zera o contador.
- Single-instance: se houvesse multiplos workers, cada um teria seu dict.
- Nao distingue user logado vs anonimo — apenas presenca.
"""
from __future__ import annotations

import threading
import time

# Janela de inatividade: sessoes sem ping ha mais que isso sao removidas.
TTL_SEGUNDOS = 35

_lock = threading.Lock()
_sessions: dict[str, float] = {}


def _prune_locked(now: float) -> None:
    """Remove sessoes antigas. Deve ser chamado com _lock segurado."""
    cutoff = now - TTL_SEGUNDOS
    expirados = [sid for sid, ts in _sessions.items() if ts < cutoff]
    for sid in expirados:
        del _sessions[sid]


def ping(session_id: str) -> int:
    """Marca a sessao como ativa agora e retorna o numero total de sessoes ativas."""
    now = time.time()
    with _lock:
        _sessions[session_id] = now
        _prune_locked(now)
        return len(_sessions)


def online_count() -> int:
    """Quantas sessoes estao ativas agora (sem alterar estado)."""
    now = time.time()
    with _lock:
        _prune_locked(now)
        return len(_sessions)
