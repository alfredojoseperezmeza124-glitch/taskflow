from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from app.schemas.tareas import (
    CrearTarea, ActualizarTarea, MoverTarea,
    CrearComentario, ActualizarComentario, RegistrarTiempo,
    CrearEtiqueta, RespuestaTarea, RespuestaComentario,
    RespuestaEstadisticasFlyweightTareas,
)
from app.services import servicio_tarea
from app.core.dependencias import obtener_usuario_actual, requerir_rol

enrutador = APIRouter(tags=["Tareas"])
_ROLES_TAREA = ("DEVELOPER", "PROJECT_MANAGER", "ADMIN")


@enrutador.post("/tareas", status_code=201, response_model=RespuestaTarea,
    summary="Crear tarea — Factory Method + Decorator + Proxy")
async def crear_tarea(datos: CrearTarea, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.crear_tarea(datos, usuario["_id"])


@enrutador.post("/tareas/avanzada", status_code=201, response_model=RespuestaTarea,
    summary="Crear tarea avanzada — Patrón Builder + Proxy")
async def crear_tarea_avanzada(datos: dict, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.crear_tarea_avanzada(datos, usuario["_id"])


@enrutador.get(
    "/patrones/flyweight/tareas/estadisticas",
    response_model=RespuestaEstadisticasFlyweightTareas,
    summary="Estadísticas del pool Flyweight de tareas",
    description="Muestra cuántos flyweights de perfil visual se comparten actualmente en memoria para tareas.",
)
async def estadisticas_flyweight_tareas(_: dict = Depends(obtener_usuario_actual)):
    return await servicio_tarea.obtener_estadisticas_flyweight_tareas()


@enrutador.get("/columnas/{columna_id}/tareas", response_model=List[RespuestaTarea],
    summary="Listar tareas de una columna")
async def listar_tareas_columna(columna_id: str, usuario: dict = Depends(obtener_usuario_actual)):
    return await servicio_tarea.listar_tareas_columna(columna_id, usuario["_id"], usuario["rol"])


@enrutador.get("/proyectos/{proyecto_id}/tareas",
    summary="Listar tareas del proyecto con paginación y filtros",
    description="Soporta paginación (`pagina`, `limite`) y filtros por texto, responsable, prioridad, tipo, fase y etapa.")
async def listar_tareas_proyecto(
    proyecto_id: str,
    pagina: int = Query(1, ge=1, description="Número de página"),
    limite: int = Query(50, ge=1, le=200, description="Ítems por página"),
    texto: Optional[str] = Query(None),
    responsable_id: Optional[str] = Query(None),
    etiqueta: Optional[str] = Query(None),
    prioridad: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    fase_id: Optional[str] = Query(None),
    etapa_id: Optional[str] = Query(None),
    usuario: dict = Depends(obtener_usuario_actual),
):
    filtros = {k: v for k, v in {
        "texto": texto, "responsableId": responsable_id,
        "etiqueta": etiqueta, "prioridad": prioridad, "tipo": tipo,
        "faseId": fase_id, "etapaId": etapa_id
    }.items() if v}
    return await servicio_tarea.listar_tareas_proyecto(
        proyecto_id, usuario["_id"], usuario["rol"], filtros or None, pagina, limite
    )


@enrutador.get("/tareas/{tarea_id}", response_model=RespuestaTarea,
    summary="Obtener tarea por ID")
async def obtener_tarea(tarea_id: str, _: dict = Depends(obtener_usuario_actual)):
    return await servicio_tarea.obtener_tarea(tarea_id)


@enrutador.get("/tareas/{tarea_id}/jerarquia",
    summary="Resumen jerárquico — Patrón Composite",
    description="Construye el árbol tarea/subtareas y calcula progreso, horas y responsables de forma recursiva.")
async def obtener_jerarquia_tarea(tarea_id: str, _: dict = Depends(obtener_usuario_actual)):
    return await servicio_tarea.obtener_resumen_tarea_compuesta(tarea_id)


@enrutador.put("/tareas/{tarea_id}", response_model=RespuestaTarea,
    summary="Actualizar tarea — Patrón Decorator + Proxy")
async def actualizar_tarea(tarea_id: str, datos: ActualizarTarea, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.actualizar_tarea(tarea_id, datos, usuario["_id"])


@enrutador.put("/tareas/{tarea_id}/responsables", response_model=RespuestaTarea,
    summary="Asignar responsables a tarea")
async def asignar_responsables(tarea_id: str, cuerpo: dict, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.asignar_responsables(tarea_id, cuerpo.get("responsables", []), usuario["_id"])


@enrutador.post("/tareas/{tarea_id}/mover", response_model=RespuestaTarea,
    summary="Mover tarea entre columnas — Patrón Decorator + Proxy")
async def mover_tarea(tarea_id: str, datos: MoverTarea, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.mover_tarea(tarea_id, datos, usuario["_id"])


@enrutador.post("/tareas/{tarea_id}/clonar", status_code=201, response_model=RespuestaTarea,
    summary="Clonar tarea — Patrón Prototype + Proxy")
async def clonar_tarea(tarea_id: str, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.clonar_tarea_servicio(tarea_id, usuario["_id"])


@enrutador.delete("/tareas/{tarea_id}",
    summary="Eliminar tarea")
async def eliminar_tarea(tarea_id: str, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.eliminar_tarea(tarea_id, usuario["_id"])


@enrutador.get("/tareas/{tarea_id}/comentarios",
    summary="Listar comentarios de una tarea con paginación",
    description="Devuelve comentarios paginados. Los comentarios incluyen `contenidoHtml` con menciones resaltadas.")
async def listar_comentarios(
    tarea_id: str,
    pagina: int = Query(1, ge=1),
    limite: int = Query(30, ge=1, le=100),
    _: dict = Depends(obtener_usuario_actual),
):
    return await servicio_tarea.listar_comentarios(tarea_id, pagina, limite)


@enrutador.post("/tareas/{tarea_id}/comentarios", status_code=201,
    summary="Agregar comentario con soporte de menciones @usuario",
    description="Detecta menciones `@nombre` en el texto y envía notificaciones automáticas a los usuarios mencionados.")
async def agregar_comentario(tarea_id: str, datos: CrearComentario, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.agregar_comentario(tarea_id, datos, usuario["_id"])


@enrutador.put("/comentarios/{comentario_id}",
    summary="Editar comentario")
async def actualizar_comentario(comentario_id: str, datos: ActualizarComentario, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.actualizar_comentario(comentario_id, datos, usuario["_id"])


@enrutador.delete("/comentarios/{comentario_id}",
    summary="Eliminar comentario")
async def eliminar_comentario(comentario_id: str, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.eliminar_comentario(comentario_id, usuario["_id"])


@enrutador.post("/tareas/{tarea_id}/tiempo",
    summary="Registrar horas trabajadas en tarea")
async def registrar_tiempo(tarea_id: str, datos: RegistrarTiempo, usuario: dict = Depends(requerir_rol(*_ROLES_TAREA))):
    return await servicio_tarea.registrar_tiempo(tarea_id, datos, usuario["_id"])


@enrutador.post("/etiquetas", status_code=201, summary="Crear etiqueta de proyecto")
async def crear_etiqueta(datos: CrearEtiqueta, usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN"))):
    return await servicio_tarea.crear_etiqueta(datos, usuario["_id"])


@enrutador.get("/proyectos/{proyecto_id}/etiquetas", summary="Listar etiquetas del proyecto")
async def listar_etiquetas(proyecto_id: str, _: dict = Depends(obtener_usuario_actual)):
    return await servicio_tarea.listar_etiquetas(proyecto_id)
