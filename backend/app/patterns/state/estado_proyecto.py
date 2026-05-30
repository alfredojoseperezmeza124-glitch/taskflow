from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Iterable

from fastapi import HTTPException
from app.models.enums import EstadoProyecto as EstadoProyectoEnum


class EstadoProyectoBase(ABC):
    def __init__(self, nombre: str) -> None:
        self.nombre = nombre

    @abstractmethod
    def puede_crear_tarea(self) -> bool:
        ...

    @abstractmethod
    def puede_editar(self) -> bool:
        ...

    def puede_archivar(self) -> bool:
        return self.nombre != EstadoProyectoEnum.ARCHIVADO.value

    @abstractmethod
    def transiciones_validas(self) -> set[str]:
        ...

    def validar_transicion(self, siguiente: str) -> None:
        if siguiente not in self.transiciones_validas():
            raise HTTPException(
                status_code=400,
                detail=f"Transición inválida de {self.nombre} a {siguiente}",
            )


class EstadoPlanificado(EstadoProyectoBase):
    def __init__(self) -> None:
        super().__init__(EstadoProyectoEnum.PLANIFICADO.value)

    def puede_crear_tarea(self) -> bool:
        return True

    def puede_editar(self) -> bool:
        return True

    def transiciones_validas(self) -> set[str]:
        return {
            EstadoProyectoEnum.EN_PROGRESO.value,
            EstadoProyectoEnum.PAUSADO.value,
            EstadoProyectoEnum.ARCHIVADO.value,
        }


class EstadoEnProgreso(EstadoProyectoBase):
    def __init__(self) -> None:
        super().__init__(EstadoProyectoEnum.EN_PROGRESO.value)

    def puede_crear_tarea(self) -> bool:
        return True

    def puede_editar(self) -> bool:
        return True

    def transiciones_validas(self) -> set[str]:
        return {
            EstadoProyectoEnum.PAUSADO.value,
            EstadoProyectoEnum.COMPLETADO.value,
            EstadoProyectoEnum.ARCHIVADO.value,
        }


class EstadoPausado(EstadoProyectoBase):
    def __init__(self) -> None:
        super().__init__(EstadoProyectoEnum.PAUSADO.value)

    def puede_crear_tarea(self) -> bool:
        return True

    def puede_editar(self) -> bool:
        return True

    def transiciones_validas(self) -> set[str]:
        return {
            EstadoProyectoEnum.EN_PROGRESO.value,
            EstadoProyectoEnum.COMPLETADO.value,
            EstadoProyectoEnum.ARCHIVADO.value,
        }


class EstadoCompletado(EstadoProyectoBase):
    def __init__(self) -> None:
        super().__init__(EstadoProyectoEnum.COMPLETADO.value)

    def puede_crear_tarea(self) -> bool:
        return False

    def puede_editar(self) -> bool:
        return True

    def transiciones_validas(self) -> set[str]:
        return {
            EstadoProyectoEnum.ARCHIVADO.value,
        }


class EstadoArchivado(EstadoProyectoBase):
    def __init__(self) -> None:
        super().__init__(EstadoProyectoEnum.ARCHIVADO.value)

    def puede_crear_tarea(self) -> bool:
        return False

    def puede_editar(self) -> bool:
        return False

    def transiciones_validas(self) -> set[str]:
        return set()


class EstadoProyectoFactory:
    @staticmethod
    def crear(estado_nombre: str | None) -> EstadoProyectoBase:
        nombre = (estado_nombre or EstadoProyectoEnum.PLANIFICADO.value).upper()
        if nombre == EstadoProyectoEnum.EN_PROGRESO.value:
            return EstadoEnProgreso()
        if nombre == EstadoProyectoEnum.PAUSADO.value:
            return EstadoPausado()
        if nombre == EstadoProyectoEnum.COMPLETADO.value:
            return EstadoCompletado()
        if nombre == EstadoProyectoEnum.ARCHIVADO.value:
            return EstadoArchivado()
        return EstadoPlanificado()
