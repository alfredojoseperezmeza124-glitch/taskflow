from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class EventoDominio(ABC):
    tipo: str
    creador_id: str
    proyecto_id: str | None
    tarea_id: str | None
    titulo_tarea: str | None
    usuarios_destino: list[str] = field(default_factory=list)
    metadatos: dict[str, Any] = field(default_factory=dict)
    creado_en: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @abstractmethod
    def descripcion(self) -> str:
        ...

    def serializar(self) -> dict:
        return {
            "tipo": self.tipo,
            "creadorId": self.creador_id,
            "proyectoId": self.proyecto_id,
            "tareaId": self.tarea_id,
            "tituloTarea": self.titulo_tarea,
            "usuariosDestino": self.usuarios_destino,
            "metadatos": self.metadatos,
            "creadoEn": self.creado_en,
            "descripcion": self.descripcion(),
        }


@dataclass
class TareaCreadaEvento(EventoDominio):
    def __init__(self, creador_id: str, proyecto_id: str | None, tarea_id: str | None, titulo_tarea: str | None, usuarios_destino: list[str], metadatos: dict[str, Any] | None = None):
        super().__init__(
            tipo="TareaCreada",
            creador_id=creador_id,
            proyecto_id=proyecto_id,
            tarea_id=tarea_id,
            titulo_tarea=titulo_tarea,
            usuarios_destino=usuarios_destino,
            metadatos=metadatos or {},
        )

    def descripcion(self) -> str:
        return f"Tarea '{self.titulo_tarea}' creada en proyecto {self.proyecto_id}"


@dataclass
class TareaMovidaEvento(EventoDominio):
    columna_anterior: str | None = None
    columna_actual: str | None = None

    def __init__(self, creador_id: str, proyecto_id: str | None, tarea_id: str | None, titulo_tarea: str | None, usuarios_destino: list[str], columna_anterior: str | None, columna_actual: str | None, metadatos: dict[str, Any] | None = None):
        super().__init__(
            tipo="TareaMovida",
            creador_id=creador_id,
            proyecto_id=proyecto_id,
            tarea_id=tarea_id,
            titulo_tarea=titulo_tarea,
            usuarios_destino=usuarios_destino,
            metadatos=metadatos or {},
        )
        self.columna_anterior = columna_anterior
        self.columna_actual = columna_actual

    def descripcion(self) -> str:
        return f"Tarea '{self.titulo_tarea}' movida de {self.columna_anterior} a {self.columna_actual}"


@dataclass
class ComentarioAgregadoEvento(EventoDominio):
    comentario: str | None = None

    def __init__(self, creador_id: str, proyecto_id: str | None, tarea_id: str | None, titulo_tarea: str | None, usuarios_destino: list[str], comentario: str | None, metadatos: dict[str, Any] | None = None):
        super().__init__(
            tipo="ComentarioAgregado",
            creador_id=creador_id,
            proyecto_id=proyecto_id,
            tarea_id=tarea_id,
            titulo_tarea=titulo_tarea,
            usuarios_destino=usuarios_destino,
            metadatos=metadatos or {},
        )
        self.comentario = comentario

    def descripcion(self) -> str:
        return f"Comentario agregado a '{self.titulo_tarea}'"


@dataclass
class TareaActualizadaEvento(EventoDominio):
    cambios: dict[str, Any] = field(default_factory=dict)
    nuevos_asignados: list[str] = field(default_factory=list)

    def __init__(self, creador_id: str, proyecto_id: str | None, tarea_id: str | None, titulo_tarea: str | None, usuarios_destino: list[str], cambios: dict[str, Any] | None = None, nuevos_asignados: list[str] | None = None, metadatos: dict[str, Any] | None = None):
        super().__init__(
            tipo="TareaActualizada",
            creador_id=creador_id,
            proyecto_id=proyecto_id,
            tarea_id=tarea_id,
            titulo_tarea=titulo_tarea,
            usuarios_destino=usuarios_destino,
            metadatos=metadatos or {},
        )
        self.cambios = cambios or {}
        self.nuevos_asignados = nuevos_asignados or []

    def descripcion(self) -> str:
        return f"Tarea '{self.titulo_tarea}' actualizada"


@dataclass
class BugUrgenteDetectadoEvento(EventoDominio):
    severidad: str | None = None

    def __init__(self, creador_id: str, proyecto_id: str | None, tarea_id: str | None, titulo_tarea: str | None, usuarios_destino: list[str], severidad: str | None = None, metadatos: dict[str, Any] | None = None):
        super().__init__(
            tipo="BugUrgenteDetectado",
            creador_id=creador_id,
            proyecto_id=proyecto_id,
            tarea_id=tarea_id,
            titulo_tarea=titulo_tarea,
            usuarios_destino=usuarios_destino,
            metadatos=metadatos or {},
        )
        self.severidad = severidad

    def descripcion(self) -> str:
        return f"Bug urgente detectado en '{self.titulo_tarea}' con severidad {self.severidad or 'alta'}"
