"""
PATRON FACADE - FachadaGestionProyectos
Encapsula operaciones complejas de gestion de proyectos para exponer una
interfaz simple desde los servicios.
"""
from __future__ import annotations

from datetime import datetime, timezone
import uuid

from app.schemas.proyectos import CrearProyecto


class FachadaGestionProyectos:
    def __init__(self, db) -> None:
        self._db = db

    async def _columnas_por_defecto(self, tablero_id: str) -> list[dict]:
        nombres = ["Por hacer", "En progreso", "En revisión", "Completado"]
        return [
            {
                "_id": str(uuid.uuid4()),
                "nombre": nombre,
                "tableroId": tablero_id,
                "posicion": i,
                "limiteWip": None,
            }
            for i, nombre in enumerate(nombres)
        ]

    async def crear_proyecto_con_estructura(self, datos: CrearProyecto, propietario_id: str) -> dict:
        ahora = datetime.now(timezone.utc)
        proyecto_id = str(uuid.uuid4())
        tablero_id = str(uuid.uuid4())

        admins = [u["_id"] async for u in self._db["usuarios"].find({"rol": "ADMIN"})]
        miembros_iniciales = list(dict.fromkeys([propietario_id, *admins]))

        proyecto = {
            "_id": proyecto_id,
            "nombre": datos.nombre,
            "descripcion": datos.descripcion,
            "fechaInicio": datos.fechaInicio.isoformat(),
            "fechaFinEstimada": datos.fechaFinEstimada.isoformat(),
            "estado": "PLANIFICADO",
            "propietarioId": propietario_id,
            "estaArchivado": False,
            "progreso": 0.0,
            "miembros": miembros_iniciales,
            "reglasDecoradores": {
                "auditoriaEnriquecidaActiva": True,
                "notificacionAutomaticaActiva": True,
                "validacionSlaActiva": True,
                "maxHorasPorTarea": 80.0,
                "notificarBugUrgenteAlPm": True,
                "validarHorasAntesDeMoverEnProgreso": True,
            },
            "creadoEn": ahora,
            "actualizadoEn": ahora,
        }
        tablero = {
            "_id": tablero_id,
            "nombre": "Tablero principal",
            "proyectoId": proyecto_id,
            "esPorDefecto": True,
            "creadoEn": ahora,
        }
        columnas = await self._columnas_por_defecto(tablero_id)

        await self._db["proyectos"].insert_one(proyecto)
        await self._db["tableros"].insert_one(tablero)
        await self._db["columnas"].insert_many(columnas)

        return proyecto

    async def eliminar_proyecto_completo(self, proyecto_id: str) -> dict:
        tablero_ids = [t["_id"] async for t in self._db["tableros"].find({"proyectoId": proyecto_id}, {"_id": 1})]
        tarea_ids = [t["_id"] async for t in self._db["tareas"].find({"proyectoId": proyecto_id}, {"_id": 1})]
        total_comentarios = 0
        total_tiempo = 0
        if tarea_ids:
            resultado_comentarios = await self._db["comentarios"].delete_many({"tareaId": {"$in": tarea_ids}})
            total_comentarios = resultado_comentarios.deleted_count
            resultado_tiempo = await self._db["registros_tiempo"].delete_many({"tareaId": {"$in": tarea_ids}})
            total_tiempo = resultado_tiempo.deleted_count

        total_columnas = 0
        if tablero_ids:
            resultado_columnas = await self._db["columnas"].delete_many({"tableroId": {"$in": tablero_ids}})
            total_columnas = resultado_columnas.deleted_count

        resultado_subtareas = await self._db["subtareas"].delete_many({"proyectoId": proyecto_id})
        total_subtareas = resultado_subtareas.deleted_count

        resultado_tareas = await self._db["tareas"].delete_many({"proyectoId": proyecto_id})
        resultado_etapas = await self._db["etapas"].delete_many({"proyectoId": proyecto_id})
        resultado_fases = await self._db["fases"].delete_many({"proyectoId": proyecto_id})
        resultado_tableros = await self._db["tableros"].delete_many({"proyectoId": proyecto_id})
        resultado_etiquetas = await self._db["etiquetas"].delete_many({"proyectoId": proyecto_id})
        resultado_notificaciones = await self._db["notificaciones"].delete_many({"proyectoId": proyecto_id})
        resultado_filtros = await self._db["filtros_guardados"].delete_many({"proyectoId": proyecto_id})
        resultado_auditoria = await self._db["registros_auditoria"].delete_many({"proyectoId": proyecto_id})
        resultado_proyecto = await self._db["proyectos"].delete_one({"_id": proyecto_id})

        return {
            "proyectoEliminado": resultado_proyecto.deleted_count,
            "tareasEliminadas": resultado_tareas.deleted_count,
            "subtareasEliminadas": total_subtareas,
            "comentariosEliminados": total_comentarios,
            "registrosTiempoEliminados": total_tiempo,
            "fasesEliminadas": resultado_fases.deleted_count,
            "etapasEliminadas": resultado_etapas.deleted_count,
            "tablerosEliminados": resultado_tableros.deleted_count,
            "columnasEliminadas": total_columnas,
            "etiquetasEliminadas": resultado_etiquetas.deleted_count,
            "notificacionesEliminadas": resultado_notificaciones.deleted_count,
            "filtrosEliminados": resultado_filtros.deleted_count,
            "registrosAuditoriaEliminados": resultado_auditoria.deleted_count,
        }

