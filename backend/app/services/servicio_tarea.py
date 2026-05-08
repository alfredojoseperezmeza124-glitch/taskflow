from datetime import datetime, timezone
from fastapi import HTTPException
import uuid

from app.db.conexion import ConexionMongoDB
from app.schemas.tareas import (
    CrearTarea, ActualizarTarea, MoverTarea,
    CrearComentario, ActualizarComentario, RegistrarTiempo, CrearEtiqueta,
)
from app.patterns.factory.fabrica_tareas import obtener_creador
from app.patterns.builder.constructores_tareas import ConstructorTareaAvanzada
from app.patterns.prototype.clonadores import clonar_tarea
from app.patterns.composite.componente_tarea import (
    construir_componente_tarea_desde_raiz,
    serializar_componente_tarea,
)
from app.patterns.decorator.servicio_tarea_decorator import (
    ServicioTareaBase,
    construir_servicio_tarea,
)
from app.patterns.flyweight.perfiles_visuales_tarea import (
    obtener_perfil_visual_tarea,
    obtener_estadisticas_pool_flyweight_tareas,
)
from app.patterns.proxy.proxy_gestion import ProxyGestionTareas
from app.services.servicio_notificacion import crear_notificacion_interna
from app.services.servicio_mencion import extraer_y_notificar_menciones, resaltar_menciones


def _db():
    return ConexionMongoDB.obtener_instancia().obtener_base_datos()


def _normalizar_referencia_estructura(valor: str | None) -> str | None:
    if not isinstance(valor, str):
        return None
    limpio = valor.strip()
    return limpio if limpio else None


async def _resolver_fase_y_etapa_tarea(
    db,
    proyecto_id: str,
    fase_id: str | None,
    etapa_id: str | None,
) -> tuple[str | None, str | None]:
    fase_ref = _normalizar_referencia_estructura(fase_id)
    etapa_ref = _normalizar_referencia_estructura(etapa_id)

    if etapa_ref:
        etapa = await db["etapas"].find_one({"_id": etapa_ref})
        if not etapa:
            raise HTTPException(status_code=404, detail="Etapa no encontrada")
        if etapa.get("proyectoId") != proyecto_id:
            raise HTTPException(status_code=400, detail="La etapa no pertenece al proyecto de la tarea")
        fase_desde_etapa = etapa.get("faseId")
        if fase_ref and fase_ref != fase_desde_etapa:
            raise HTTPException(status_code=400, detail="La etapa no pertenece a la fase seleccionada")
        fase_ref = fase_desde_etapa

    if fase_ref:
        fase = await db["fases"].find_one({"_id": fase_ref})
        if not fase:
            raise HTTPException(status_code=404, detail="Fase no encontrada")
        if fase.get("proyectoId") != proyecto_id:
            raise HTTPException(status_code=400, detail="La fase no pertenece al proyecto de la tarea")

    return fase_ref, etapa_ref


def _serializar(doc: dict) -> dict:
    perfil_visual = obtener_perfil_visual_tarea(
        tipo=doc.get("tipo"),
        prioridad=doc.get("prioridad"),
        esta_vencida=bool(doc.get("estaVencida", False)),
    )

    return {
        "id": doc["_id"],
        "titulo": doc["titulo"],
        "descripcion": doc.get("descripcion"),
        "prioridad": doc["prioridad"],
        "tipo": doc["tipo"],
        "fechaVencimiento": doc.get("fechaVencimiento"),
        "horasEstimadas": doc.get("horasEstimadas"),
        "columnaId": doc["columnaId"],
        "proyectoId": doc["proyectoId"],
        "faseId": doc.get("faseId"),
        "etapaId": doc.get("etapaId"),
        "responsables": doc.get("responsables", []),
        "etiquetas": doc.get("etiquetas", []),
        "estaVencida": doc.get("estaVencida", False),
        "subtareas": doc.get("subtareas", []),
        "horasRegistradas": doc.get("horasRegistradas", 0.0),
        "perfilVisual": perfil_visual,
        "creadoEn": doc["creadoEn"],
    }


