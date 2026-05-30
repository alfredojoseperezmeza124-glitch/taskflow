from datetime import datetime, timezone
from fastapi import HTTPException
import uuid
import json

from app.db.conexion import ConexionMongoDB
from app.schemas.notificaciones import ActualizarPreferencias
from app.patterns.adapter.notificacion_adapter import SolicitudNotificacion
from app.patterns.adapter.proveedor_notificacion import ProveedorNotificacion
from app.patterns.command.bus import CommandBus
from app.patterns.command.command import ComandoGenerico
from app.patterns.strategy.estrategia_entrega_notificacion import EstrategiaEntregaNotificacionFactory
from app.core.configuracion import configuracion

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
    Envía notificación por canal externo usando Strategy + Factory/Adapter.
    """
    db = _db()
    usuario = await db["usuarios"].find_one({"_id": usuario_id})
    if not usuario:
        return {"enviada": False, "canal": canal, "detalle": "Usuario no encontrado"}

    preferencias = await obtener_preferencias(usuario_id)
    canal_solicitado = canal.strip().lower()
    canales = []
    estrategia = None

    if canal_solicitado in {"email", "in_app", "ambos"}:
        estrategia = EstrategiaEntregaNotificacionFactory.seleccionar(preferencias, canal_solicitado)
        canales = [c.value for c in estrategia.canales()]
    else:
        canales = [canal_solicitado]

    resultados: list[dict] = []
    bus = CommandBus()

    async def _enviar_canal(canal_actual: str) -> dict:
        if canal_actual.upper() == "IN_APP":
            await crear_notificacion_interna(
                db,
                usuario_id,
                mensaje,
                "NOTIFICACION_EXTERNA",
            )
            return {"enviada": True, "canal": "IN_APP", "detalle": "Notificación in-app creada"}

        contacto = None
        if canal_actual == "email":
            contacto = usuario.get("email", "")
            if not contacto:
                return {"enviada": False, "canal": "email", "detalle": "El usuario no tiene email registrado", "contacto_usado": None}
        else:
            contacto_directo_limpio = (contacto_directo or "").strip()
            if contacto_directo_limpio:
                contacto = contacto_directo_limpio
            else:
                prefs = await db["preferencias_notificacion"].find_one({"usuarioId": usuario_id}) or {}
                if canal_actual == "whatsapp" and prefs.get("telefonoWhatsapp"):
                    contacto = prefs["telefonoWhatsapp"]
                elif canal_actual == "sms" and prefs.get("telefonoSms"):
                    contacto = prefs["telefonoSms"]
                else:
                    return {
                        "enviada": False,
                        "canal": canal_actual,
                        "detalle": f"No hay número de teléfono configurado para {canal_actual.upper()}.",
                        "contacto_usado": None,
                    }

        content_sid_final = (content_sid or "").strip()
        content_variables_final = (content_variables or "").strip()
        if canal_actual == "whatsapp" and not content_sid_final:
            content_sid_final = (getattr(configuracion, "twilio_whatsapp_content_sid", None) or "").strip()
            content_variables_final = (
                getattr(configuracion, "twilio_whatsapp_content_variables", None) or ""
            ).strip()
        if canal_actual == "whatsapp" and content_sid_final:
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

        fabrica = _proveedor_notificacion.get(canal_actual)
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
        await crear_notificacion_interna(
            db,
            usuario_id,
            f"[{canal_actual.upper()}] {mensaje}",
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

    try:
        for canal_actual in canales:
            comando = ComandoGenerico(
                descripcion=f"Enviar notificación externa por {canal_actual}",
                operacion=lambda canal_actual=canal_actual: _enviar_canal(canal_actual),
            )
            resultados.append(await bus.ejecutar(comando))

        if len(resultados) == 1:
            return resultados[0]
        return {"resultados": resultados}
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
    resultados = {}

    for canal in canales:
        contacto_dir = None
        if canal == "whatsapp" and contacto_whatsapp:
            contacto_dir = contacto_whatsapp
        elif canal == "sms" and contacto_sms:
            contacto_dir = contacto_sms

        resultados[canal] = await enviar_notificacion_externa(
            usuario_id=usuario_id,
            mensaje=mensaje,
            canal=canal,
            asunto=f"Prueba TaskFlow - canal {canal}",
            contacto_directo=contacto_dir,
        )

    return {"usuarioId": usuario_id, "resultados": resultados}
