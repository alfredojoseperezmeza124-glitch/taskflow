from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
from typing import List
from app.schemas.reportes import (
    GuardarFiltro, ActualizarConfiguracion,
    RespuestaMetricasProyecto, RespuestaFiltroGuardado,
    RespuestaEntradaAuditoria, RespuestaConfiguracion,
)
from app.services import servicio_reporte
from app.core.dependencias import obtener_usuario_actual, requerir_rol
from app.patterns.abstract_factory.fabrica_temas import listar_temas
from app.patterns.bridge.puente_exportacion import (
    ExportadorCSV,
    ExportadorJSON,
    ExportadorPDF,
    ReporteAuditoria,
    ReporteEquipo,
    ReporteTareas,
)

enrutador = APIRouter(tags=["Reportes y Configuración"])


@enrutador.get("/proyectos/{proyecto_id}/metricas",
    summary="Dashboard de métricas del proyecto",
    description="Devuelve: total de tareas, distribución por columna/prioridad/tipo, tareas por usuario, vencidas, completadas, progreso jerárquico (Composite) y velocidad semanal.")
async def metricas(proyecto_id: str, _: dict = Depends(obtener_usuario_actual)):
    return await servicio_reporte.obtener_metricas_proyecto(proyecto_id)


@enrutador.get("/tareas/{tarea_id}/historial", response_model=List[RespuestaEntradaAuditoria],
    summary="Historial de cambios de una tarea",
    description="Devuelve el registro completo de cambios de la tarea, incluyendo valores anteriores y nuevos en cada modificación.")
async def historial_tarea(tarea_id: str, _: dict = Depends(obtener_usuario_actual)):
    return await servicio_reporte.obtener_historial_tarea(tarea_id)


@enrutador.get("/proyectos/{proyecto_id}/auditoria",
    summary="Log de auditoría del proyecto con paginación",
    description="Devuelve registros de auditoría paginados. Usa `pagina` y `limite` para navegar.")
async def auditoria_proyecto(
    proyecto_id: str,
    pagina: int = Query(1, ge=1),
    limite: int = Query(50, ge=1, le=200),
    _: dict = Depends(obtener_usuario_actual),
):
    return await servicio_reporte.obtener_auditoria_proyecto(proyecto_id, pagina, limite)


@enrutador.post("/filtros", status_code=201, response_model=RespuestaFiltroGuardado,
    summary="Guardar filtro personalizado",
    description="Persiste un conjunto de criterios de búsqueda para reutilizarlos en el futuro (RF-07).")
async def guardar_filtro(datos: GuardarFiltro, usuario: dict = Depends(obtener_usuario_actual)):
    return await servicio_reporte.guardar_filtro(datos, usuario["_id"])


@enrutador.get("/proyectos/{proyecto_id}/filtros", response_model=List[RespuestaFiltroGuardado],
    summary="Listar filtros guardados del proyecto",
    description="Devuelve los filtros guardados por el usuario autenticado en el proyecto.")
async def listar_filtros(proyecto_id: str, usuario: dict = Depends(obtener_usuario_actual)):
    return await servicio_reporte.listar_filtros_guardados(proyecto_id, usuario["_id"])


@enrutador.get("/temas",
    summary="Listar todos los temas — Patrón Abstract Factory",
    description="Devuelve todos los temas disponibles con sus variables CSS completas generadas por cada fábrica concreta.")
async def listar_todos_temas(_: dict = Depends(obtener_usuario_actual)):
    return listar_temas()


@enrutador.get("/temas/{nombre_tema}",
    summary="Obtener tema visual — Patrón Abstract Factory",
    description="**Patrón Abstract Factory:** Devuelve la familia completa de variables CSS para el tema solicitado. Temas disponibles: `oscuro`, `claro`, `azul`.")
async def obtener_tema(nombre_tema: str, _: dict = Depends(obtener_usuario_actual)):
    return await servicio_reporte.obtener_tema(nombre_tema)


@enrutador.get("/configuracion", response_model=RespuestaConfiguracion,
    summary="Obtener configuración del sistema",
    description="Devuelve los parámetros globales: nombre de la plataforma, tamaño máximo de archivos, políticas de contraseña y tema activo.")
async def obtener_config(_: dict = Depends(obtener_usuario_actual)):
    return await servicio_reporte.obtener_configuracion()


@enrutador.put("/configuracion", response_model=RespuestaConfiguracion,
    summary="Actualizar configuración del sistema",
    description="Modifica los parámetros globales de la plataforma. **Solo ADMIN.**")
async def actualizar_config(datos: ActualizarConfiguracion, _: dict = Depends(requerir_rol("ADMIN"))):
    return await servicio_reporte.actualizar_configuracion(datos)


@enrutador.get(
    "/proyectos/{proyecto_id}/exportar",
    summary="Exportar reportes — Patrón Bridge",
    description="Exporta reportes de tareas, auditoría o equipo en formatos PDF, CSV o JSON usando el patrón Bridge.",
)
async def exportar_reporte(
    proyecto_id: str,
    tipo: str = Query("tareas", pattern="^(tareas|auditoria|equipo)$"),
    formato: str = Query("json", pattern="^(pdf|csv|json)$"),
    usuario: dict = Depends(obtener_usuario_actual),
):
    reportes = {
        "tareas": ReporteTareas,
        "auditoria": ReporteAuditoria,
        "equipo": ReporteEquipo,
    }
    exportadores = {
        "pdf": ExportadorPDF,
        "csv": ExportadorCSV,
        "json": ExportadorJSON,
    }

    try:
        reporte = reportes[tipo](exportadores[formato]())
        contenido, mime, nombre_archivo = await reporte.exportar(proyecto_id, usuario)
    except KeyError:
        raise HTTPException(status_code=400, detail="Tipo de reporte o formato no soportado")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

    return Response(
        content=contenido,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )
