from datetime import datetime, timezone
from fastapi import HTTPException
import uuid
import json
import asyncio

from app.db.conexion import ConexionMongoDB
from app.schemas.notificaciones import ActualizarPreferencias
from app.patterns.adapter.notificacion_adapter import SolicitudNotificacion
from app.patterns.adapter.proveedor_notificacion import ProveedorNotificacion
from app.core.configuracion import configuracion
from app.patterns.command.command import ComandoGenerico
from app.patterns.command.bus import command_bus

_proveedor_notificacion = ProveedorNotificacion()

try:
    from app.core.gestor_eventos import gestor_eventos, evento_notificacion
    _SSE_ACTIVO = True
except ImportError:
    gestor_eventos = None
    evento_notificacion = lambda n: {}
    _SSE_ACTIVO = False


def _db():
    return ConexionMongoDB.obtener_instancia().obtener_base_datos()


def _serializar(doc: dict) -> dict:
    return {
        "id":          doc["_id"],
        "usuarioId":   doc["usuarioId"],
        "mensaje":     doc["mensaje"],
        "tipo":        doc["tipo"],
        "leida":       doc.get("leida", False),
        "creadoEn":    doc["creadoEn"],
        "tareaId":     doc.get("tareaId"),
        "proyectoId":  doc.get("proyectoId"),
        "tituloTarea": doc.get("tituloTarea"),
    }


async def crear_notificacion_interna(
    db,
    usuario_id: str,
    mensaje: str,
    tipo: str,
    *,
    tarea_id: str | None = None,
    proyecto_id: str | None = None,
    titulo_tarea: str | None = None,
) -> None:
    notif = {
        "_id":         str(uuid.uuid4()),
        "usuarioId":   usuario_id,
        "mensaje":     mensaje,
        "tipo":        tipo,
        "leida":       False,
        "creadoEn":    datetime.now(timezone.utc),
        "tareaId":     tarea_id,
        "proyectoId":  proyecto_id,
        "tituloTarea": titulo_tarea,
    }
    await db["notificaciones"].insert_one(notif)
    if _SSE_ACTIVO and gestor_eventos:
        gestor_eventos.publicar_a_usuario(usuario_id, evento_notificacion(notif))


async def listar_notificaciones(usuario_id: str) -> list:
    db = _db()
    cursor = db["notificaciones"].find(
        {"usuarioId": usuario_id},
        sort=[("creadoEn", -1)],
        limit=50,
    )
    return [_serializar(n) async for n in cursor]


async def marcar_como_leida(notificacion_id: str, usuario_id: str) -> dict:
    db = _db()
    notif = await db["notificaciones"].find_one({"_id": notificacion_id})
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    if notif["usuarioId"] != usuario_id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta notificación")
    await db["notificaciones"].update_one(
        {"_id": notificacion_id}, {"$set": {"leida": True}}
    )
    notif["leida"] = True
    return _serializar(notif)


async def marcar_todas_como_leidas(usuario_id: str) -> dict:
    db = _db()
    resultado = await db["notificaciones"].update_many(
        {"usuarioId": usuario_id, "leida": False},
        {"$set": {"leida": True}},
    )
    return {"mensaje": f"{resultado.modified_count} notificaciones marcadas como leídas"}


async def obtener_preferencias(usuario_id: str) -> dict:
    db = _db()
    prefs = await db["preferencias_notificacion"].find_one({"usuarioId": usuario_id})
    if not prefs:
        return {
            "usuarioId":               usuario_id,
            "notificacionAsignacion":  True,
            "notificacionVencimiento": True,
            "notificacionComentario":  True,
            "notificacionCambioEstado": True,
            "canal": "IN_APP",
        }
    return {
        "usuarioId":               prefs["usuarioId"],
        "notificacionAsignacion":  prefs.get("notificacionAsignacion", True),
        "notificacionVencimiento": prefs.get("notificacionVencimiento", True),
        "notificacionComentario":  prefs.get("notificacionComentario", True),
        "notificacionCambioEstado": prefs.get("notificacionCambioEstado", True),
        "canal": prefs.get("canal", "IN_APP"),
    }


async def actualizar_preferencias(usuario_id: str, datos: ActualizarPreferencias) -> dict:
    db = _db()
    cambios = {k: v for k, v in datos.model_dump().items() if v is not None}
    cambios["usuarioId"] = usuario_id
    await db["preferencias_notificacion"].update_one(
        {"usuarioId": usuario_id}, {"$set": cambios}, upsert=True
    )
    return await obtener_preferencias(usuario_id)


