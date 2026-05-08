"""
PATRÓN COMPOSITE — ComponenteTarea / TareaHoja / TareaCompuesta
Permite tratar tareas simples y tareas con hijos de forma uniforme.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class ComponenteTarea(ABC):
    """Interfaz común para hojas y compuestos."""

    @abstractmethod
    def obtener_id(self) -> str:
        pass

    @abstractmethod
    def obtener_titulo(self) -> str:
        pass

    @abstractmethod
    def calcular_horas_estimadas(self) -> float:
        pass

    @abstractmethod
    def calcular_progreso(self) -> float:
        pass

    @abstractmethod
    def obtener_responsables(self) -> list[str]:
        pass

    @abstractmethod
    def obtener_hijos(self) -> list["ComponenteTarea"]:
        pass


@dataclass
class TareaHoja(ComponenteTarea):
    """Hoja del Composite: tarea o subtarea sin hijos."""

    id: str
    titulo: str
    horas_estimadas: float = 0.0
    progreso: float = 0.0
    responsables: list[str] = field(default_factory=list)
    categoria: str = "TAREA"

    def obtener_id(self) -> str:
        return self.id

    def obtener_titulo(self) -> str:
        return self.titulo

    def calcular_horas_estimadas(self) -> float:
        return round(max(self.horas_estimadas, 0.0), 2)

    def calcular_progreso(self) -> float:
        return round(min(max(self.progreso, 0.0), 100.0), 1)

    def obtener_responsables(self) -> list[str]:
        return sorted(set(self.responsables))

    def obtener_hijos(self) -> list["ComponenteTarea"]:
        return []


@dataclass
class TareaCompuesta(ComponenteTarea):
    """Nodo compuesto: agrega múltiples componentes hijos."""

    id: str
    titulo: str
    responsables: list[str] = field(default_factory=list)
    hijos: list[ComponenteTarea] = field(default_factory=list)
    horas_estimadas_propias: float = 0.0
    progreso_propio: float = 0.0
    categoria: str = "TAREA"

    def agregar(self, hijo: ComponenteTarea) -> None:
        self.hijos.append(hijo)

    def obtener_id(self) -> str:
        return self.id

    def obtener_titulo(self) -> str:
        return self.titulo

    def calcular_horas_estimadas(self) -> float:
        if not self.hijos:
            return round(max(self.horas_estimadas_propias, 0.0), 2)

        horas_hijos = sum(hijo.calcular_horas_estimadas() for hijo in self.hijos)
        if horas_hijos <= 0:
            return round(max(self.horas_estimadas_propias, 0.0), 2)
        return round(horas_hijos, 2)

    def calcular_progreso(self) -> float:
        if not self.hijos:
            return round(min(max(self.progreso_propio, 0.0), 100.0), 1)

        acumulado = 0.0
        peso_total = 0.0
        for hijo in self.hijos:
            peso = hijo.calcular_horas_estimadas()
            if peso <= 0:
                peso = 1.0
            acumulado += hijo.calcular_progreso() * peso
            peso_total += peso

        if peso_total <= 0:
            return 0.0
        return round(acumulado / peso_total, 1)

    def obtener_responsables(self) -> list[str]:
        responsables = set(self.responsables)
        for hijo in self.hijos:
            responsables.update(hijo.obtener_responsables())
        return sorted(responsables)

    def obtener_hijos(self) -> list[ComponenteTarea]:
        return list(self.hijos)


def _normalizar_horas(valor) -> float:
    if valor is None:
        return 0.0
    try:
        horas = float(valor)
        return max(horas, 0.0)
    except (TypeError, ValueError):
        return 0.0


def _normalizar_progreso(valor) -> float:
    if valor is None:
        return 0.0
    try:
        progreso = float(valor)
        return min(max(progreso, 0.0), 100.0)
    except (TypeError, ValueError):
        return 0.0


def _normalizar_texto(valor, predeterminado: str) -> str:
    texto = str(valor or "").strip()
    return texto if texto else predeterminado


def _normalizar_orden(valor) -> int:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return 0


def _ordenar_por_orden_y_titulo(nodos: list[dict]) -> list[dict]:
    return sorted(
        nodos,
        key=lambda nodo: (
            _normalizar_orden(nodo.get("orden")),
            _normalizar_texto(nodo.get("nombre") or nodo.get("titulo"), ""),
        ),
    )


def _calcular_progreso_tarea(tarea: dict, columnas_completadas: set[str]) -> float:
    if tarea.get("columnaId") in columnas_completadas:
        return 100.0
    horas_estimadas = _normalizar_horas(tarea.get("horasEstimadas"))
    horas_registradas = _normalizar_horas(tarea.get("horasRegistradas"))
    if horas_estimadas <= 0:
        return 0.0
    return round(min((horas_registradas / horas_estimadas) * 100.0, 100.0), 1)


def _calcular_progreso_subtarea(subtarea: dict) -> float:
    return 100.0 if subtarea.get("completada", False) else 0.0


def _construir_desde_subtarea(subtarea: dict, categoria: str = "SUBTAREA") -> TareaHoja:
    return TareaHoja(
        id=subtarea["_id"],
        titulo=_normalizar_texto(subtarea.get("titulo"), "Subtarea"),
        horas_estimadas=_normalizar_horas(subtarea.get("horasEstimadas")),
        progreso=_calcular_progreso_subtarea(subtarea),
        responsables=list(subtarea.get("responsables", [])),
        categoria=categoria,
    )


def _construir_desde_tarea(
    *,
    tarea_id: str,
    tareas_por_id: dict[str, dict],
    subtareas_por_id: dict[str, dict],
    columnas_completadas: set[str],
    ruta_actual: set[str],
) -> ComponenteTarea:
    if tarea_id in ruta_actual:
        raise ValueError(f"Ciclo detectado en la jerarquía de tareas: {tarea_id}")

    tarea = tareas_por_id.get(tarea_id)
    if not tarea:
        raise ValueError(f"Tarea no encontrada en la jerarquía: {tarea_id}")

    ruta_actual.add(tarea_id)
    try:
        hijos: list[ComponenteTarea] = []
        for hijo_id in tarea.get("subtareas", []):
            if hijo_id in tareas_por_id:
                hijos.append(
                    _construir_desde_tarea(
                        tarea_id=hijo_id,
                        tareas_por_id=tareas_por_id,
                        subtareas_por_id=subtareas_por_id,
                        columnas_completadas=columnas_completadas,
                        ruta_actual=ruta_actual,
                    )
                )
            elif hijo_id in subtareas_por_id:
                hijos.append(_construir_desde_subtarea(subtareas_por_id[hijo_id]))
    finally:
        ruta_actual.remove(tarea_id)

    titulo = _normalizar_texto(tarea.get("titulo"), "Tarea")
    responsables = list(tarea.get("responsables", []))
    horas = _normalizar_horas(tarea.get("horasEstimadas"))
    progreso = _calcular_progreso_tarea(tarea, columnas_completadas)

    if not hijos:
        return TareaHoja(
            id=tarea_id,
            titulo=titulo,
            horas_estimadas=horas,
            progreso=progreso,
            responsables=responsables,
            categoria="TAREA",
        )

    return TareaCompuesta(
        id=tarea_id,
        titulo=titulo,
        responsables=responsables,
        hijos=hijos,
        horas_estimadas_propias=horas,
        progreso_propio=progreso,
        categoria="TAREA",
    )


def construir_componente_tarea_desde_raiz(
    *,
    tarea_id: str,
    tareas_por_id: dict[str, dict],
    subtareas_por_id: dict[str, dict],
    columnas_completadas: set[str],
) -> ComponenteTarea:
    return _construir_desde_tarea(
        tarea_id=tarea_id,
        tareas_por_id=tareas_por_id,
        subtareas_por_id=subtareas_por_id,
        columnas_completadas=columnas_completadas,
        ruta_actual=set(),
    )


def construir_bosque_tareas(
    *,
    tareas: list[dict],
    subtareas: list[dict],
    columnas_completadas: set[str],
) -> list[ComponenteTarea]:
    if not tareas:
        return []

    tareas_por_id = {t["_id"]: t for t in tareas}
    subtareas_por_id = {s["_id"]: s for s in subtareas}

    hijos_tarea_ids: set[str] = set()
    for tarea in tareas:
        for hijo_id in tarea.get("subtareas", []):
            if hijo_id in tareas_por_id:
                hijos_tarea_ids.add(hijo_id)

    raices = [tarea_id for tarea_id in tareas_por_id if tarea_id not in hijos_tarea_ids]
    if not raices:
        raices = list(tareas_por_id.keys())

    return [
        construir_componente_tarea_desde_raiz(
            tarea_id=raiz_id,
            tareas_por_id=tareas_por_id,
            subtareas_por_id=subtareas_por_id,
            columnas_completadas=columnas_completadas,
        )
        for raiz_id in raices
    ]


def _construir_desde_etapa(
    *,
    etapa: dict,
    subtareas_por_etapa: dict[str, list[dict]],
) -> ComponenteTarea:
    etapa_id = etapa.get("_id")
    if not etapa_id:
        raise ValueError("Etapa inválida sin _id")

    subtareas_ordenadas = _ordenar_por_orden_y_titulo(subtareas_por_etapa.get(etapa_id, []))
    hijos = [_construir_desde_subtarea(subtarea, categoria="SUBTAREA") for subtarea in subtareas_ordenadas]

    titulo = _normalizar_texto(etapa.get("nombre") or etapa.get("titulo"), "Etapa")
    responsables = list(etapa.get("responsables", []))
    horas = _normalizar_horas(etapa.get("horasEstimadas"))
    progreso = _normalizar_progreso(etapa.get("progreso"))

    if not hijos:
        return TareaHoja(
            id=etapa_id,
            titulo=titulo,
            horas_estimadas=horas,
            progreso=progreso,
            responsables=responsables,
            categoria="ETAPA",
        )

    return TareaCompuesta(
        id=etapa_id,
        titulo=titulo,
        responsables=responsables,
        hijos=hijos,
        horas_estimadas_propias=horas,
        progreso_propio=progreso,
        categoria="ETAPA",
    )


def _construir_desde_fase(
    *,
    fase: dict,
    etapas_por_fase: dict[str, list[dict]],
    subtareas_por_etapa: dict[str, list[dict]],
) -> ComponenteTarea:
    fase_id = fase.get("_id")
    if not fase_id:
        raise ValueError("Fase inválida sin _id")

    etapas = _ordenar_por_orden_y_titulo(etapas_por_fase.get(fase_id, []))
    hijos = [
        _construir_desde_etapa(etapa=etapa, subtareas_por_etapa=subtareas_por_etapa)
        for etapa in etapas
    ]

    titulo = _normalizar_texto(fase.get("nombre") or fase.get("titulo"), "Fase")
    responsables = list(fase.get("responsables", []))
    horas = _normalizar_horas(fase.get("horasEstimadas"))
    progreso = _normalizar_progreso(fase.get("progreso"))

    if not hijos:
        return TareaHoja(
            id=fase_id,
            titulo=titulo,
            horas_estimadas=horas,
            progreso=progreso,
            responsables=responsables,
            categoria="FASE",
        )

    return TareaCompuesta(
        id=fase_id,
        titulo=titulo,
        responsables=responsables,
        hijos=hijos,
        horas_estimadas_propias=horas,
        progreso_propio=progreso,
        categoria="FASE",
    )


def construir_componente_proyecto_jerarquico(
    *,
    proyecto: dict,
    fases: list[dict],
    etapas: list[dict],
    subtareas: list[dict],
) -> ComponenteTarea:
    proyecto_id = proyecto.get("_id") or proyecto.get("id")
    if not proyecto_id:
        raise ValueError("Proyecto inválido sin identificador")

    fases_proyecto = [
        fase for fase in fases
        if fase.get("_id") and fase.get("proyectoId") == proyecto_id
    ]
    fases_por_id = {fase["_id"]: fase for fase in fases_proyecto}

    etapas_proyecto = [
        etapa for etapa in etapas
        if etapa.get("_id")
        and etapa.get("proyectoId") == proyecto_id
        and etapa.get("faseId") in fases_por_id
    ]
    etapas_por_id = {etapa["_id"]: etapa for etapa in etapas_proyecto}

    etapas_por_fase: dict[str, list[dict]] = {}
    for etapa in etapas_proyecto:
        fases_de_etapa = etapa.get("faseId")
        etapas_por_fase.setdefault(fases_de_etapa, []).append(etapa)

    for fase in fases_proyecto:
        etapa_ids = fase.get("etapas", [])
        if not isinstance(etapa_ids, list):
            continue
        lista = etapas_por_fase.setdefault(fase["_id"], [])
        ids_presentes = {etapa["_id"] for etapa in lista}
        for etapa_id in etapa_ids:
            etapa = etapas_por_id.get(etapa_id)
            if etapa and etapa["_id"] not in ids_presentes:
                lista.append(etapa)
                ids_presentes.add(etapa["_id"])

    subtareas_por_id: dict[str, dict] = {}
    subtareas_por_etapa: dict[str, list[dict]] = {}
    for subtarea in subtareas:
        subtarea_id = subtarea.get("_id")
        if not subtarea_id:
            continue
        if subtarea.get("proyectoId") and subtarea.get("proyectoId") != proyecto_id:
            continue
        subtareas_por_id[subtarea_id] = subtarea
        etapa_id = subtarea.get("etapaId")
        if etapa_id:
            subtareas_por_etapa.setdefault(etapa_id, []).append(subtarea)

    for etapa in etapas_proyecto:
        etapa_id = etapa["_id"]
        subtareas_ids = etapa.get("subtareas", [])
        if not isinstance(subtareas_ids, list):
            continue
        lista = subtareas_por_etapa.setdefault(etapa_id, [])
        ids_presentes = {sub["_id"] for sub in lista}
        for subtarea_id in subtareas_ids:
            subtarea = subtareas_por_id.get(subtarea_id)
            if subtarea and subtarea["_id"] not in ids_presentes:
                lista.append(subtarea)
                ids_presentes.add(subtarea["_id"])

    fases_ordenadas = _ordenar_por_orden_y_titulo(fases_proyecto)
    hijos = [
        _construir_desde_fase(
            fase=fase,
            etapas_por_fase=etapas_por_fase,
            subtareas_por_etapa=subtareas_por_etapa,
        )
        for fase in fases_ordenadas
    ]

    titulo = _normalizar_texto(proyecto.get("nombre") or proyecto.get("titulo"), "Proyecto")
    responsables = list(proyecto.get("miembros", []))
    horas = _normalizar_horas(proyecto.get("horasEstimadas"))
    progreso = _normalizar_progreso(proyecto.get("progreso"))

    if not hijos:
        return TareaHoja(
            id=proyecto_id,
            titulo=titulo,
            horas_estimadas=horas,
            progreso=progreso,
            responsables=responsables,
            categoria="PROYECTO",
        )

    return TareaCompuesta(
        id=proyecto_id,
        titulo=titulo,
        responsables=responsables,
        hijos=hijos,
        horas_estimadas_propias=horas,
        progreso_propio=progreso,
        categoria="PROYECTO",
    )


def calcular_progreso_global_compuesto(componentes: list[ComponenteTarea]) -> float:
    if not componentes:
        return 0.0

    acumulado = 0.0
    peso_total = 0.0
    for componente in componentes:
        peso = componente.calcular_horas_estimadas()
        if peso <= 0:
            peso = 1.0
        acumulado += componente.calcular_progreso() * peso
        peso_total += peso

    if peso_total <= 0:
        return 0.0
    return round(acumulado / peso_total, 1)


def serializar_componente_tarea(componente: ComponenteTarea) -> dict:
    return {
        "id": componente.obtener_id(),
        "titulo": componente.obtener_titulo(),
        "tipo": "COMPUESTA" if isinstance(componente, TareaCompuesta) else "HOJA",
        "categoria": getattr(componente, "categoria", "TAREA"),
        "horasEstimadas": componente.calcular_horas_estimadas(),
        "progreso": componente.calcular_progreso(),
        "responsables": componente.obtener_responsables(),
        "hijos": [serializar_componente_tarea(hijo) for hijo in componente.obtener_hijos()],
    }