def _es_columna_completada(nombre_columna: str) -> bool:
    nombre = (nombre_columna or "").lower()
    return "complet" in nombre or "listo" in nombre


async def _obtener_ids_columnas_completadas(db, proyecto_id: str) -> set[str]:
    tablero_ids = [t["_id"] async for t in db["tableros"].find({"proyectoId": proyecto_id}, {"_id": 1})]
    if not tablero_ids:
        return set()
    cursor = db["columnas"].find({"tableroId": {"$in": tablero_ids}}, {"_id": 1, "nombre": 1})
    return {
        columna["_id"]
        async for columna in cursor
        if _es_columna_completada(columna.get("nombre", ""))
    }


async def _obtener_reglas_decoradores_proyecto(db, proyecto_id: str) -> dict:
    proyecto = await db["proyectos"].find_one({"_id": proyecto_id}, {"reglasDecoradores": 1})
    if not proyecto:
        return {}
    reglas = proyecto.get("reglasDecoradores", {})
    return reglas if isinstance(reglas, dict) else {}


async def _construir_servicio_tarea_decorado(db, proyecto_id: str) -> ServicioTareaBase:
    reglas = await _obtener_reglas_decoradores_proyecto(db, proyecto_id)

    async def _crear_operacion(datos: CrearTarea, usuario_id: str) -> dict:
        return await _crear_tarea_base(db, datos, usuario_id)

    async def _actualizar_operacion(tarea_id: str, datos: ActualizarTarea, usuario_id: str) -> dict:
        return await _actualizar_tarea_base(db, tarea_id, datos, usuario_id)

    async def _mover_operacion(tarea_id: str, datos: MoverTarea, usuario_id: str) -> dict:
        return await _mover_tarea_base(db, tarea_id, datos, usuario_id)

    return construir_servicio_tarea(
        db=db,
        reglas_config=reglas,
        crear_operacion=_crear_operacion,
        actualizar_operacion=_actualizar_operacion,
        mover_operacion=_mover_operacion,
    )


async def _crear_tarea_base(db, datos: CrearTarea, usuario_id: str) -> dict:
    """Núcleo de creación de tareas (Factory Method)."""
    fase_id, etapa_id = await _resolver_fase_y_etapa_tarea(
        db,
        datos.proyectoId,
        datos.faseId,
        datos.etapaId,
    )
    creador = obtener_creador(datos.tipo.value)
    nueva_tarea = creador.crear(
        titulo=datos.titulo,
        columna_id=datos.columnaId,
        proyecto_id=datos.proyectoId,
        creado_por=usuario_id,
        descripcion=datos.descripcion,
        responsables=datos.responsables,
        fecha_vencimiento=datos.fechaVencimiento,
        horas_estimadas=datos.horasEstimadas,
        etiquetas=datos.etiquetas,
    )
    if fase_id:
        nueva_tarea["faseId"] = fase_id
    if etapa_id:
        nueva_tarea["etapaId"] = etapa_id
    await db["tareas"].insert_one(nueva_tarea)
    await _registrar_auditoria(
        db,
        "tarea",
        nueva_tarea["_id"],
        "CREADA",
        usuario_id,
        None,
        nueva_tarea,
        datos.proyectoId,
    )
    for responsable_id in datos.responsables:
        await crear_notificacion_interna(
            db,
            responsable_id,
            f"Se te ha asignado la tarea: {datos.titulo}",
            "TAREA_ASIGNADA",
            tarea_id=nueva_tarea["_id"],
            proyecto_id=datos.proyectoId,
            titulo_tarea=datos.titulo,
        )
    return _serializar(nueva_tarea)


