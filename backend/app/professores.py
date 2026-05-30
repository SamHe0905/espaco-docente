"""Rotas de autenticacao e perfil dos professores.

Endpoints:
  POST /auth/register      (publico) — cria conta
  POST /auth/login         (publico) — retorna token JWT
  GET  /me                 (auth)    — dados do professor logado
  GET  /me/planos          (auth)    — lista planos salvos
  POST /me/planos          (auth)    — salva 1 plano
  DELETE /me/planos/{id}   (auth)    — exclui 1 plano

Admin:
  GET    /admin/professores                     — lista todos
  POST   /admin/professores/{id}/reset-senha    — reseta senha
  POST   /admin/professores/{id}/ativo          — ativa/desativa
"""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Header, HTTPException

from .auth import (
    criar_token,
    decodificar_token,
    hash_senha,
    verificar_senha,
)
from .schemas import (
    AtualizarAtivoRequest,
    LoginRequest,
    PlanoSalvoOut,
    ProfessorOut,
    RegisterRequest,
    ResetSenhaRequest,
    SalvarPlanoRequest,
    TokenResponse,
)
from .supabase_client import get_client

router = APIRouter()

RX_USERNAME = re.compile(r"^[a-z0-9_.-]{3,32}$")


# ---------------------------------------------------------------------------
# Dependency: professor autenticado via Bearer token
# ---------------------------------------------------------------------------

def professor_atual(
    authorization: str | None = Header(default=None),
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente")
    token = authorization.removeprefix("Bearer ").strip()
    payload = decodificar_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    try:
        prof_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Token inválido")
    client = get_client()
    resp = (
        client.table("professores")
        .select("id, username, nome_exibicao, ativo")
        .eq("id", prof_id)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=401, detail="Conta não existe mais")
    prof = rows[0]
    if not prof["ativo"]:
        raise HTTPException(status_code=403, detail="Conta desativada")
    return prof


# ---------------------------------------------------------------------------
# Autenticacao
# ---------------------------------------------------------------------------

@router.post("/auth/register", response_model=TokenResponse)
def register(req: RegisterRequest) -> TokenResponse:
    username = req.username.lower().strip()
    if not RX_USERNAME.match(username):
        raise HTTPException(
            status_code=400,
            detail="Usuário inválido. Use 3-32 caracteres entre letras minúsculas, números, '_', '.' ou '-'.",
        )

    client = get_client()
    existing = (
        client.table("professores")
        .select("id")
        .eq("username", username)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Esse usuário já existe")

    senha_hash = hash_senha(req.password)
    nome = (req.nome_exibicao or username).strip()
    inserted = (
        client.table("professores")
        .insert({
            "username": username,
            "senha_hash": senha_hash,
            "nome_exibicao": nome,
        })
        .execute()
    )
    row = inserted.data[0]
    prof_out = ProfessorOut(
        id=row["id"], username=row["username"],
        nome_exibicao=row.get("nome_exibicao"), ativo=True,
    )
    token = criar_token(prof_out.id, prof_out.username)
    return TokenResponse(token=token, user=prof_out)


@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest) -> TokenResponse:
    username = (req.username or "").lower().strip()
    if not username or not req.password:
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    client = get_client()
    resp = (
        client.table("professores")
        .select("*")
        .eq("username", username)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    prof = rows[0]
    if not prof["ativo"]:
        raise HTTPException(status_code=403, detail="Conta desativada — fale com o admin")
    if not verificar_senha(req.password, prof["senha_hash"]):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    prof_out = ProfessorOut(
        id=prof["id"], username=prof["username"],
        nome_exibicao=prof.get("nome_exibicao"), ativo=prof["ativo"],
    )
    return TokenResponse(token=criar_token(prof["id"], prof["username"]), user=prof_out)


# ---------------------------------------------------------------------------
# Perfil
# ---------------------------------------------------------------------------

@router.get("/me", response_model=ProfessorOut)
def get_me(prof: dict = Depends(professor_atual)) -> ProfessorOut:
    return ProfessorOut(**prof)


@router.get("/me/planos", response_model=list[PlanoSalvoOut])
def listar_planos(prof: dict = Depends(professor_atual)) -> list[PlanoSalvoOut]:
    client = get_client()
    resp = (
        client.table("planos_salvos")
        .select("*")
        .eq("professor_id", prof["id"])
        .order("criado_em", desc=True)
        .limit(500)
        .execute()
    )
    return [PlanoSalvoOut(**row) for row in (resp.data or [])]


@router.post("/me/planos", response_model=PlanoSalvoOut)
def salvar_plano(
    req: SalvarPlanoRequest, prof: dict = Depends(professor_atual)
) -> PlanoSalvoOut:
    client = get_client()
    inserted = (
        client.table("planos_salvos")
        .insert({
            "professor_id": prof["id"],
            "modo": req.modo,
            "tema": req.tema,
            "request_json": req.request_json,
            "response_json": req.response_json,
        })
        .execute()
    )
    return PlanoSalvoOut(**inserted.data[0])


@router.delete("/me/planos/{plano_id}")
def excluir_plano(
    plano_id: int, prof: dict = Depends(professor_atual)
) -> dict:
    client = get_client()
    client.table("planos_salvos").delete().eq("id", plano_id).eq(
        "professor_id", prof["id"]
    ).execute()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

@router.get("/admin/professores", response_model=list[ProfessorOut])
def admin_listar_professores() -> list[ProfessorOut]:
    """Lista todos os professores. Auth do admin e validada no main.py."""
    client = get_client()
    resp = (
        client.table("professores")
        .select("id, username, nome_exibicao, ativo, criado_em")
        .order("criado_em", desc=True)
        .limit(500)
        .execute()
    )
    return [ProfessorOut(**row) for row in (resp.data or [])]


@router.post("/admin/professores/{prof_id}/reset-senha")
def admin_reset_senha(prof_id: int, req: ResetSenhaRequest) -> dict:
    senha_hash = hash_senha(req.nova_senha)
    client = get_client()
    client.table("professores").update({"senha_hash": senha_hash}).eq(
        "id", prof_id
    ).execute()
    return {"ok": True, "nova_senha": req.nova_senha}


@router.post("/admin/professores/{prof_id}/ativo")
def admin_ativar_desativar(prof_id: int, req: AtualizarAtivoRequest) -> dict:
    client = get_client()
    client.table("professores").update({"ativo": req.ativo}).eq(
        "id", prof_id
    ).execute()
    return {"ok": True, "ativo": req.ativo}
