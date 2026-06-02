from __future__ import annotations
from typing import List


def registrar_observadores() -> List:
	try:
		from app.core.gestor_eventos import gestor_eventos
		from app.patterns.observer.observadores import (
			ObservadorSSE,
			ObservadorNotificacionInterna,
			ObservadorAuditoria,
			ObservadorNotificacionExterna,
		)
		from app.services import servicio_notificacion as svc

		return [
			ObservadorSSE(),
			ObservadorNotificacionInterna(),
			ObservadorAuditoria(),
			ObservadorNotificacionExterna(),
		]
	except Exception:
		return []