async def _actualizar_tarea_base(db, tarea_id: str, datos: ActualizarTarea, usuario_id: str) -> dict:
    """Núcleo de actualización de tareas."""
    tarea = await db["tareas"].find_one({"_id": tarea_id})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    valores_actualizacion = datos.model_dump(exclude_unset=True)
    incluye_fase = "faseId" in valores_actualizacion
    incluye_etapa = "etapaId" in valores_actualizacion

    fase_entrada = valores_actualizacion.pop("faseId", None) if incluye_fase else tarea.get("faseId")
    etapa_entrada = valores_actualizacion.pop("etapaId", None) if incluye_etapa else tarea.get("etapaId")

    cambios_set = {k: v for k, v in valores_actualizacion.items() if v is not None}
    cambios_unset: dict[str, str] = {}

    if incluye_fase or incluye_etapa:
        fase_resuelta, etapa_resuelta = await _resolver_fase_y_etapa_tarea(
            db,
            tarea["proyectoId"],
            fase_entrada,
            etapa_entrada,
        )
        if incluye_fase:
            if fase_resuelta:
                cambios_set["faseId"] = fase_resuelta
            else:
                cambios_unset["faseId"] = ""

        if incluye_etapa:
            if etapa_resuelta:
                cambios_set["etapaId"] = etapa_resuelta
                cambios_set["faseId"] = fase_resuelta
            else:
                cambios_unset["etapaId"] = ""

    cambios_set["actualizadoEn"] = datetime.now(timezone.utc)

    responsables_nuevos = cambios_set.get("responsables", tarea.get("responsables", []))
    responsables_anteriores = tarea.get("responsables", [])
    nuevos_asignados = [r for r in responsables_nuevos if r not in responsables_anteriores]

    operacion: dict = {"$set": cambios_set}
    if cambios_unset:
        operacion["$unset"] = cambios_unset
    await db["tareas"].update_one({"_id": tarea_id}, operacion)

    cambios_auditados = dict(cambios_set)
    if cambios_unset:
        cambios_auditados.update({campo: None for campo in cambios_unset.keys()})
    await _registrar_auditoria(
        db,
        "tarea",
        tarea_id,
        "ACTUALIZADA",
        usuario_id,
        tarea,
        cambios_auditados,
        tarea["proyectoId"],
    )

    for responsable_id in nuevos_asignados:
        await crear_notificacion_interna(
            db,
            responsable_id,
            f"Se te ha asignado la tarea: {tarea['titulo']}",
            "TAREA_ASIGNADA",
            tarea_id=tarea_id,
            proyecto_id=tarea["proyectoId"],
            titulo_tarea=tarea["titulo"],
        )
    return await obtener_tarea(tarea_id)


async def _mover_tarea_base(db, tarea_id: str, datos: MoverTarea, usuario_id: str) -> dict:
    """Núcleo de movimiento de tareas entre columnas."""
    tarea = await db["tareas"].find_one({"_id": tarea_id})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    columna_destino = await db["columnas"].find_one({"_id": datos.columnaIdDestino})
    if not columna_destino:
        raise HTTPException(status_code=404, detail="Columna destino no encontrada")

    if columna_destino.get("limiteWip"):
        tareas_en_columna = await db["tareas"].count_documents({"columnaId": datos.columnaIdDestino})
        if tareas_en_columna >= columna_destino["limiteWip"]:
            raise HTTPException(
                status_code=400,
                detail=f"Límite WIP alcanzado en '{columna_destino['nombre']}'",
            )

    columna_anterior = tarea["columnaId"]
    await db["tareas"].update_one(
        {"_id": tarea_id},
        {"$set": {"columnaId": datos.columnaIdDestino, "actualizadoEn": datetime.now(timezone.utc)}},
    )
    await _registrar_auditoria(
        db,
        "tarea",
        tarea_id,
        "MOVIDA",
        usuario_id,
        {"columnaId": columna_anterior},
        {"columnaId": datos.columnaIdDestino},
        tarea["proyectoId"],
    )

    titulo_tarea = tarea["titulo"]
    for responsable_id in tarea.get("responsables", []):
        await crear_notificacion_interna(
            db,
            responsable_id,
            f"La tarea '{titulo_tarea}' fue movida",
            "ESTADO_TAREA_CAMBIADO",
            tarea_id=tarea_id,
            proyecto_id=tarea["proyectoId"],
            titulo_tarea=titulo_tarea,
        )
    return await obtener_tarea(tarea_id)