async def enviar_notificacion_externa(
    usuario_id: str,
    mensaje: str,
    canal: str = "email",
    asunto: str = "Notificacion TaskFlow",
    contacto_directo: str | None = None,
    content_sid: str | None = None,
    content_variables: str | None = None,
) -> dict:
    """
    Envía notificación por canal externo usando Factory Method + Adapter.

    CORRECCIÓN: contacto_directo tiene prioridad absoluta.
    Si no viene contacto_directo, busca en preferencias guardadas.
    Si tampoco hay ahí, devuelve error claro en vez de "sin-numero".
    """
    db = _db()
    usuario = await db["usuarios"].find_one({"_id": usuario_id})
    if not usuario:
        return {"enviada": False, "canal": canal, "detalle": "Usuario no encontrado"}

    # ── Resolver contacto según el canal ──────────────────────────────────
    if canal == "email":
        # Email siempre usa el correo del usuario registrado
        contacto = usuario.get("email", "")
        if not contacto:
            return {"enviada": False, "canal": canal, "detalle": "El usuario no tiene email registrado"}

    else:
        # WhatsApp / SMS: prioridad (1) contacto_directo, (2) preferencias BD
        contacto_directo_limpio = (contacto_directo or "").strip()

        if contacto_directo_limpio:
            # El frontend envió el número — usarlo directamente
            contacto = contacto_directo_limpio
        else:
            # Buscar en preferencias guardadas del usuario
            prefs = await db["preferencias_notificacion"].find_one({"usuarioId": usuario_id}) or {}
            if canal == "whatsapp" and prefs.get("telefonoWhatsapp"):
                contacto = prefs["telefonoWhatsapp"]
            elif canal == "sms" and prefs.get("telefonoSms"):
                contacto = prefs["telefonoSms"]
            else:
                # Sin número disponible — error claro, no "sin-numero"
                return {
                    "enviada": False,
                    "canal": canal,
                    "detalle": f"No hay número de teléfono configurado para {canal.upper()}. "
                               f"Ingresa el número en el campo de teléfono.",
                    "contacto_usado": None,
                }

    # ── Ejecutar Factory Method + Adapter ────────────────────────────────
    try:
        # WhatsApp: forzar template si no viene en el request para evitar error 3016
        content_sid_final = (content_sid or "").strip()
        content_variables_final = (content_variables or "").strip()
        if canal == "whatsapp" and not content_sid_final:
            content_sid_final = (getattr(configuracion, "twilio_whatsapp_content_sid", None) or "").strip()
            content_variables_final = (
                getattr(configuracion, "twilio_whatsapp_content_variables", None) or ""
            ).strip()
        if canal == "whatsapp" and content_sid_final:
            clave_mensaje = (getattr(configuracion, "twilio_whatsapp_mensaje_key", None) or "1").strip()
            vars_dict = {}
            if content_variables_final:
                try:
                    parsed = json.loads(content_variables_final)
                    if isinstance(parsed, dict):
                        vars_dict = {str(k): str(v) for k, v in parsed.items()}
                except Exception:
                    vars_dict = {}
            vars_dict[clave_mensaje] = (mensaje or "").strip() or "Notificación TaskFlow"
            content_variables_final = json.dumps(vars_dict, ensure_ascii=False)

        fabrica = _proveedor_notificacion.get(canal)
        adapter = fabrica.get()
        solicitud = SolicitudNotificacion(
            destinatario=usuario.get("nombre", "Usuario"),
            contacto=contacto,
            mensaje=mensaje,
            asunto=asunto,
            content_sid=content_sid_final,
            content_variables=content_variables_final,
        )
        respuesta = adapter.enviar(solicitud)

        # Registrar como notificación interna
        await crear_notificacion_interna(
            db, usuario_id,
            f"[{canal.upper()}] {mensaje}",
            "NOTIFICACION_EXTERNA",
        )

        return {
            "enviada":        respuesta.enviada,
            "canal":          respuesta.canal,
            "detalle":        respuesta.detalle,
            "contacto_usado": contacto,
            "estado":         respuesta.estado,
            "sid":            respuesta.sid,
            "codigo_error":   respuesta.codigo_error,
            "mensaje_error":  respuesta.mensaje_error,
        }
    except ValueError as e:
        return {"enviada": False, "canal": canal, "detalle": str(e)}
    except Exception as e:
        return {"enviada": False, "canal": canal, "detalle": f"Error: {str(e)}"}


async def probar_canales(
    usuario_id: str,
    mensaje: str = "Prueba de canal TaskFlow",
    contacto_whatsapp: str | None = None,
    contacto_sms: str | None = None,
) -> dict:
    db = _db()
    usuario = await db["usuarios"].find_one({"_id": usuario_id})
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    canales = _proveedor_notificacion.canales_disponibles()

    # Ejecutar las llamadas en paralelo usando el CommandBus + ComandoGenerico
    comandos = []
    for canal in canales:
        contacto_dir = None
        if canal == "whatsapp" and contacto_whatsapp:
            contacto_dir = contacto_whatsapp
        elif canal == "sms" and contacto_sms:
            contacto_dir = contacto_sms

        cmd = ComandoGenerico(
            enviar_notificacion_externa,
            usuario_id,
            mensaje,
            canal,
            f"Prueba TaskFlow - canal {canal}",
            contacto_dir,
        )
        comandos.append((canal, cmd))

    # Despachar todos y esperar resultados
    tareas = [command_bus.dispatch(cmd) for _, cmd in comandos]
    resultados_list = await asyncio.gather(*tareas, return_exceptions=True)

    resultados = {}
    for (canal, _), res in zip(comandos, resultados_list):
        if isinstance(res, Exception):
            resultados[canal] = {"enviada": False, "detalle": str(res)}
        else:
            resultados[canal] = res

    return {"usuarioId": usuario_id, "resultados": resultados}
