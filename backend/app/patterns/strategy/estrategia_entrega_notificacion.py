from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, List

from app.models.enums import CanalNotificacion


class EntregaNotificacionStrategy(ABC):
    @abstractmethod
    def canales(self) -> List[CanalNotificacion]:
        """Devuelve la lista de canales a usar para la entrega."""


class SoloInAppStrategy(EntregaNotificacionStrategy):
    def canales(self) -> List[CanalNotificacion]:
        return [CanalNotificacion.IN_APP]


class SoloEmailStrategy(EntregaNotificacionStrategy):
    def canales(self) -> List[CanalNotificacion]:
        return [CanalNotificacion.EMAIL]


class AmbosStrategy(EntregaNotificacionStrategy):
    def canales(self) -> List[CanalNotificacion]:
        return [CanalNotificacion.IN_APP, CanalNotificacion.EMAIL]


class MultiCanalStrategy(EntregaNotificacionStrategy):
    def canales(self) -> List[CanalNotificacion]:
        # Por ahora coincide con AmbosStrategy; separado por claridad conceptual
        return [CanalNotificacion.IN_APP, CanalNotificacion.EMAIL]


class EstrategiaEntregaNotificacionFactory:
    _ESTRATEGIAS: dict[str, type[EntregaNotificacionStrategy]] = {
        CanalNotificacion.IN_APP.value: SoloInAppStrategy,
        CanalNotificacion.EMAIL.value: SoloEmailStrategy,
        CanalNotificacion.AMBOS.value: AmbosStrategy,
    }
    @staticmethod
    def seleccionar(preferencias: dict[str, Any], canal_solicitado: str | None = None) -> EntregaNotificacionStrategy:
        if canal_solicitado:
            canal = canal_solicitado.upper().strip()
        else:
            canal = (preferencias.get("canal") or CanalNotificacion.IN_APP.value).upper().strip()

        estrategia_cls = EstrategiaEntregaNotificacionFactory._ESTRATEGIAS.get(canal, SoloInAppStrategy)
        return estrategia_cls()