async def crear_tarea(datos: CrearTarea, usuario_id: str) -> dict:
    """
    Crear tarea aplicando Decorator dinámico por proyecto:
    validación SLA, notificación automática y auditoría enriquecida.
    """
    db = _db()
    proxy = ProxyGestionTareas(db)

    async def _operacion(_: dict) -> dict:
        servicio = await _construir_servicio_tarea_decorado(db, datos.proyectoId)
        return await servicio.crear(datos, usuario_id)

    return await proxy.ejecutar_creacion_en_proyecto(
        proyecto_id=datos.proyectoId,
        usuario_id=usuario_id,
        accion="CREAR_TAREA",
        operacion=_operacion,
    )


async def crear_tarea_avanzada(datos: dict, usuario_id: str) -> dict:
    """Usa el patrón Builder para construir una tarea con configuración detallada."""
    db = _db()
    proxy = ProxyGestionTareas(db)
    proyecto_id = datos.get("proyectoId")
    if not isinstance(proyecto_id, str) or not proyecto_id.strip():
        raise HTTPException(status_code=400, detail="proyectoId es obligatorio")

    from app.models.enums import TipoTarea, PrioridadTarea

    async def _operacion(_: dict) -> dict:
        constructor = ConstructorTareaAvanzada()
        tarea = (
            constructor
            .con_titulo(datos["titulo"])
            .con_descripcion(datos.get("descripcion"))
            .con_tipo(TipoTarea(datos.get("tipo", "TASK")))
            .con_prioridad(PrioridadTarea(datos.get("prioridad", "MEDIA")))
            .en_columna(datos["columnaId"])
            .en_proyecto(proyecto_id)
            .creado_por(usuario_id)
            .con_responsables(datos.get("responsables", []))
            .con_etiquetas(datos.get("etiquetas", []))
            .con_subtareas(datos.get("subtareas", []))
            .con_metadatos(datos.get("metadatos", {}))
        )
        if datos.get("fechaVencimiento"):
            tarea = tarea.con_fecha_vencimiento(datos["fechaVencimiento"])
        if datos.get("horasEstimadas"):
            tarea = tarea.con_horas_estimadas(datos["horasEstimadas"])
        nueva_tarea = tarea.construir()
        fase_id, etapa_id = await _resolver_fase_y_etapa_tarea(
            db,
            proyecto_id,
            datos.get("faseId"),
            datos.get("etapaId"),
        )
        if fase_id:
            nueva_tarea["faseId"] = fase_id
        if etapa_id:
            nueva_tarea["etapaId"] = etapa_id
        await db["tareas"].insert_one(nueva_tarea)
        return _serializar(nueva_tarea)

    return await proxy.ejecutar_creacion_en_proyecto(
        proyecto_id=proyecto_id,
        usuario_id=usuario_id,
        accion="CREAR_TAREA_AVANZADA",
        operacion=_operacion,
    )


async def listar_tareas_columna(columna_id: str, usuario_id: str, rol: str) -> list:
    db = _db()
    if rol == "ADMIN":
        cursor = db["tareas"].find({"columnaId": columna_id})
    else:
        proyecto_ids = [p["_id"] async for p in db["proyectos"].find({"miembros": usuario_id})]
        cursor = db["tareas"].find({"columnaId": columna_id, "proyectoId": {"$in": proyecto_ids}})
    return [_serializar(t) async for t in cursor]


