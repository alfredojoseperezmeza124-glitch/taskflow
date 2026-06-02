from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any


class ObservadorEvento(ABC):
    @abstractmethod
    async def actualizar(self, evento: Any) -> None:
        ...


class ObservadorSSE(ObservadorEvento):
    async def actualizar(self, evento: Any) -> None:
        try:
            from app.core.gestor_eventos import gestor_eventos

            # Si el evento tiene proyectoId, publicar al proyecto; si tiene usuarioId, publicar al usuario
            if isinstance(evento, dict):
                proyecto_id = evento.get("proyectoId")
                usuario_id = evento.get("usuarioId")
            else:
                proyecto_id = getattr(evento, "datos", {}).get("proyectoId")
                usuario_id = getattr(evento, "datos", {}).get("usuarioId")

            if proyecto_id:
                gestor_eventos.publicar_a_proyecto(proyecto_id, evento)
            elif usuario_id:
                gestor_eventos.publicar_a_usuario(usuario_id, evento)
        except Exception:
            # No fallar si hay problema con SSE
            pass


class ObservadorNotificacionInterna(ObservadorEvento):
    async def actualizar(self, evento: Any) -> None:
        try:
            # Importar dentro del método para evitar ciclos de importación
            from app.services import servicio_notificacion as svc

            if isinstance(evento, dict):
                usuario = evento.get("usuarioId") or evento.get("datos", {}).get("usuarioId")
                mensaje = evento.get("mensaje") or str(evento)
            else:
                usuario = getattr(evento, "datos", {}).get("usuarioId")
                mensaje = getattr(evento, "datos", {}).get("mensaje", str(evento))

            if usuario:
                try:
                    # Llamada tentativa — el servicio requiere `db` en muchas firmas; intentamos proporcionar None
                    await svc.crear_notificacion_interna(None, usuario, mensaje, "SISTEMA")
                except TypeError:
                    # Si la firma no encaja, no romper el flujo
                    pass
        except Exception:
            pass


class ObservadorAuditoria(ObservadorEvento):
    async def actualizar(self, evento: Any) -> None:
        try:
            # Importar dentro del método para evitar ciclos
            from dataclasses import asdict
            from app.db.conexion import ConexionMongoDB
            from app.patterns.observer.eventos import EventoDominio

            if not isinstance(evento, EventoDominio) and not isinstance(evento, dict):
                return

            db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
            # serializar evento de forma segura
            valor_nuevo = asdict(evento) if not isinstance(evento, dict) else evento

            await db["registros_auditoria"].insert_one(
                {
                    "_id": valor_nuevo.get("tarea_id") or valor_nuevo.get("proyecto_id") or "",
                    "tipoEntidad": valor_nuevo.get("tipo"),
                    "entidadId": valor_nuevo.get("tarea_id") or valor_nuevo.get("proyecto_id") or "",
                    "accion": valor_nuevo.get("tipo"),
                    "usuarioId": valor_nuevo.get("creador_id"),
                    "valorAnterior": None,
                    "valorNuevo": valor_nuevo,
                    "proyectoId": valor_nuevo.get("proyecto_id"),
                    "marca": valor_nuevo.get("creado_en"),
                }
            )
        except Exception:
            # No romper el flujo si hay error de auditoría
            pass


class ObservadorNotificacionExterna(ObservadorEvento):
    def __init__(self) -> None:
        # Instanciar proveedor localmente para evitar ciclos globales
        try:
            from app.patterns.adapter.proveedor_notificacion import ProveedorNotificacion

            self._proveedor = ProveedorNotificacion()
        except Exception:
            self._proveedor = None

    async def actualizar(self, evento: Any) -> None:
        try:
            # Importar localmente para evitar ciclos
            import asyncio
            from app.db.conexion import ConexionMongoDB
            from app.services.servicio_notificacion import obtener_preferencias
            from app.patterns.adapter.notificacion_adapter import SolicitudNotificacion
            from app.patterns.observer.eventos import BugUrgenteDetectadoEvento

            if not isinstance(evento, BugUrgenteDetectadoEvento):
                return

            if not self._proveedor:
                return

            db = ConexionMongoDB.obtener_instancia().obtener_base_datos()

            # evento.usuarios_destino se espera como lista de ids
            usuarios = getattr(evento, "usuarios_destino", []) or []

            for usuario_id in usuarios:
                preferencias = await obtener_preferencias(usuario_id)
                if preferencias.get("canal") == "IN_APP":
                    continue

                async def enviar_alerta():
                    try:
                        if preferencias.get("canal") in ("EMAIL", "AMBOS"):
                            usuario = await db["usuarios"].find_one({"_id": usuario_id})
                            if usuario and usuario.get("email"):
                                solicitud = SolicitudNotificacion(
                                    destinatario=usuario.get("nombre", "Usuario"),
                                    contacto=usuario["email"],
                                    mensaje=f"Bug urgente: {getattr(evento, 'datos', {}).get('titulo_tarea', '')}",
                                    asunto="Alerta urgente TaskFlow",
                                )
                                adapter = self._proveedor.get("email").get()
                                adapter.enviar(solicitud)
                    except Exception:
                        pass

                asyncio.create_task(enviar_alerta())
        except Exception:
            pass
