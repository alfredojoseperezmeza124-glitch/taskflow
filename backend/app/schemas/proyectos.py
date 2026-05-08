from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from app.models.enums import EstadoProyecto


class CrearProyecto(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    descripcion: Optional[str] = None
    fechaInicio: date
    fechaFinEstimada: date


class ReglasDecoradoresProyecto(BaseModel):
    auditoriaEnriquecidaActiva: bool = True
    notificacionAutomaticaActiva: bool = True
    validacionSlaActiva: bool = True
    maxHorasPorTarea: float = Field(80.0, ge=0)
    notificarBugUrgenteAlPm: bool = True
    validarHorasAntesDeMoverEnProgreso: bool = True


class ActualizarProyecto(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=120)
    descripcion: Optional[str] = None
    fechaFinEstimada: Optional[date] = None
    estado: Optional[EstadoProyecto] = None
    reglasDecoradores: Optional[ReglasDecoradoresProyecto] = None


class InvitarMiembro(BaseModel):
    email: str
    rolEnProyecto: str = "DEVELOPER"


class CrearFase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    descripcion: Optional[str] = None
    orden: Optional[int] = Field(None, ge=0)
    responsables: List[str] = []
    horasEstimadas: Optional[float] = Field(None, ge=0)


class ActualizarFase(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=120)
    descripcion: Optional[str] = None
    orden: Optional[int] = Field(None, ge=0)
    responsables: Optional[List[str]] = None
    horasEstimadas: Optional[float] = Field(None, ge=0)
    progreso: Optional[float] = Field(None, ge=0, le=100)


class RespuestaFase(BaseModel):
    id: str
    proyectoId: str
    nombre: str
    descripcion: Optional[str]
    orden: int
    responsables: List[str]
    horasEstimadas: float = 0.0
    progreso: float = 0.0
    etapas: List[str] = []
    creadoEn: datetime
    actualizadoEn: datetime


class CrearEtapa(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    descripcion: Optional[str] = None
    orden: Optional[int] = Field(None, ge=0)
    responsables: List[str] = []
    horasEstimadas: Optional[float] = Field(None, ge=0)


class ActualizarEtapa(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=120)
    descripcion: Optional[str] = None
    orden: Optional[int] = Field(None, ge=0)
    responsables: Optional[List[str]] = None
    horasEstimadas: Optional[float] = Field(None, ge=0)
    progreso: Optional[float] = Field(None, ge=0, le=100)


class RespuestaEtapa(BaseModel):
    id: str
    proyectoId: str
    faseId: str
    nombre: str
    descripcion: Optional[str]
    orden: int
    responsables: List[str]
    horasEstimadas: float = 0.0
    progreso: float = 0.0
    subtareas: List[str] = []
    creadoEn: datetime
    actualizadoEn: datetime


class RespuestaProyecto(BaseModel):
    id: str
    nombre: str
    descripcion: Optional[str]
    fechaInicio: date
    fechaFinEstimada: date
    estado: str
    propietarioId: str
    estaArchivado: bool
    progreso: float = 0.0
    miembros: List[str] = []
    reglasDecoradores: dict = Field(default_factory=dict)
    creadoEn: datetime


class RespuestaListaProyectos(BaseModel):
    proyectos: List[RespuestaProyecto]
    total: int

