from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable


class Comando(ABC):
    @abstractmethod
    async def ejecutar(self) -> Any:
        ...

    @abstractmethod
    def descripcion_auditoria(self) -> str:
        ...


class ComandoGenerico(Comando):
    def __init__(self, descripcion: str, operacion: Callable[[], Awaitable[Any]]) -> None:
        self._descripcion = descripcion
        self._operacion = operacion

    async def ejecutar(self) -> Any:
        return await self._operacion()

    def descripcion_auditoria(self) -> str:
        return self._descripcion