async def listar_tareas_proyecto(
    proyecto_id: str,
    usuario_id: str,
    rol: str,
    filtros: dict | None = None,
    pagina: int = 1,
    limite: int = 50,
) -> dict:
    """Devuelve tareas paginadas del proyecto con filtros opcionales."""
    db = _db()
    if rol != "ADMIN":
        proyecto = await db["proyectos"].find_one({"_id": proyecto_id})
        if not proyecto or usuario_id not in proyecto.get("miembros", []):
            raise HTTPException(status_code=403, detail="Sin acceso al proyecto")

    query: dict = {"proyectoId": proyecto_id}
    if filtros:
        if filtros.get("texto"):
            query["$text"] = {"$search": filtros["texto"]}
        if filtros.get("responsableId"):
            query["responsables"] = filtros["responsableId"]
        if filtros.get("etiqueta"):
            query["etiquetas"] = filtros["etiqueta"]
        if filtros.get("prioridad"):
            query["prioridad"] = filtros["prioridad"]
        if filtros.get("tipo"):
            query["tipo"] = filtros["tipo"]
        if filtros.get("faseId"):
            query["faseId"] = filtros["faseId"]
        if filtros.get("etapaId"):
            query["etapaId"] = filtros["etapaId"]

    total = await db["tareas"].count_documents(query)
    skip = (pagina - 1) * limite
    cursor = db["tareas"].find(query).skip(skip).limit(limite)
    datos = [_serializar(t) async for t in cursor]
    total_paginas = (total + limite - 1) // limite if total > 0 else 1

    return {
        "datos": datos,
        "pagina": pagina,
        "limite": limite,
        "total": total,
        "totalPaginas": total_paginas,
        "tieneSiguiente": pagina < total_paginas,
        "tieneAnterior": pagina > 1,
    }


async def obtener_tarea(tarea_id: str) -> dict:
    db = _db()
    tarea = await db["tareas"].find_one({"_id": tarea_id})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return _serializar(tarea)


