from __future__ import annotations
import asyncio
from typing import Any
from app.patterns.command.command import Comando


class CommandBus:
	async def dispatch(self, comando: Comando) -> Any:
		return await comando.ejecutar()

	def dispatch_background(self, comando: Comando) -> asyncio.Task:
		"""Ejecuta el comando en segundo plano y devuelve la tarea creada."""
		return asyncio.create_task(comando.ejecutar())


# Instancia compartida por conveniencia
command_bus = CommandBus()

