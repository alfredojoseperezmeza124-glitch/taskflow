from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
import uuid

from app.db.conexion import ConexionMongoDB
from app.schemas.reportes import GuardarFiltro, ActualizarConfiguracion
from app.patterns.abstract_factory.fabrica_temas import obtener_variables_tema
from app.patterns.composite.componente_tarea import (
    construir_componente_proyecto_jerarquico,
    construir_bosque_tareas,
    calcular_progreso_global_compuesto,
)


def _db():
    return ConexionMongoDB.obtener_instancia().obtener_base_datos()


def _es_columna_completada(nombre_columna: str) -> bool:
    nombre = (nombre_columna or "").lower()
    return "complet" in nombre or "listo" in nombre


async def obtener_metricas_proyecto(proyecto_id: str) -> dict:
    """Métricas completas: distribución real por nombre de columna, velocidad semanal."""
    db = _db()

    # Cargar columnas para mapear ID → nombre
    tableros = [t async for t in db["tableros"].find({"proyectoId": proyecto_id})]
    tablero_ids = [t["_id"] for t in tableros]
    columnas = {
        c["_id"]: c["nombre"]
        async for c in db["columnas"].find({"tableroId": {"$in": tablero_ids}})
    }

    tareas = [t async for t in db["tareas"].find({"proyectoId": proyecto_id})]
    subtareas = [s async for s in db["subtareas"].find({"proyectoId": proyecto_id})]
    fases = [f async for f in db["fases"].find({"proyectoId": proyecto_id})]
    etapas = [e async for e in db["etapas"].find({"proyectoId": proyecto_id})]
    columnas_completadas = {
        columna_id
        for columna_id, nombre in columnas.items()
        if _es_columna_completada(nombre)
    }

    ahora = datetime.now(timezone.utc)
    tareas_por_estado: dict = {}      # columna nombre → count
    tareas_por_usuario: dict = {}     # usuario_id → count
    tareas_por_prioridad: dict = {}   # prioridad → count
    tareas_por_tipo: dict = {}        # tipo → count
    vencidas = 0
    completadas = 0

    for tarea in tareas:
        # Por columna (nombre real)
        col_id = tarea.get("columnaId", "")
        col_nombre = columnas.get(col_id, col_id[-6:] if col_id else "Sin columna")
        tareas_por_estado[col_nombre] = tareas_por_estado.get(col_nombre, 0) + 1

        # Detectar columna de completados
        if _es_columna_completada(col_nombre):
            completadas += 1

        # Por responsable
        for resp in tarea.get("responsables", []):
            tareas_por_usuario[resp] = tareas_por_usuario.get(resp, 0) + 1

        # Por prioridad
        prio = tarea.get("prioridad", "MEDIA")
        tareas_por_prioridad[prio] = tareas_por_prioridad.get(prio, 0) + 1

        # Por tipo
        tipo = tarea.get("tipo", "TASK")
        tareas_por_tipo[tipo] = tareas_por_tipo.get(tipo, 0) + 1

        # Vencidas
        fecha_venc = tarea.get("fechaVencimiento")
        if fecha_venc and isinstance(fecha_venc, datetime):
            # Normalizar a offset-aware si viene sin timezone de MongoDB
            fv = fecha_venc.replace(tzinfo=timezone.utc) if fecha_venc.tzinfo is None else fecha_venc
            if fv < ahora:
                vencidas += 1

    total = len(tareas)
    try:
        if fases:
            proyecto = await db["proyectos"].find_one({"_id": proyecto_id})
            if not proyecto:
                raise HTTPException(status_code=404, detail="Proyecto no encontrado")
            componente = construir_componente_proyecto_jerarquico(
                proyecto=proyecto,
                fases=fases,
                etapas=etapas,
                subtareas=subtareas,
            )
            progreso = componente.calcular_progreso()
        else:
            bosque = construir_bosque_tareas(
                tareas=tareas,
                subtareas=subtareas,
                columnas_completadas=columnas_completadas,
            )
            progreso = calcular_progreso_global_compuesto(bosque)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Velocidad: tareas creadas/completadas en las últimas 8 semanas
    velocidad = await _calcular_velocidad_semanal(db, proyecto_id, semanas=8)

    return {
        "proyectoId": proyecto_id,
        "totalTareas": total,
        "tareasPorEstado": tareas_por_estado,
        "tareasPorUsuario": tareas_por_usuario,
        "tareasPorPrioridad": tareas_por_prioridad,
        "tareasPorTipo": tareas_por_tipo,
        "tareasVencidas": vencidas,
        "tareasCompletadas": completadas,
        "progreso": progreso,
        "velocidadPorSemana": velocidad,
    }


