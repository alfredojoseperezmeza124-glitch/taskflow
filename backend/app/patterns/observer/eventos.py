from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass
class EventoDominio:
	tipo: str
	datos: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TareaCreadaEvento(EventoDominio):
	pass


@dataclass
class TareaMovidaEvento(EventoDominio):
	pass


@dataclass
class ComentarioAgregadoEvento(EventoDominio):
	pass


@dataclass
class BugUrgenteDetectadoEvento(EventoDominio):
	pass

