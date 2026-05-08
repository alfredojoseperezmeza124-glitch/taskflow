from datetime import datetime, timezone
from fastapi import HTTPException
import uuid

from app.db.conexion import ConexionMongoDB
from app.schemas.proyectos import (
    CrearProyecto,
    ActualizarProyecto,
    InvitarMiembro,
    CrearFase,
    ActualizarFase,
    CrearEtapa,
    ActualizarEtapa,
)
from app.patterns.prototype.clonadores import clonar_proyecto
from app.patterns.composite.componente_tarea import (
    construir_componente_proyecto_jerarquico,
    serializar_componente_tarea,
)
from app.patterns.facade.gestion_proyectos_facade import FachadaGestionProyectos
from app.patterns.proxy.proxy_gestion import ProxyGestionProyectos


def _db():
    return ConexionMongoDB.obtener_instancia().obtener_base_datos()


def _serializar(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "nombre": doc["nombre"],
        "descripcion": doc.get("descripcion"),
        "fechaInicio": doc["fechaInicio"],
        "fechaFinEstimada": doc["fechaFinEstimada"],
        "estado": doc["estado"],
        "propietarioId": doc["propietarioId"],
        "estaArchivado": doc.get("estaArchivado", False),
        "progreso": doc.get("progreso", 0.0),
        "miembros": doc.get("miembros", []),
        "reglasDecoradores": doc.get("reglasDecoradores", {}),
        "creadoEn": doc["creadoEn"],
    }


def _serializar_fase(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "proyectoId": doc["proyectoId"],
        "nombre": doc["nombre"],
        "descripcion": doc.get("descripcion"),
        "orden": doc.get("orden", 0),
        "responsables": doc.get("responsables", []),
        "horasEstimadas": doc.get("horasEstimadas", 0.0),
        "progreso": doc.get("progreso", 0.0),
        "etapas": doc.get("etapas", []),
        "creadoEn": doc["creadoEn"],
        "actualizadoEn": doc.get("actualizadoEn", doc["creadoEn"]),
    }


def _serializar_etapa(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "proyectoId": doc["proyectoId"],
        "faseId": doc["faseId"],
        "nombre": doc["nombre"],
        "descripcion": doc.get("descripcion"),
        "orden": doc.get("orden", 0),
        "responsables": doc.get("responsables", []),
        "horasEstimadas": doc.get("horasEstimadas", 0.0),
        "progreso": doc.get("progreso", 0.0),
        "subtareas": doc.get("subtareas", []),
        "creadoEn": doc["creadoEn"],
        "actualizadoEn": doc.get("actualizadoEn", doc["creadoEn"]),
    }


def _validar_acceso_proyecto(proyecto: dict, usuario_id: str, rol: str) -> None:
    if rol != "ADMIN" and usuario_id not in proyecto.get("miembros", []):
        raise HTTPException(status_code=403, detail="Sin acceso al proyecto")


def _validar_permiso_edicion_estructura(proyecto: dict, usuario_id: str, rol: str) -> None:
    if rol != "ADMIN" and proyecto.get("propietarioId") != usuario_id:
        raise HTTPException(
            status_code=403,
            detail="Solo el propietario o un Admin puede modificar la estructura del proyecto",
        )
    if proyecto.get("estaArchivado"):
        raise HTTPException(status_code=400, detail="El proyecto está archivado y es de solo lectura")


async def _obtener_proyecto_documento(db, proyecto_id: str) -> dict:
    proyecto = await db["proyectos"].find_one({"_id": proyecto_id})
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return proyecto


async def _obtener_siguiente_orden(db, coleccion: str, filtro: dict) -> int:
    ultimo = await db[coleccion].find_one(filtro, sort=[("orden", -1)])
    if not ultimo:
        return 0
    try:
        return int(ultimo.get("orden", 0)) + 1
    except (TypeError, ValueError):
        return 0


async def crear_proyecto(datos: CrearProyecto, propietario_id: str) -> dict:
    db = _db()
    fachada = FachadaGestionProyectos(db)
    proyecto = await fachada.crear_proyecto_con_estructura(datos, propietario_id)
    return _serializar(proyecto)


async def listar_proyectos(usuario_id: str, rol: str) -> list:
    db = _db()
    # ADMIN ve todos los proyectos; los demás solo los que son miembros
    if rol == "ADMIN":
        cursor = db["proyectos"].find({})
    else:
        cursor = db["proyectos"].find({"miembros": usuario_id})
    return [_serializar(p) async for p in cursor]


