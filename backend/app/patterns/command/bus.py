import asyncio
from typing import Any

from app.patterns.command.command import Comando


class CommandBus:
    async def ejecutar(self, comando: Comando) -> Any:
        return await comando.ejecutar()

    def ejecutar_en_fondo(self, comando: Comando) -> asyncio.Task:
        return asyncio.create_task(comando.ejecutar())
