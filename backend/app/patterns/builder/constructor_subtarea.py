"""
PATRÓN BUILDER — ConstructorSubtarea
Aplica el patrón Builder a la construcción de subtareas, igual que
ConstructorTareaAvanzada lo hace con las tareas padre.

Permite construir subtareas paso a paso con una interfaz fluida,
validando los campos obligatorios al final en construir().

Uso:
    subtarea = (
        ConstructorSubtarea()
        .con_titulo("Revisar diseño de login")
        .en_tarea("tarea-uuid-123")
        # o .en_etapa("etapa-uuid-123")
        .en_proyecto("proyecto-uuid-456")
        .creada_por("usuario-uuid-789")
        .con_responsables(["dev-uuid-1"])
        .con_descripcion("Verificar que cumpla los mockups")
        .construir()
    )
"""
import uuid
from datetime import datetime, timezone


class ConstructorSubtarea:
    """
    Builder concreto para subtareas.
    Cada método retorna self para encadenamiento fluido.
    """

    def __init__(self) -> None:
        self._reiniciar()

    def _reiniciar(self) -> None:
        self._datos: dict = {
            "_id":              str(uuid.uuid4()),
            "titulo":           "",
            "descripcion":      None,
            "completada":       False,
            "tareaId":          "",
            "etapaId":          "",
            "proyectoId":       "",
            "creadoPor":        "",
            "responsables":     [],
            "fechaVencimiento": None,
            "creadoEn":         datetime.now(timezone.utc),
            "actualizadoEn":    datetime.now(timezone.utc),
        }

    # ── Métodos de construcción (fluent interface) ───────────────────────────

    def con_titulo(self, titulo: str) -> "ConstructorSubtarea":
        self._datos["titulo"] = titulo.strip()
        return self

    def con_descripcion(self, descripcion: str) -> "ConstructorSubtarea":
        self._datos["descripcion"] = descripcion
        return self

    def en_tarea(self, tarea_id: str) -> "ConstructorSubtarea":
        self._datos["tareaId"] = tarea_id
        self._datos["etapaId"] = ""
        return self

    def en_etapa(self, etapa_id: str) -> "ConstructorSubtarea":
        self._datos["etapaId"] = etapa_id
        self._datos["tareaId"] = ""
        return self

    def en_proyecto(self, proyecto_id: str) -> "ConstructorSubtarea":
        self._datos["proyectoId"] = proyecto_id
        return self

    def creada_por(self, usuario_id: str) -> "ConstructorSubtarea":
        self._datos["creadoPor"] = usuario_id
        return self

    def con_responsables(self, responsables: list[str]) -> "ConstructorSubtarea":
        self._datos["responsables"] = responsables
        return self

    def con_fecha_vencimiento(self, fecha: datetime) -> "ConstructorSubtarea":
        self._datos["fechaVencimiento"] = fecha
        return self

    def ya_completada(self) -> "ConstructorSubtarea":
        """Marca la subtarea como completada desde su creación."""
        self._datos["completada"] = True
        return self

    # ── Producto final ────────────────────────────────────────────────────────

    def construir(self) -> dict:
        """
        Valida y retorna el dict de la subtarea listo para insertar en MongoDB.
        Reinicia el builder para poder reutilizarlo.
        """
        if not self._datos["titulo"] or len(self._datos["titulo"]) < 2:
            raise ValueError("El título de la subtarea debe tener al menos 2 caracteres")
        if not self._datos["tareaId"] and not self._datos["etapaId"]:
            raise ValueError("La subtarea debe pertenecer a una tarea padre o una etapa")
        if not self._datos["proyectoId"]:
            raise ValueError("La subtarea debe pertenecer a un proyecto (proyectoId)")

        resultado = dict(self._datos)
        self._reiniciar()
        return resultado
