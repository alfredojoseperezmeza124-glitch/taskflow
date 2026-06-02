from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Dict, List


class EstadoProyectoBase(ABC):
	nombre: str

	@abstractmethod
	def transiciones_posibles(self) -> List[str]:
		...

	def puede_transicionar_a(self, destino: str) -> bool:
		return destino in self.transiciones_posibles()


class EstadoPlanificado(EstadoProyectoBase):
	nombre = "PLANIFICADO"

	def transiciones_posibles(self) -> List[str]:
		return ["EN_PROGRESO", "PAUSADO", "ARCHIVADO"]


class EstadoEnProgreso(EstadoProyectoBase):
	nombre = "EN_PROGRESO"

	def transiciones_posibles(self) -> List[str]:
		return ["PAUSADO", "COMPLETADO", "ARCHIVADO"]


class EstadoPausado(EstadoProyectoBase):
	nombre = "PAUSADO"

	def transiciones_posibles(self) -> List[str]:
		return ["EN_PROGRESO", "ARCHIVADO"]


class EstadoCompletado(EstadoProyectoBase):
	nombre = "COMPLETADO"

	def transiciones_posibles(self) -> List[str]:
		return ["ARCHIVADO"]


class EstadoArchivado(EstadoProyectoBase):
	nombre = "ARCHIVADO"

	def transiciones_posibles(self) -> List[str]:
		return []


class EstadoProyectoFactory:
	_MAP = {
		"PLANIFICADO": EstadoPlanificado,
		"EN_PROGRESO": EstadoEnProgreso,
		"PAUSADO": EstadoPausado,
		"COMPLETADO": EstadoCompletado,
		"ARCHIVADO": EstadoArchivado,
	}

	@staticmethod
	def crear(nombre: str) -> EstadoProyectoBase:
		cls = EstadoProyectoFactory._MAP.get((nombre or "").upper(), EstadoPlanificado)
		return cls()

