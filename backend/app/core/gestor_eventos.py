"""
Gestor de eventos en tiempo real — Patrón Observer
Cada conexión SSE activa registra una Queue.
Al publicar un evento, se entrega a todos los suscriptores relevantes.
"""
import asyncio
from datetime import datetime, timezone
from typing import Dict, Set


class GestorEventos:
    """
    Singleton que mantiene las colas de eventos de usuarios conectados.
    Estructura: { usuario_id: { queue1, queue2, ... } }
    Un usuario puede tener múltiples pestañas abiertas (múltiples queues).
    """
    _instancia = None

    def __new__(cls):
        if cls._instancia is None:
            cls._instancia = super().__new__(cls)
            cls._instancia._suscriptores: Dict[str, Set[asyncio.Queue]] = {}
            cls._instancia._suscriptores_proyecto: Dict[str, Set[asyncio.Queue]] = {}
        return cls._instancia

    # ── Suscripción de usuarios ──
    def suscribir_usuario(self, usuario_id: str) -> asyncio.Queue:
        """Registra una nueva conexión SSE para el usuario. Devuelve la queue."""
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._suscriptores.setdefault(usuario_id, set()).add(q)
        return q

    def desuscribir_usuario(self, usuario_id: str, q: asyncio.Queue) -> None:
        """Elimina la queue al cerrar la conexión SSE."""
        colas = self._suscriptores.get(usuario_id, set())
        colas.discard(q)
        if not colas:
            self._suscriptores.pop(usuario_id, None)

    # ── Suscripción de proyectos ──
    def suscribir_proyecto(self, proyecto_id: str, q: asyncio.Queue) -> None:
        """Registra la queue también en el canal del proyecto."""
        self._suscriptores_proyecto.setdefault(proyecto_id, set()).add(q)

    def desuscribir_proyecto(self, proyecto_id: str, q: asyncio.Queue) -> None:
        colas = self._suscriptores_proyecto.get(proyecto_id, set())
        colas.discard(q)
        if not colas:
            self._suscriptores_proyecto.pop(proyecto_id, None)

    # ── Publicación de eventos ──
    def publicar_a_usuario(self, usuario_id: str, evento: dict) -> None:
        """Entrega un evento a todas las conexiones activas del usuario."""
        evento["marca"] = datetime.now(timezone.utc).isoformat()
        for q in list(self._suscriptores.get(usuario_id, set())):
            try:
                q.put_nowait(evento)
            except asyncio.QueueFull:
                pass  # Cola llena — silenciar, no bloquear

    def publicar_a_proyecto(self, proyecto_id: str, evento: dict, excluir_usuario: str | None = None) -> None:
        """Entrega un evento a todos los miembros conectados al proyecto."""
        evento["marca"] = datetime.now(timezone.utc).isoformat()
        for q in list(self._suscriptores_proyecto.get(proyecto_id, set())):
            try:
                q.put_nowait(evento)
            except asyncio.QueueFull:
                pass

    def publicar_global(self, evento: dict) -> None:
        """Entrega un evento a TODOS los usuarios conectados (para ADMIN)."""
        evento["marca"] = datetime.now(timezone.utc).isoformat()
        for colas in self._suscriptores.values():
            for q in list(colas):
                try:
                    q.put_nowait(evento)
                except asyncio.QueueFull:
                    pass

    def usuarios_conectados(self) -> int:
        return len(self._suscriptores)

    def conexiones_totales(self) -> int:
        return sum(len(colas) for colas in self._suscriptores.values())


# Instancia global — Singleton
gestor_eventos = GestorEventos()


# ── Helpers para formatear eventos ──
def evento_tarea(accion: str, tarea: dict, usuario_nombre: str, proyecto_id: str) -> dict:
    iconos = {
        "CREADA":      "✚",
        "ACTUALIZADA": "✎",
        "MOVIDA":      "→",
        "ELIMINADA":   "✕",
        "CLONADA":     "⧉",
        "COMENTARIO":  "💬",
        "ASIGNADA":    "👤",
        "TIEMPO":      "⏱",
    }
    return {
        "tipo":       "actividad",
        "accion":     accion,
        "icono":      iconos.get(accion, "•"),
        "titulo":     tarea.get("titulo", ""),
        "tareaId":    tarea.get("_id", ""),
        "proyectoId": proyecto_id,
        "actor":      usuario_nombre,
    }


def evento_notificacion(notif: dict) -> dict:
    """Formatea una notificación para entrega SSE en tiempo real.
    Incluye metadatos de navegación para que el frontend pueda ir directo a la tarea.
    """
    return {
        "tipo":        "notificacion",
        "mensaje":     notif.get("mensaje", ""),
        "tipoNotif":   notif.get("tipo", ""),
        "id":          notif.get("_id", ""),
        "tareaId":     notif.get("tareaId"),
        "proyectoId":  notif.get("proyectoId"),
        "tituloTarea": notif.get("tituloTarea"),
    }


def evento_ping() -> dict:
    return {"tipo": "ping"}