"""
Servicio de subtareas — gestión de tareas hijas dentro de una tarea padre.
Las subtareas se almacenan en la colección 'subtareas' y pueden referenciar
una tarea (`tareaId`) o una etapa (`etapaId`).
"""
from datetime import datetime, timezone
from fastapi import HTTPException
import uuid

from app.db.conexion import ConexionMongoDB
from app.patterns.builder.constructor_subtarea import ConstructorSubtarea

# Builder reutilizable para construir subtareas paso a paso
_constructor_subtarea = ConstructorSubtarea()


def _db():
    return ConexionMongoDB.obtener_instancia().obtener_base_datos()


def _fmt(s: dict) -> dict:
    return {
        "id":               s["_id"],
        "titulo":           s["titulo"],
        "descripcion":      s.get("descripcion"),
        "completada":       s.get("completada", False),
        "tareaId":          s.get("tareaId"),
        "etapaId":          s.get("etapaId"),
        "proyectoId":       s["proyectoId"],
        "responsables":     s.get("responsables", []),
        "fechaVencimiento": s.get("fechaVencimiento"),
        "creadoEn":         s["creadoEn"],
        "actualizadoEn":    s.get("actualizadoEn", s["creadoEn"]),
    }


async def _obtener_proyecto_y_validar_acceso(db, proyecto_id: str, usuario_id: str, rol: str) -> dict:
    proyecto = await db["proyectos"].find_one({"_id": proyecto_id})
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if rol != "ADMIN" and usuario_id not in proyecto.get("miembros", []):
        raise HTTPException(status_code=403, detail="Sin acceso al proyecto")
    return proyecto


async def listar_subtareas(tarea_id: str) -> list:
    db = _db()
    tarea = await db["tareas"].find_one({"_id": tarea_id})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    cursor = db["subtareas"].find({"tareaId": tarea_id}, sort=[("creadoEn", 1)])
    return [_fmt(s) async for s in cursor]


async def listar_subtareas_etapa(etapa_id: str) -> list:
    db = _db()
    etapa = await db["etapas"].find_one({"_id": etapa_id})
    if not etapa:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")
    cursor = db["subtareas"].find({"etapaId": etapa_id}, sort=[("creadoEn", 1)])
    return [_fmt(s) async for s in cursor]


async def listar_subtareas_etapa_proyecto(proyecto_id: str, usuario_id: str, rol: str) -> list:
    db = _db()
    await _obtener_proyecto_y_validar_acceso(db, proyecto_id, usuario_id, rol)

    fases = [f async for f in db["fases"].find({"proyectoId": proyecto_id}, {"_id": 1, "nombre": 1})]
    fases_por_id = {fase["_id"]: fase for fase in fases}

    etapas = [
        etapa async for etapa in db["etapas"].find(
            {"proyectoId": proyecto_id},
            {"_id": 1, "nombre": 1, "faseId": 1}
        )
    ]
    etapas_por_id = {etapa["_id"]: etapa for etapa in etapas}

    cursor = db["subtareas"].find(
        {"proyectoId": proyecto_id, "etapaId": {"$exists": True, "$ne": None}},
        sort=[("creadoEn", 1)],
    )

    resultado = []
    async for subtarea in cursor:
        etapa_id = subtarea.get("etapaId")
        etapa = etapas_por_id.get(etapa_id)
        fase = fases_por_id.get(etapa.get("faseId")) if etapa else None

        item = _fmt(subtarea)
        item["faseId"] = etapa.get("faseId") if etapa else None
        item["faseNombre"] = fase.get("nombre") if fase else None
        item["etapaNombre"] = etapa.get("nombre") if etapa else None
        resultado.append(item)

    return resultado


async def crear_subtarea(tarea_id: str, datos: dict, usuario_id: str) -> dict:
    db = _db()
    tarea = await db["tareas"].find_one({"_id": tarea_id})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    ahora = datetime.now(timezone.utc)

    # Usar el patrón Builder para construir la subtarea paso a paso
    constructor = (
        _constructor_subtarea
        .con_titulo(datos["titulo"])
        .en_tarea(tarea_id)
        .en_proyecto(tarea["proyectoId"])
        .creada_por(usuario_id)
        .con_responsables(datos.get("responsables", []))
    )
    if datos.get("descripcion"):
        constructor = constructor.con_descripcion(datos["descripcion"])
    if datos.get("fechaVencimiento"):
        from datetime import datetime as dt
        try:
            fv = dt.fromisoformat(datos["fechaVencimiento"].replace("Z", "+00:00"))
            constructor = constructor.con_fecha_vencimiento(fv)
        except Exception:
            pass

    subtarea = constructor.construir()
    await db["subtareas"].insert_one(subtarea)

    # Actualizar referencia en la tarea padre
    await db["tareas"].update_one(
        {"_id": tarea_id},
        {"$addToSet": {"subtareas": subtarea["_id"]}}
    )

    # Registrar en auditoría
    await db["registros_auditoria"].insert_one({
        "_id":         str(uuid.uuid4()),
        "tipoEntidad": "subtarea",
        "entidadId":   subtarea["_id"],
        "accion":      "CREADA",
        "usuarioId":   usuario_id,
        "proyectoId":  tarea["proyectoId"],
        "valorAnterior": None,
        "valorNuevo":  {"titulo": datos["titulo"]},
        "marca":       ahora,
    })

    return _fmt(subtarea)


async def crear_subtarea_en_etapa(etapa_id: str, datos: dict, usuario_id: str) -> dict:
    db = _db()
    etapa = await db["etapas"].find_one({"_id": etapa_id})
    if not etapa:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    ahora = datetime.now(timezone.utc)

    constructor = (
        _constructor_subtarea
        .con_titulo(datos["titulo"])
        .en_etapa(etapa_id)
        .en_proyecto(etapa["proyectoId"])
        .creada_por(usuario_id)
        .con_responsables(datos.get("responsables", []))
    )
    if datos.get("descripcion"):
        constructor = constructor.con_descripcion(datos["descripcion"])
    if datos.get("fechaVencimiento"):
        from datetime import datetime as dt
        try:
            fv = dt.fromisoformat(datos["fechaVencimiento"].replace("Z", "+00:00"))
            constructor = constructor.con_fecha_vencimiento(fv)
        except Exception:
            pass

    subtarea = constructor.construir()
    await db["subtareas"].insert_one(subtarea)

    await db["etapas"].update_one(
        {"_id": etapa_id},
        {"$addToSet": {"subtareas": subtarea["_id"]}}
    )

    await db["registros_auditoria"].insert_one({
        "_id":         str(uuid.uuid4()),
        "tipoEntidad": "subtarea",
        "entidadId":   subtarea["_id"],
        "accion":      "CREADA",
        "usuarioId":   usuario_id,
        "proyectoId":  etapa["proyectoId"],
        "valorAnterior": None,
        "valorNuevo":  {"titulo": datos["titulo"], "etapaId": etapa_id},
        "marca":       ahora,
    })

    return _fmt(subtarea)


async def actualizar_subtarea(subtarea_id: str, datos: dict, usuario_id: str) -> dict:
    db = _db()
    subtarea = await db["subtareas"].find_one({"_id": subtarea_id})
    if not subtarea:
        raise HTTPException(status_code=404, detail="Subtarea no encontrada")

    cambios = {k: v for k, v in datos.items() if v is not None}
    cambios["actualizadoEn"] = datetime.now(timezone.utc)

    await db["subtareas"].update_one({"_id": subtarea_id}, {"$set": cambios})
    actualizada = await db["subtareas"].find_one({"_id": subtarea_id})
    return _fmt(actualizada)


async def eliminar_subtarea(subtarea_id: str, usuario_id: str) -> dict:
    db = _db()
    subtarea = await db["subtareas"].find_one({"_id": subtarea_id})
    if not subtarea:
        raise HTTPException(status_code=404, detail="Subtarea no encontrada")

    await db["subtareas"].delete_one({"_id": subtarea_id})

    # Quitar referencia en la tarea padre
    if subtarea.get("tareaId"):
        await db["tareas"].update_one(
            {"_id": subtarea["tareaId"]},
            {"$pull": {"subtareas": subtarea_id}}
        )

    if subtarea.get("etapaId"):
        await db["etapas"].update_one(
            {"_id": subtarea["etapaId"]},
            {"$pull": {"subtareas": subtarea_id}}
        )

    return {"mensaje": "Subtarea eliminada"}


async def toggle_subtarea(subtarea_id: str, usuario_id: str) -> dict:
    """Marcar/desmarcar subtarea como completada."""
    db = _db()
    subtarea = await db["subtareas"].find_one({"_id": subtarea_id})
    if not subtarea:
        raise HTTPException(status_code=404, detail="Subtarea no encontrada")

    nuevo_estado = not subtarea.get("completada", False)
    await db["subtareas"].update_one(
        {"_id": subtarea_id},
        {"$set": {"completada": nuevo_estado, "actualizadoEn": datetime.now(timezone.utc)}}
    )
    actualizada = await db["subtareas"].find_one({"_id": subtarea_id})
    return _fmt(actualizada)
