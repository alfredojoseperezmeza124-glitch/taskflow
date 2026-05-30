from __future__ import annotations
import asyncio
from abc import ABC, abstractmethod
from typing import Any

from app.db.conexion import ConexionMongoDB
from app.patterns.adapter.proveedor_notificacion import ProveedorNotificacion
from app.patterns.adapter.notificacion_adapter import SolicitudNotificacion
from app.patterns.observer.eventos import (
    EventoDominio,
    TareaCreadaEvento,
    TareaMovidaEvento,
    TareaActualizadaEvento,
    ComentarioAgregadoEvento,
    BugUrgenteDetectadoEvento,
)
from app.services.servicio_notificacion import crear_notificacion_interna, obtener_preferencias, enviar_notificacion_externa


class ObservadorEvento(ABC):
    @abstractmethod
    async def actualizar(self, evento: EventoDominio) -> None:
        ...


class ObservadorSSE(ObservadorEvento):
    async def actualizar(self, evento: EventoDominio) -> None:
        from app.core.gestor_eventos import gestor_eventos

        payload = {
            "tipo": "evento_dominio",
            "evento": evento.serializar(),
        }
        for usuario_id in evento.usuarios_destino:
            gestor_eventos.publicar_a_usuario(usuario_id, payload)

        if evento.proyecto_id:
            gestor_eventos.publicar_a_proyecto(evento.proyecto_id, payload)


class ObservadorNotificacionInterna(ObservadorEvento):
    async def actualizar(self, evento: EventoDominio) -> None:
        db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
        if isinstance(evento, TareaCreadaEvento):
            for usuario_id in evento.usuarios_destino:
                await crear_notificacion_interna(
                    db,
                    usuario_id,
                    f"Se te ha asignado la tarea: {evento.titulo_tarea}",
                    "TAREA_ASIGNADA",
                    tarea_id=evento.tarea_id,
                    proyecto_id=evento.proyecto_id,
                    titulo_tarea=evento.titulo_tarea,
                )

        if isinstance(evento, TareaMovidaEvento):
            for usuario_id in evento.usuarios_destino:
                await crear_notificacion_interna(
                    db,
                    usuario_id,
                    f"La tarea '{evento.titulo_tarea}' fue movida.",
                    "ESTADO_TAREA_CAMBIADO",
                    tarea_id=evento.tarea_id,
                    proyecto_id=evento.proyecto_id,
                    titulo_tarea=evento.titulo_tarea,
                )

        if isinstance(evento, TareaActualizadaEvento):
            if isinstance(evento.nuevos_asignados, list) and evento.nuevos_asignados:
                for responsable_id in evento.nuevos_asignados:
                    await crear_notificacion_interna(
                        db,
                        responsable_id,
                        f"Se te ha asignado la tarea: {evento.titulo_tarea}",
                        "TAREA_ASIGNADA",
                        tarea_id=evento.tarea_id,
                        proyecto_id=evento.proyecto_id,
                        titulo_tarea=evento.titulo_tarea,
                    )

        if isinstance(evento, ComentarioAgregadoEvento):
            for usuario_id in evento.usuarios_destino:
                await crear_notificacion_interna(
                    db,
                    usuario_id,
                    f"Nuevo comentario en '{evento.titulo_tarea}'",
                    "COMENTARIO_EN_TAREA",
                    tarea_id=evento.tarea_id,
                    proyecto_id=evento.proyecto_id,
                    titulo_tarea=evento.titulo_tarea,
                )

        if isinstance(evento, BugUrgenteDetectadoEvento):
            for usuario_id in evento.usuarios_destino:
                await crear_notificacion_interna(
                    db,
                    usuario_id,
                    f"Bug urgente detectado: {evento.titulo_tarea}",
                    "TAREA_ASIGNADA",
                    tarea_id=evento.tarea_id,
                    proyecto_id=evento.proyecto_id,
                    titulo_tarea=evento.titulo_tarea,
                )


class ObservadorAuditoria(ObservadorEvento):
    async def actualizar(self, evento: EventoDominio) -> None:
        db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
        await db["registros_auditoria"].insert_one(
            {
                "_id": evento.tarea_id or evento.proyecto_id or "",
                "tipoEntidad": evento.tipo,
                "entidadId": evento.tarea_id or evento.proyecto_id or "",
                "accion": evento.tipo,
                "usuarioId": evento.creador_id,
                "valorAnterior": None,
                "valorNuevo": evento.serializar(),
                "proyectoId": evento.proyecto_id,
                "marca": evento.creado_en,
            }
        )


class ObservadorNotificacionExterna(ObservadorEvento):
    def __init__(self) -> None:
        self._proveedor = ProveedorNotificacion()

    async def actualizar(self, evento: EventoDominio) -> None:
        if not isinstance(evento, BugUrgenteDetectadoEvento):
            return

        db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
        for usuario_id in evento.usuarios_destino:
            preferencias = await obtener_preferencias(usuario_id)
            if preferencias.get("canal") == "IN_APP":
                continue

            async def enviar_alerta() -> None:
                try:
                    if preferencias.get("canal") in ("EMAIL", "AMBOS"):
                        usuario = await db["usuarios"].find_one({"_id": usuario_id})
                        if usuario and usuario.get("email"):
                            solicitud = SolicitudNotificacion(
                                destinatario=usuario.get("nombre", "Usuario"),
                                contacto=usuario["email"],
                                mensaje=f"Bug urgente: {evento.titulo_tarea}",
                                asunto="Alerta urgente TaskFlow",
                            )
                            adapter = self._proveedor.get("email").get()
                            adapter.enviar(solicitud)
                except Exception:
                    pass

            asyncio.create_task(enviar_alerta())
