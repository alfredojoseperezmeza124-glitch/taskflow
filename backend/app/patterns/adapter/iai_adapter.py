from abc import ABC, abstractmethod


class IAIAdapter(ABC):
    """Interfaz para adaptadores de proveedores LLM."""

    @abstractmethod
    def generar(self, payload: dict) -> dict:
        """Genera una respuesta a partir del payload proporcionado.
        Debe devolver un dict serializable con la respuesta del proveedor.
        """
        pass