async def obtener_proyecto(proyecto_id: str, usuario_id: str, rol: str) -> dict:
    db = _db()
    proyecto = await _obtener_proyecto_documento(db, proyecto_id)
    _validar_acceso_proyecto(proyecto, usuario_id, rol)
    return _serializar(proyecto)


async def actualizar_proyecto(proyecto_id: str, datos: ActualizarProyecto, usuario_id: str, rol: str) -> dict:
    db = _db()
    proxy = ProxyGestionProyectos(db)

    async def _operacion(proyecto: dict) -> dict:
        cambios = {k: v for k, v in datos.model_dump().items() if v is not None}
        if not cambios:
            return _serializar(proyecto)

        if "fechaFinEstimada" in cambios:
            cambios["fechaFinEstimada"] = cambios["fechaFinEstimada"].isoformat()
        cambios["actualizadoEn"] = datetime.now(timezone.utc)
        await db["proyectos"].update_one({"_id": proyecto_id}, {"$set": cambios})
        actualizado = await db["proyectos"].find_one({"_id": proyecto_id})
        return _serializar(actualizado)

    return await proxy.ejecutar_en_proyecto(
        proyecto_id=proyecto_id,
        usuario_id=usuario_id,
        rol=rol,
        accion="ACTUALIZAR_PROYECTO",
        validar_membresia=False,
        requiere_propietario=True,
        operacion=_operacion,
    )


async def eliminar_proyecto(proyecto_id: str, usuario_id: str, rol: str) -> dict:
    db = _db()
    proxy = ProxyGestionProyectos(db)
    fachada = FachadaGestionProyectos(db)

    async def _operacion(_: dict) -> dict:
        await fachada.eliminar_proyecto_completo(proyecto_id)
        return {"mensaje": "Proyecto eliminado correctamente"}

    return await proxy.ejecutar_en_proyecto(
        proyecto_id=proyecto_id,
        usuario_id=usuario_id,
        rol=rol,
        accion="ELIMINAR_PROYECTO",
        validar_membresia=False,
        requiere_propietario=True,
        permitir_archivado=True,
        operacion=_operacion,
    )


async def archivar_proyecto(proyecto_id: str, usuario_id: str, rol: str) -> dict:
    db = _db()
    proxy = ProxyGestionProyectos(db)

    async def _operacion(_: dict) -> dict:
        await db["proyectos"].update_one(
            {"_id": proyecto_id},
            {"$set": {"estaArchivado": True, "estado": "ARCHIVADO", "actualizadoEn": datetime.now(timezone.utc)}},
        )
        actualizado = await db["proyectos"].find_one({"_id": proyecto_id})
        return _serializar(actualizado)

    return await proxy.ejecutar_en_proyecto(
        proyecto_id=proyecto_id,
        usuario_id=usuario_id,
        rol=rol,
        accion="ARCHIVAR_PROYECTO",
        validar_membresia=False,
        requiere_propietario=True,
        operacion=_operacion,
    )


async def invitar_miembro(proyecto_id: str, datos: InvitarMiembro, usuario_id: str, rol: str) -> dict:
    db = _db()
    proxy = ProxyGestionProyectos(db)

    async def _operacion(proyecto: dict) -> dict:
        invitado = await db["usuarios"].find_one({"email": datos.email})
        if not invitado:
            raise HTTPException(status_code=404, detail="Usuario no encontrado con ese correo")
        if invitado["_id"] in proyecto.get("miembros", []):
            raise HTTPException(status_code=400, detail="El usuario ya es miembro del proyecto")

        await db["proyectos"].update_one(
            {"_id": proyecto_id},
            {"$push": {"miembros": invitado["_id"]}},
        )
        return {"mensaje": f"Usuario {invitado['nombre']} invitado al proyecto"}

    return await proxy.ejecutar_en_proyecto(
        proyecto_id=proyecto_id,
        usuario_id=usuario_id,
        rol=rol,
        accion="INVITAR_MIEMBRO",
        operacion=_operacion,
    )


