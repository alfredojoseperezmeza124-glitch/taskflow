"""
PATRÓN FACTORY METHOD — FabricaNotificaciones
Combinado con ADAPTER para seleccionar y crear el adaptador correcto
según el canal de notificación.
"""
from abc import ABC, abstractmethod
from app.patterns.adapter.notificacion_adapter import INotificacionAdapter
from app.patterns.adapter.adaptees import WhatsAppAdaptee, EmailAdaptee, SmsAdaptee



class FabricaNotificacion(ABC):
    """
    Factory Method abstracto. Define el método get() que retorna un adaptador concreto,
    y el método create() que las subclases implementan para decidir qué adaptador crear.
    """

    def get(self) -> INotificacionAdapter:
        """Retorna el adaptador creado por la fábrica concreta."""
        return self.create()

    @abstractmethod
    def create(self) -> INotificacionAdapter:
        """Las subclases deciden qué adaptador concreto instanciar."""
        pass



class FabricaWhatsApp(FabricaNotificacion):
    """Fábrica concreta que crea un WhatsAppAdaptee."""

    def create(self) -> INotificacionAdapter:
        return WhatsAppAdaptee()


class FabricaEmail(FabricaNotificacion):
    """Fábrica concreta que crea un EmailAdaptee."""

    def create(self) -> INotificacionAdapter:
        return EmailAdaptee()


class FabricaSms(FabricaNotificacion):
    """Fábrica concreta que crea un SmsAdaptee."""

    def create(self) -> INotificacionAdapter:
        return SmsAdaptee()



class ProveedorNotificacion:

    def __init__(self) -> None:
        self._fabricas: dict[str, FabricaNotificacion] = {
            "whatsapp": FabricaWhatsApp(),
            "email":    FabricaEmail(),
            "sms":      FabricaSms(),
        }

    def get(self, canal: str) -> FabricaNotificacion:
        fabrica = self._fabricas.get(canal.lower())
        if not fabrica:
            canales = list(self._fabricas.keys())
            raise ValueError(f"Canal '{canal}' no soportado. Disponibles: {canales}")
        return fabrica

    def canales_disponibles(self) -> list[str]:
        return list(self._fabricas.keys())