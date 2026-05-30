from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any

from fastapi import HTTPException
from app.patterns.state.estado_proyecto import EstadoProyectoFactory


class ValidadorOperacion(ABC):
    def __init__(self, siguiente: "ValidadorOperacion" | None = None) -> None:
        self._siguiente = siguiente

    async def validar(self, contexto: dict[str, Any]) -> None:
        await self._validar(contexto)
        if self._siguiente:
            await self._siguiente.validar(contexto)

    @abstractmethod
    async def _validar(self, contexto: dict[str, Any]) -> None:
        ...


class ValidadorProyectoExiste(ValidadorOperacion):
    async def _validar(self, contexto: dict[str, Any]) -> None:
        db = contexto["db"]
        proyecto_id = contexto["proyecto_id"]
        proyecto = await db["proyectos"].find_one({"_id": proyecto_id})
        if not proyecto:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        contexto["proyecto"] = proyecto


class ValidadorMembresiaProyecto(ValidadorOperacion):
    async def _validar(self, contexto: dict[str, Any]) -> None:
        proyecto = contexto["proyecto"]
        usuario_id = contexto["usuario_id"]
        rol = contexto.get("rol")
        if rol != "ADMIN" and usuario_id not in proyecto.get("miembros", []):
            raise HTTPException(status_code=403, detail="Sin acceso al proyecto")


class ValidadorPropietarioProyecto(ValidadorOperacion):
    async def _validar(self, contexto: dict[str, Any]) -> None:
        proyecto = contexto["proyecto"]
        usuario_id = contexto["usuario_id"]
        rol = contexto.get("rol")
        if rol != "ADMIN" and proyecto.get("propietarioId") != usuario_id:
            raise HTTPException(
                status_code=403,
                detail="Solo el propietario o un Admin puede ejecutar esta accion en el proyecto",
            )


class ValidadorProyectoArchivado(ValidadorOperacion):
    async def _validar(self, contexto: dict[str, Any]) -> None:
        proyecto = contexto["proyecto"]
        estado = EstadoProyectoFactory.crear(proyecto.get("estado"))
        if proyecto.get("estaArchivado") or not estado.puede_editar():
            permitir_archivado = contexto.get("permitir_archivado", False)
            if not permitir_archivado:
                raise HTTPException(status_code=400, detail="El proyecto esta archivado o cerrado y es de solo lectura")


class ValidadorTareaExiste(ValidadorOperacion):
    async def _validar(self, contexto: dict[str, Any]) -> None:
        db = contexto["db"]
        tarea_id = contexto["tarea_id"]
        tarea = await db["tareas"].find_one({"_id": tarea_id})
        if not tarea:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")
        contexto["tarea"] = tarea
        contexto["proyecto_id"] = tarea.get("proyectoId")


class ValidadorWIP(ValidadorOperacion):
    async def _validar(self, contexto: dict[str, Any]) -> None:
        db = contexto["db"]
        columna_destino_id = contexto.get("columna_destino_id")
        if not columna_destino_id:
            return
        columna_destino = await db["columnas"].find_one({"_id": columna_destino_id})
        if columna_destino and columna_destino.get("limiteWip"):
            tareas_en_columna = await db["tareas"].count_documents({"columnaId": columna_destino_id})
            if tareas_en_columna >= columna_destino["limiteWip"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Límite WIP alcanzado en '{columna_destino.get('nombre', columna_destino_id)}'",
                )


class ValidadorSLA(ValidadorOperacion):
    async def _validar(self, contexto: dict[str, Any]) -> None:
        proyecto = contexto.get("proyecto")
        if not proyecto or not proyecto.get("slaActivo"):
            return
        plazo = proyecto.get("slaPlazoHoras")
        if plazo and plazo < 0:
            raise HTTPException(status_code=400, detail="Configuración de SLA inválida")
