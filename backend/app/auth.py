"""Autenticacao simples de professores: hash bcrypt + JWT HS256.

Sem email, sem recuperacao por email. Recuperacao via admin (reset de senha
no painel administrativo).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from .config import get_settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

TOKEN_TTL_DIAS = 30


def hash_senha(plain: str) -> str:
    return _pwd.hash(plain)


def verificar_senha(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return _pwd.verify(plain, hashed)
    except Exception:
        return False


def criar_token(prof_id: int, username: str) -> str:
    settings = get_settings()
    payload = {
        "sub": str(prof_id),
        "user": username,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DIAS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decodificar_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except Exception:
        return None
