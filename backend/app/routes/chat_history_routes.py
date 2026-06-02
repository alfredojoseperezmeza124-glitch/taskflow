"""
TaskFlow — Rutas de historial del asistente
Archivo: app/routers/chat_history_routes.py

Registra en main.py así:
    from app.routers.chat_history_routes import router as history_router
    app.include_router(history_router, prefix="/api/v1")

Endpoints expuestos:
    POST   /assistant/message          → guarda un mensaje
    GET    /assistant/history          → devuelve el historial de una sesión
    DELETE /assistant/history          → borra el historial de una sesión
"""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Importa la instancia singleton que ya existe en tu proyecto
from app.assistant.assistant import assistant  # ajusta si la ruta difiere

router = APIRouter(tags=["assistant-history"])

# ── Auth básica (reutiliza el Bearer token que usa el resto de la API) ─────────

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
) -> str:
    """Verifica que llegue un Bearer token. Devuelve el token como identificador.

    Reemplaza esta función por tu lógica real de autenticación si necesitas
    validar el JWT y extraer el user_id.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials  # token crudo; usa tu decode_jwt si aplica


# ── POST /assistant/message ────────────────────────────────────────────────────


@router.post(
    "/assistant/message",
    summary="Guardar un mensaje en el historial",
    status_code=status.HTTP_201_CREATED,
)
async def save_message(
    role: Annotated[str, Form(description="Rol del mensaje: 'user' o 'assistant'")],
    text: Annotated[str, Form(description="Contenido del mensaje")],
    session_id: Annotated[
        str, Form(description="ID de la sesión / proyecto (ej. el proyectoId del frontend)")
    ] = "default",
    _token: str = Depends(get_current_user),
):
    """Persiste un mensaje del chat en el historial de la sesión.

    El frontend lo llama con FormData tras cada turno de conversación.
    Devuelve el mensaje guardado con su timestamp UTC.
    """
    role = role.strip().lower()
    if role not in {"user", "assistant"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El campo 'role' debe ser 'user' o 'assistant'",
        )

    text = text.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El campo 'text' no puede estar vacío",
        )

    saved = assistant.save_message(session_id=session_id, role=role, text=text)
    return {"ok": True, "message": saved}


# ── GET /assistant/history ─────────────────────────────────────────────────────


@router.get(
    "/assistant/history",
    summary="Obtener el historial de una sesión",
)
async def get_history(
    session_id: Annotated[
        str,
        Query(description="ID de la sesión / proyecto"),
    ] = "default",
    limit: Annotated[
        int,
        Query(ge=1, le=500, description="Número máximo de mensajes a devolver (más recientes)"),
    ] = 200,
    _token: str = Depends(get_current_user),
):
    """Devuelve los últimos `limit` mensajes de la sesión indicada.

    El frontend lo llama al inicializar el asistente para repoblar
    el historial visual y el array de contexto enviado a Claude.
    """
    messages = assistant.get_history(session_id=session_id, limit=limit)
    return {"session_id": session_id, "history": messages, "count": len(messages)}


# ── DELETE /assistant/history ──────────────────────────────────────────────────


@router.delete(
    "/assistant/history",
    summary="Borrar el historial de una sesión",
)
async def delete_history(
    session_id: Annotated[
        str,
        Query(description="ID de la sesión / proyecto cuyo historial se borrará"),
    ] = "default",
    _token: str = Depends(get_current_user),
):
    """Elimina permanentemente el historial de la sesión indicada.

    Útil para el botón "Limpiar conversación" en el frontend.
    """
    deleted = assistant.delete_history(session_id=session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe historial para la sesión '{session_id}'",
        )
    return {"ok": True, "session_id": session_id, "detail": "Historial eliminado"}