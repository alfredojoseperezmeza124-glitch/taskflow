from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Optional
from fastapi import HTTPException

from app.db.conexion import ConexionMongoDB


class Validador(ABC):
	def __init__(self, siguiente: Optional["Validador"] = None) -> None:
		self.siguiente = siguiente

	async def manejar(self, datos: Any) -> None:
		await self.validar(datos)
		if self.siguiente:
			await self.siguiente.manejar(datos)

	@abstractmethod
	async def validar(self, datos: Any) -> None:
		"""Lanza excepción si la validación falla; no retorna nada si es válida."""
		...


class ValidadorNoOp(Validador):
	async def validar(self, datos: Any) -> None:
		return None


def chain(*validadores: Optional[Validador]) -> Validador:
	head: Validador | None = None
	tail: Validador | None = None
	for v in (validadores or []):
		if v is None:
			continue
		if head is None:
			head = v
			tail = v
		else:
			assert tail is not None
			tail.siguiente = v
			tail = v
	return head or ValidadorNoOp()


class ValidadorTareaExiste(Validador):
	async def validar(self, datos: Any) -> None:
		db = datos.get("db") or ConexionMongoDB.obtener_instancia().obtener_base_datos()
		tarea_id = datos.get("tarea_id")
		tarea = await db["tareas"].find_one({"_id": tarea_id}) if tarea_id else None
		if not tarea:
			raise HTTPException(status_code=404, detail="Tarea no encontrada")
		datos["tarea"] = tarea
		datos["proyecto_id"] = tarea.get("proyectoId")


class ValidadorColumnaExiste(Validador):
	async def validar(self, datos: Any) -> None:
		db = datos.get("db") or ConexionMongoDB.obtener_instancia().obtener_base_datos()
		columna_id = datos.get("columna_destino_id")
		columna = await db["columnas"].find_one({"_id": columna_id}) if columna_id else None
		if not columna:
			raise HTTPException(status_code=404, detail="Columna destino no encontrada")
		datos["columna_destino"] = columna


class ValidadorWIP(Validador):
	async def validar(self, datos: Any) -> None:
		db = datos.get("db") or ConexionMongoDB.obtener_instancia().obtener_base_datos()
		columna = datos.get("columna_destino")
		columna_id = datos.get("columna_destino_id")
		if not columna and not columna_id:
			return
		limite = columna.get("limiteWip") if columna else None
		if limite:
			tareas_en_columna = await db["tareas"].count_documents({"columnaId": columna_id})
			if tareas_en_columna >= limite:
				raise HTTPException(status_code=400, detail=f"Límite WIP alcanzado en '{columna.get('nombre', columna_id)}'")

