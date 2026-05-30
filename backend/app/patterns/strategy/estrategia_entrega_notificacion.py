from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any

from app.models.enums import CanalNotificacion


class EntregaNotificacionStrategy(ABC):
    @abstractmethod
    def canales(self) -> list[CanalNotificacion]:
        ...


class SoloInAppStrategy(EntregaNotificacionStrategy):
    def canales(self) -> list[CanalNotificacion]:
        return [CanalNotificacion.IN_APP]


class SoloEmailStrategy(EntregaNotificacionStrategy):
    def canales(self) -> list[CanalNotificacion]:
        return [CanalNotificacion.EMAIL]


class AmbosStrategy(EntregaNotificacionStrategy):
    def canales(self) -> list[CanalNotificacion]:
        return [CanalNotificacion.IN_APP, CanalNotificacion.EMAIL]


class MultiCanalStrategy(EntregaNotificacionStrategy):
    def canales(self) -> list[CanalNotificacion]:
        return [CanalNotificacion.IN_APP, CanalNotificacion.EMAIL]


class EstrategiaEntregaNotificacionFactory:
    _ESTRATEGIAS = {
        CanalNotificacion.IN_APP.value: SoloInAppStrategy,
        CanalNotificacion.EMAIL.value: SoloEmailStrategy,
        CanalNotificacion.AMBOS.value: AmbosStrategy,
    }

    @staticmethod
    def seleccionar(preferencias: dict[str, Any], canal_solicitado: str | None = None) -> EntregaNotificacionStrategy:
        canal_preferido = (
            canal_solicitado.upper().strip()
            if canal_solicitado
            else preferencias.get("canal", CanalNotificacion.IN_APP.value)
        )

        estrategia_cls = EstrategiaEntregaNotificacionFactory._ESTRATEGIAS.get(
            canal_preferido,
            SoloInAppStrategy,
        )
        return estrategia_cls()