async def clonar_proyecto_servicio(proyecto_id: str, usuario_id: str, rol: str) -> dict:
    db = _db()
    proyecto = await _obtener_proyecto_documento(db, proyecto_id)

    tableros = [t async for t in db["tableros"].find({"proyectoId": proyecto_id})]
    tablero_ids = [t["_id"] for t in tableros]
    columnas = [c async for c in db["columnas"].find({"tableroId": {"$in": tablero_ids}})]

    resultado = clonar_proyecto(proyecto, tableros, columnas, usuario_id)

    await db["proyectos"].insert_one(resultado["proyecto"])
    if resultado["tableros"]:
        await db["tableros"].insert_many(resultado["tableros"])
    if resultado["columnas"]:
        await db["columnas"].insert_many(resultado["columnas"])

    return _serializar(resultado["proyecto"])


async def obtener_miembros_proyecto(proyecto_id: str) -> list:
    db = _db()
    proyecto = await _obtener_proyecto_documento(db, proyecto_id)
    miembro_ids = proyecto.get("miembros", [])
    cursor = db["usuarios"].find({"_id": {"$in": miembro_ids}}, {"passwordHash": 0})
    return [{"id": u["_id"], "nombre": u["nombre"], "email": u["email"], "rol": u["rol"]} async for u in cursor]


async def listar_fases_proyecto(proyecto_id: str, usuario_id: str, rol: str) -> list:
    db = _db()
    proyecto = await _obtener_proyecto_documento(db, proyecto_id)
    _validar_acceso_proyecto(proyecto, usuario_id, rol)
    cursor = db["fases"].find({"proyectoId": proyecto_id}, sort=[("orden", 1), ("creadoEn", 1)])
    return [_serializar_fase(fase) async for fase in cursor]


async def crear_fase(proyecto_id: str, datos: CrearFase, usuario_id: str, rol: str) -> dict:
    db = _db()
    proyecto = await _obtener_proyecto_documento(db, proyecto_id)
    _validar_acceso_proyecto(proyecto, usuario_id, rol)
    _validar_permiso_edicion_estructura(proyecto, usuario_id, rol)

    ahora = datetime.now(timezone.utc)
    orden = datos.orden if datos.orden is not None else await _obtener_siguiente_orden(
        db, "fases", {"proyectoId": proyecto_id}
    )

    fase = {
        "_id": str(uuid.uuid4()),
        "proyectoId": proyecto_id,
        "nombre": datos.nombre,
        "descripcion": datos.descripcion,
        "orden": orden,
        "responsables": datos.responsables,
        "horasEstimadas": float(datos.horasEstimadas or 0.0),
        "progreso": 0.0,
        "etapas": [],
        "creadoEn": ahora,
        "actualizadoEn": ahora,
    }
    await db["fases"].insert_one(fase)
    return _serializar_fase(fase)


async def actualizar_fase(fase_id: str, datos: ActualizarFase, usuario_id: str, rol: str) -> dict:
    db = _db()
    fase = await db["fases"].find_one({"_id": fase_id})
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    proyecto = await _obtener_proyecto_documento(db, fase["proyectoId"])
    _validar_acceso_proyecto(proyecto, usuario_id, rol)
    _validar_permiso_edicion_estructura(proyecto, usuario_id, rol)

    cambios = {k: v for k, v in datos.model_dump().items() if v is not None}
    if not cambios:
        return _serializar_fase(fase)

    cambios["actualizadoEn"] = datetime.now(timezone.utc)
    await db["fases"].update_one({"_id": fase_id}, {"$set": cambios})
    actualizada = await db["fases"].find_one({"_id": fase_id})
    return _serializar_fase(actualizada)


async def eliminar_fase(fase_id: str, usuario_id: str, rol: str) -> dict:
    db = _db()
    fase = await db["fases"].find_one({"_id": fase_id})
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    proyecto = await _obtener_proyecto_documento(db, fase["proyectoId"])
    _validar_acceso_proyecto(proyecto, usuario_id, rol)
    _validar_permiso_edicion_estructura(proyecto, usuario_id, rol)

    etapa_ids = [etapa["_id"] async for etapa in db["etapas"].find({"faseId": fase_id}, {"_id": 1})]
    if etapa_ids:
        await db["subtareas"].delete_many({"etapaId": {"$in": etapa_ids}})
    await db["etapas"].delete_many({"faseId": fase_id})
    await db["fases"].delete_one({"_id": fase_id})
    return {"mensaje": "Fase eliminada correctamente"}