async def _calcular_velocidad_semanal(db, proyecto_id: str, semanas: int = 8) -> list:
    ahora = datetime.now(timezone.utc)
    resultado = []
    for i in range(semanas - 1, -1, -1):
        inicio = ahora - timedelta(weeks=i + 1)
        fin    = ahora - timedelta(weeks=i)
        creadas = await db["tareas"].count_documents({
            "proyectoId": proyecto_id,
            "creadoEn": {"$gte": inicio, "$lt": fin},
        })
        semana_label = (ahora - timedelta(weeks=i)).strftime("S%U")
        resultado.append({"semana": semana_label, "creadas": creadas})
    return resultado


async def obtener_historial_tarea(tarea_id: str) -> list:
    db = _db()
    cursor = db["registros_auditoria"].find(
        {"entidadId": tarea_id, "tipoEntidad": "tarea"},
        sort=[("marca", -1)],
    )
    return [
        {
            "id": r["_id"], "tipoEntidad": r["tipoEntidad"],
            "entidadId": r["entidadId"], "accion": r["accion"],
            "usuarioId": r["usuarioId"], "valorAnterior": r.get("valorAnterior"),
            "valorNuevo": r.get("valorNuevo"), "marca": r["marca"],
        }
        async for r in cursor
    ]


async def obtener_auditoria_proyecto(proyecto_id: str, pagina: int = 1, limite: int = 50) -> dict:
    db = _db()
    total = await db["registros_auditoria"].count_documents({"proyectoId": proyecto_id})
    skip = (pagina - 1) * limite
    cursor = db["registros_auditoria"].find(
        {"proyectoId": proyecto_id},
        sort=[("marca", -1)],
    ).skip(skip).limit(limite)
    datos = [
        {
            "id": r["_id"], "tipoEntidad": r["tipoEntidad"],
            "entidadId": r["entidadId"], "accion": r["accion"],
            "usuarioId": r["usuarioId"], "valorAnterior": r.get("valorAnterior"),
            "valorNuevo": r.get("valorNuevo"), "marca": r["marca"],
        }
        async for r in cursor
    ]
    total_paginas = (total + limite - 1) // limite if total > 0 else 1
    return {
        "datos": datos, "pagina": pagina, "limite": limite,
        "total": total, "totalPaginas": total_paginas,
        "tieneSiguiente": pagina < total_paginas,
        "tieneAnterior": pagina > 1,
    }


async def guardar_filtro(datos: GuardarFiltro, usuario_id: str) -> dict:
    db = _db()
    filtro = {
        "_id": str(uuid.uuid4()), "nombre": datos.nombre,
        "proyectoId": datos.proyectoId, "usuarioId": usuario_id,
        "criterios": datos.criterios.model_dump(),
        "creadoEn": datetime.now(timezone.utc),
    }
    await db["filtros_guardados"].insert_one(filtro)
    return {"id": filtro["_id"], "nombre": filtro["nombre"],
            "proyectoId": filtro["proyectoId"], "usuarioId": filtro["usuarioId"],
            "criterios": filtro["criterios"]}


async def listar_filtros_guardados(proyecto_id: str, usuario_id: str) -> list:
    db = _db()
    cursor = db["filtros_guardados"].find({"proyectoId": proyecto_id, "usuarioId": usuario_id})
    return [{"id": f["_id"], "nombre": f["nombre"], "proyectoId": f["proyectoId"],
             "usuarioId": f["usuarioId"], "criterios": f["criterios"]}
            async for f in cursor]


async def obtener_configuracion() -> dict:
    db = _db()
    config = await db["configuracion_sistema"].find_one({"_id": "global"})

    # Valores por defecto
    defaults = {
        "nombrePlataforma": "TaskFlow",
        "tamanoMaxArchivoMb": 10,
        "zona_horaria": "America/Bogota",
        "tema": "oscuro",
        "politicaContrasena": {
            "longitudMinima": 8, "requiereMayusculas": True,
            "requiereNumeros": True, "requiereSimbolos": False, "caducidadDias": 90,
        },
    }

    if not config:
        config = defaults
    else:
        # Completar campos faltantes con defaults
        for k, v in defaults.items():
            if k not in config:
                config[k] = v

    # Agregar variables del tema (Abstract Factory)
    tema_actual = config.get("tema", "oscuro")
    try:
        config["temaVariables"] = obtener_variables_tema(tema_actual)
    except Exception:
        config["temaVariables"] = obtener_variables_tema("oscuro")

    # Devolver dict limpio sin _id de MongoDB
    return {k: v for k, v in config.items() if k != "_id"}


async def actualizar_configuracion(datos: ActualizarConfiguracion) -> dict:
    db = _db()
    cambios = datos.model_dump(exclude_none=True)
    await db["configuracion_sistema"].update_one({"_id": "global"}, {"$set": cambios}, upsert=True)
    return await obtener_configuracion()


async def obtener_tema(nombre_tema: str) -> dict:
    try:
        return obtener_variables_tema(nombre_tema)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
