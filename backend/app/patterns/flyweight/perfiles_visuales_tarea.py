"""
PATRON FLYWEIGHT - Perfiles visuales de tarea.
Comparte objetos inmutables para representar el estilo de una tarea segun
sus atributos intrinsecos (tipo, prioridad y estado temporal).
"""

from dataclasses import dataclass


_ICONO_POR_TIPO = {
    "BUG": "bug",
    "FEATURE": "spark",
    "TASK": "check",
    "IMPROVEMENT": "rocket",
}

_ESTILO_POR_PRIORIDAD = {
    "BAJA": {
        "colorFondo": "#DCFCE7",
        "colorBorde": "#16A34A",
        "colorTexto": "#14532D",
    },
    "MEDIA": {
        "colorFondo": "#DBEAFE",
        "colorBorde": "#2563EB",
        "colorTexto": "#1E3A8A",
    },
    "ALTA": {
        "colorFondo": "#FEF3C7",
        "colorBorde": "#D97706",
        "colorTexto": "#78350F",
    },
    "URGENTE": {
        "colorFondo": "#FEE2E2",
        "colorBorde": "#DC2626",
        "colorTexto": "#7F1D1D",
    },
}


@dataclass(frozen=True)
class PerfilVisualTareaFlyweight:
    tipo: str
    prioridad: str
    esta_vencida: bool
    icono: str
    color_fondo: str
    color_borde: str
    color_texto: str

    @property
    def clave_compartida(self) -> str:
        estado = "VENCIDA" if self.esta_vencida else "VIGENTE"
        return f"{self.tipo}|{self.prioridad}|{estado}"

    def serializar(self) -> dict:
        return {
            "claveCompartida": self.clave_compartida,
            "tipo": self.tipo,
            "prioridad": self.prioridad,
            "estadoTemporal": "VENCIDA" if self.esta_vencida else "VIGENTE",
            "icono": self.icono,
            "colorFondo": self.color_fondo,
            "colorBorde": self.color_borde,
            "colorTexto": self.color_texto,
        }


class FabricaPerfilVisualTarea:
    def __init__(self) -> None:
        self._pool: dict[tuple[str, str, bool], PerfilVisualTareaFlyweight] = {}

    def obtener(self, *, tipo: str | None, prioridad: str | None, esta_vencida: bool) -> PerfilVisualTareaFlyweight:
        tipo_norm = (tipo or "TASK").upper()
        prioridad_norm = (prioridad or "MEDIA").upper()
        clave = (tipo_norm, prioridad_norm, bool(esta_vencida))

        if clave not in self._pool:
            self._pool[clave] = self._crear_flyweight(*clave)

        return self._pool[clave]

    def estadisticas(self) -> dict:
        claves = []
        for tipo, prioridad, esta_vencida in self._pool:
            estado = "VENCIDA" if esta_vencida else "VIGENTE"
            claves.append(f"{tipo}|{prioridad}|{estado}")

        return {
            "flyweightsCompartidos": len(self._pool),
            "clavesCompartidas": sorted(claves),
        }

    def _crear_flyweight(self, tipo: str, prioridad: str, esta_vencida: bool) -> PerfilVisualTareaFlyweight:
        icono = _ICONO_POR_TIPO.get(tipo, _ICONO_POR_TIPO["TASK"])
        estilo_prioridad = _ESTILO_POR_PRIORIDAD.get(prioridad, _ESTILO_POR_PRIORIDAD["MEDIA"])

        color_borde = estilo_prioridad["colorBorde"]
        if esta_vencida:
            color_borde = "#B91C1C"

        return PerfilVisualTareaFlyweight(
            tipo=tipo,
            prioridad=prioridad,
            esta_vencida=esta_vencida,
            icono=icono,
            color_fondo=estilo_prioridad["colorFondo"],
            color_borde=color_borde,
            color_texto=estilo_prioridad["colorTexto"],
        )


_FABRICA_GLOBAL = FabricaPerfilVisualTarea()


def obtener_perfil_visual_tarea(*, tipo: str | None, prioridad: str | None, esta_vencida: bool) -> dict:
    flyweight = _FABRICA_GLOBAL.obtener(tipo=tipo, prioridad=prioridad, esta_vencida=esta_vencida)
    return flyweight.serializar()


def obtener_estadisticas_pool_flyweight_tareas() -> dict:
    return _FABRICA_GLOBAL.estadisticas()