async def listar_etapas_fase(fase_id: str, usuario_id: str, rol: str) -> list:
    db = _db()
    fase = await db["fases"].find_one({"_id": fase_id})
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    proyecto = await _obtener_proyecto_documento(db, fase["proyectoId"])
    _validar_acceso_proyecto(proyecto, usuario_id, rol)

    cursor = db["etapas"].find({"faseId": fase_id}, sort=[("orden", 1), ("creadoEn", 1)])
    return [_serializar_etapa(etapa) async for etapa in cursor]


async def crear_etapa(fase_id: str, datos: CrearEtapa, usuario_id: str, rol: str) -> dict:
    db = _db()
    fase = await db["fases"].find_one({"_id": fase_id})
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    proyecto = await _obtener_proyecto_documento(db, fase["proyectoId"])
    _validar_acceso_proyecto(proyecto, usuario_id, rol)
    _validar_permiso_edicion_estructura(proyecto, usuario_id, rol)

    ahora = datetime.now(timezone.utc)
    orden = datos.orden if datos.orden is not None else await _obtener_siguiente_orden(
        db, "etapas", {"faseId": fase_id}
    )

    etapa = {
        "_id": str(uuid.uuid4()),
        "proyectoId": fase["proyectoId"],
        "faseId": fase_id,
        "nombre": datos.nombre,
        "descripcion": datos.descripcion,
        "orden": orden,
        "responsables": datos.responsables,
        "horasEstimadas": float(datos.horasEstimadas or 0.0),
        "progreso": 0.0,
        "subtareas": [],
        "creadoEn": ahora,
        "actualizadoEn": ahora,
    }
    await db["etapas"].insert_one(etapa)
    await db["fases"].update_one({"_id": fase_id}, {"$addToSet": {"etapas": etapa["_id"]}})
    return _serializar_etapa(etapa)


async def actualizar_etapa(etapa_id: str, datos: ActualizarEtapa, usuario_id: str, rol: str) -> dict:
    db = _db()
    etapa = await db["etapas"].find_one({"_id": etapa_id})
    if not etapa:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    proyecto = await _obtener_proyecto_documento(db, etapa["proyectoId"])
    _validar_acceso_proyecto(proyecto, usuario_id, rol)
    _validar_permiso_edicion_estructura(proyecto, usuario_id, rol)

    cambios = {k: v for k, v in datos.model_dump().items() if v is not None}
    if not cambios:
        return _serializar_etapa(etapa)

    cambios["actualizadoEn"] = datetime.now(timezone.utc)
    await db["etapas"].update_one({"_id": etapa_id}, {"$set": cambios})
    actualizada = await db["etapas"].find_one({"_id": etapa_id})
    return _serializar_etapa(actualizada)


async def eliminar_etapa(etapa_id: str, usuario_id: str, rol: str) -> dict:
    db = _db()
    etapa = await db["etapas"].find_one({"_id": etapa_id})
    if not etapa:
        raise HTTPException(status_code=404, detail="Etapa no encontrada")

    proyecto = await _obtener_proyecto_documento(db, etapa["proyectoId"])
    _validar_acceso_proyecto(proyecto, usuario_id, rol)
    _validar_permiso_edicion_estructura(proyecto, usuario_id, rol)

    await db["subtareas"].delete_many({"etapaId": etapa_id})
    await db["etapas"].delete_one({"_id": etapa_id})
    await db["fases"].update_one({"_id": etapa["faseId"]}, {"$pull": {"etapas": etapa_id}})
    return {"mensaje": "Etapa eliminada correctamente"}


async def obtener_jerarquia_proyecto_compuesta(proyecto_id: str, usuario_id: str, rol: str) -> dict:
    db = _db()
    proyecto = await _obtener_proyecto_documento(db, proyecto_id)
    _validar_acceso_proyecto(proyecto, usuario_id, rol)

    fases = [fase async for fase in db["fases"].find({"proyectoId": proyecto_id})]
    etapas = [etapa async for etapa in db["etapas"].find({"proyectoId": proyecto_id})]
    subtareas = [sub async for sub in db["subtareas"].find({"proyectoId": proyecto_id})]

    try:
        componente = construir_componente_proyecto_jerarquico(
            proyecto=proyecto,
            fases=fases,
            etapas=etapas,
            subtareas=subtareas,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return serializar_componente_tarea(componente)