async def obtener_resumen_tarea_compuesta(tarea_id: str) -> dict:
    """
    Construye y serializa el árbol de tareas/subtareas de una raíz usando Composite.
    """
    db = _db()
    tarea_raiz = await db["tareas"].find_one({"_id": tarea_id})
    if not tarea_raiz:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    proyecto_id = tarea_raiz["proyectoId"]
    tareas = [t async for t in db["tareas"].find({"proyectoId": proyecto_id})]
    subtareas = [s async for s in db["subtareas"].find({"proyectoId": proyecto_id})]
    columnas_completadas = await _obtener_ids_columnas_completadas(db, proyecto_id)

    try:
        componente = construir_componente_tarea_desde_raiz(
            tarea_id=tarea_id,
            tareas_por_id={t["_id"]: t for t in tareas},
            subtareas_por_id={s["_id"]: s for s in subtareas},
            columnas_completadas=columnas_completadas,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return serializar_componente_tarea(componente)


async def actualizar_tarea(tarea_id: str, datos: ActualizarTarea, usuario_id: str) -> dict:
    db = _db()
    proxy = ProxyGestionTareas(db)

    async def _operacion(tarea: dict) -> dict:
        servicio = await _construir_servicio_tarea_decorado(db, tarea["proyectoId"])
        return await servicio.actualizar(tarea_id, datos, usuario_id)

    return await proxy.ejecutar_en_tarea(
        tarea_id=tarea_id,
        usuario_id=usuario_id,
        accion="ACTUALIZAR_TAREA",
        operacion=_operacion,
    )


async def asignar_responsables(tarea_id: str, responsables: list[str], usuario_id: str) -> dict:
    db = _db()
    tarea = await db["tareas"].find_one({"_id": tarea_id})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    anteriores = tarea.get("responsables", [])
    nuevos = [r for r in responsables if r not in anteriores]
    await db["tareas"].update_one(
        {"_id": tarea_id},
        {"$set": {"responsables": responsables, "actualizadoEn": datetime.now(timezone.utc)}},
    )
    for r_id in nuevos:
        await crear_notificacion_interna(
            db,
            r_id,
            f"Se te ha asignado la tarea: {tarea['titulo']}",
            "TAREA_ASIGNADA",
            tarea_id=tarea_id,
            proyecto_id=tarea["proyectoId"],
            titulo_tarea=tarea["titulo"],
        )
    return await obtener_tarea(tarea_id)


async def mover_tarea(tarea_id: str, datos: MoverTarea, usuario_id: str) -> dict:
    db = _db()
    proxy = ProxyGestionTareas(db)

    async def _operacion(tarea: dict) -> dict:
        servicio = await _construir_servicio_tarea_decorado(db, tarea["proyectoId"])
        return await servicio.mover(tarea_id, datos, usuario_id)

    return await proxy.ejecutar_en_tarea(
        tarea_id=tarea_id,
        usuario_id=usuario_id,
        accion="MOVER_TAREA",
        operacion=_operacion,
    )


async def clonar_tarea_servicio(tarea_id: str, usuario_id: str) -> dict:
    """Usa el patrón Prototype para clonar la tarea."""
    db = _db()
    proxy = ProxyGestionTareas(db)

    async def _operacion(tarea: dict) -> dict:
        clon = clonar_tarea(tarea)
        await db["tareas"].insert_one(clon)
        return _serializar(clon)

    return await proxy.ejecutar_en_tarea(
        tarea_id=tarea_id,
        usuario_id=usuario_id,
        accion="CLONAR_TAREA",
        operacion=_operacion,
    )


async def eliminar_tarea(tarea_id: str, usuario_id: str) -> dict:
    db = _db()
    proxy = ProxyGestionTareas(db)

    async def _operacion(tarea: dict) -> dict:
        await db["tareas"].delete_one({"_id": tarea_id})
        await db["comentarios"].delete_many({"tareaId": tarea_id})
        await _registrar_auditoria(db, "tarea", tarea_id, "ELIMINADA", usuario_id, tarea, None, tarea["proyectoId"])
        return {"mensaje": "Tarea eliminada"}

    return await proxy.ejecutar_en_tarea(
        tarea_id=tarea_id,
        usuario_id=usuario_id,
        accion="ELIMINAR_TAREA",
        operacion=_operacion,
    )


async def agregar_comentario(tarea_id: str, datos: CrearComentario, usuario_id: str) -> dict:
    db = _db()
    tarea = await db["tareas"].find_one({"_id": tarea_id})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    ahora = datetime.now(timezone.utc)

    # Procesar menciones @usuario
    mencionados = await extraer_y_notificar_menciones(
        db, datos.contenido, usuario_id, tarea["titulo"], tarea["proyectoId"], tarea_id=tarea_id
    )

    comentario = {
        "_id": str(uuid.uuid4()),
        "contenido": datos.contenido,
        "contenidoHtml": resaltar_menciones(datos.contenido),
        "tareaId": tarea_id,
        "autorId": usuario_id,
        "mencionados": mencionados,
        "creadoEn": ahora,
        "actualizadoEn": ahora,
    }
    await db["comentarios"].insert_one(comentario)

    # Notificar a responsables (excepto al autor y ya mencionados)
    for r_id in tarea.get("responsables", []):
        if r_id != usuario_id and r_id not in mencionados:
            await crear_notificacion_interna(
                db,
                r_id,
                f"Nuevo comentario en '{tarea['titulo']}'",
                "COMENTARIO_EN_TAREA",
                tarea_id=tarea_id,
                proyecto_id=tarea["proyectoId"],
                titulo_tarea=tarea["titulo"],
            )

    return _serializar_comentario(comentario)


async def listar_comentarios(tarea_id: str, pagina: int = 1, limite: int = 30) -> dict:
    db = _db()
    total = await db["comentarios"].count_documents({"tareaId": tarea_id})
    skip = (pagina - 1) * limite
    cursor = db["comentarios"].find({"tareaId": tarea_id}, sort=[("creadoEn", 1)]).skip(skip).limit(limite)
    datos = [_serializar_comentario(c) async for c in cursor]
    total_paginas = (total + limite - 1) // limite if total > 0 else 1
    return {
        "datos": datos,
        "pagina": pagina,
        "limite": limite,
        "total": total,
        "totalPaginas": total_paginas,
        "tieneSiguiente": pagina < total_paginas,
        "tieneAnterior": pagina > 1,
    }


def _serializar_comentario(c: dict) -> dict:
    return {
        "id": c["_id"],
        "contenido": c["contenido"],
        "contenidoHtml": c.get("contenidoHtml", c["contenido"]),
        "tareaId": c["tareaId"],
        "autorId": c["autorId"],
        "mencionados": c.get("mencionados", []),
        "creadoEn": c["creadoEn"],
        "actualizadoEn": c["actualizadoEn"],
    }


async def actualizar_comentario(comentario_id: str, datos: ActualizarComentario, usuario_id: str) -> dict:
    db = _db()
    comentario = await db["comentarios"].find_one({"_id": comentario_id})
    if not comentario:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    if comentario["autorId"] != usuario_id:
        raise HTTPException(status_code=403, detail="Solo el autor puede editar el comentario")
    ahora = datetime.now(timezone.utc)
    await db["comentarios"].update_one(
        {"_id": comentario_id},
        {"$set": {
            "contenido": datos.contenido,
            "contenidoHtml": resaltar_menciones(datos.contenido),
            "actualizadoEn": ahora,
        }}
    )
    comentario.update({"contenido": datos.contenido, "actualizadoEn": ahora})
    return _serializar_comentario(comentario)


async def eliminar_comentario(comentario_id: str, usuario_id: str) -> dict:
    db = _db()
    comentario = await db["comentarios"].find_one({"_id": comentario_id})
    if not comentario:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    if comentario["autorId"] != usuario_id:
        raise HTTPException(status_code=403, detail="Solo el autor puede eliminar el comentario")
    await db["comentarios"].delete_one({"_id": comentario_id})
    return {"mensaje": "Comentario eliminado"}


async def registrar_tiempo(tarea_id: str, datos: RegistrarTiempo, usuario_id: str) -> dict:
    db = _db()
    tarea = await db["tareas"].find_one({"_id": tarea_id})
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    registro = {
        "_id": str(uuid.uuid4()),
        "tareaId": tarea_id,
        "usuarioId": usuario_id,
        "horas": datos.horas,
        "registradoEn": datetime.now(timezone.utc),
    }
    await db["registros_tiempo"].insert_one(registro)
    await db["tareas"].update_one({"_id": tarea_id}, {"$inc": {"horasRegistradas": datos.horas}})
    return {"mensaje": f"{datos.horas} horas registradas correctamente"}


async def crear_etiqueta(datos: CrearEtiqueta, usuario_id: str) -> dict:
    db = _db()
    etiqueta = {
        "_id": str(uuid.uuid4()),
        "nombre": datos.nombre,
        "color": datos.color,
        "proyectoId": datos.proyectoId,
    }
    await db["etiquetas"].insert_one(etiqueta)
    return {
        "id": etiqueta["_id"],
        "nombre": etiqueta["nombre"],
        "color": etiqueta["color"],
        "proyectoId": etiqueta["proyectoId"],
    }


async def listar_etiquetas(proyecto_id: str) -> list:
    db = _db()
    cursor = db["etiquetas"].find({"proyectoId": proyecto_id})
    return [{"id": e["_id"], "nombre": e["nombre"], "color": e["color"]} async for e in cursor]


async def obtener_estadisticas_flyweight_tareas() -> dict:
    return obtener_estadisticas_pool_flyweight_tareas()


async def _registrar_auditoria(db, tipo_entidad, entidad_id, accion, usuario_id, valor_anterior, valor_nuevo, proyecto_id):
    await db["registros_auditoria"].insert_one({
        "_id": str(uuid.uuid4()), "tipoEntidad": tipo_entidad, "entidadId": entidad_id,
        "accion": accion, "usuarioId": usuario_id, "valorAnterior": valor_anterior,
        "valorNuevo": valor_nuevo, "proyectoId": proyecto_id, "marca": datetime.now(timezone.utc),
    })

