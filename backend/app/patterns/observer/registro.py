from app.patterns.observer.observadores import (
    ObservadorSSE,
    ObservadorNotificacionInterna,
    ObservadorAuditoria,
    ObservadorNotificacionExterna,
)
from app.patterns.observer.eventos import EventoDominio


def registrar_observadores(gestor_eventos) -> None:
    gestor_eventos.registrar_observador(ObservadorSSE())
    gestor_eventos.registrar_observador(ObservadorNotificacionInterna())
    gestor_eventos.registrar_observador(ObservadorAuditoria())
    gestor_eventos.registrar_observador(ObservadorNotificacionExterna())
