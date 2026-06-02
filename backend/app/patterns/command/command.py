from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable


class Comando(ABC):
	@abstractmethod
	async def ejecutar(self) -> Any:  # pragma: no cover - simple contract
		...


class ComandoGenerico(Comando):
	def __init__(self, func: Callable[..., Any] | Callable[..., Awaitable[Any]], *args, **kwargs) -> None:
		self._func = func
		self._args = args
		self._kwargs = kwargs

	async def ejecutar(self) -> Any:
		try:
			res = self._func(*self._args, **self._kwargs)
			if hasattr(res, "__await__"):
				return await res
			return res
		except Exception:
			# Propagar para que el bus o el caller puedan manejarlo
			raise

