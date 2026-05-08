from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.enums import PrioridadTarea, TipoTarea


class CrearTarea(BaseModel):
    titulo: str = Field(..., min_length=2, max_length=200)
    descripcion: Optional[str] = None
    prioridad: PrioridadTarea = PrioridadTarea.MEDIA
    tipo: TipoTarea = TipoTarea.TASK
    fechaVencimiento: Optional[datetime] = None
    horasEstimadas: Optional[float] = Field(None, ge=0)
    columnaId: str
    proyectoId: str
    faseId: Optional[str] = None
    etapaId: Optional[str] = None
    responsables: List[str] = []
    etiquetas: List[str] = []


class ActualizarTarea(BaseModel):
    titulo: Optional[str] = Field(None, min_length=2, max_length=200)
    descripcion: Optional[str] = None
    prioridad: Optional[PrioridadTarea] = None
    tipo: Optional[TipoTarea] = None
    fechaVencimiento: Optional[datetime] = None
    horasEstimadas: Optional[float] = Field(None, ge=0)
    faseId: Optional[str] = None
    etapaId: Optional[str] = None
    responsables: Optional[List[str]] = None
    etiquetas: Optional[List[str]] = None


class MoverTarea(BaseModel):
    columnaIdDestino: str


class CrearComentario(BaseModel):
    contenido: str = Field(..., min_length=1, max_length=2000)


class ActualizarComentario(BaseModel):
    contenido: str = Field(..., min_length=1, max_length=2000)


class RegistrarTiempo(BaseModel):
    horas: float = Field(..., gt=0)


class CrearEtiqueta(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=50)
    color: str = Field(..., pattern=r"^#[0-9A-Fa-f]{6}$")
    proyectoId: str


class RespuestaComentario(BaseModel):
    id: str
    contenido: str
    tareaId: str
    autorId: str
    creadoEn: datetime
    actualizadoEn: datetime


class RespuestaPerfilVisualTarea(BaseModel):
    claveCompartida: str
    tipo: str
    prioridad: str
    estadoTemporal: str
    icono: str
    colorFondo: str
    colorBorde: str
    colorTexto: str


class RespuestaEstadisticasFlyweightTareas(BaseModel):
    flyweightsCompartidos: int
    clavesCompartidas: List[str]


class RespuestaTarea(BaseModel):
    id: str
    titulo: str
    descripcion: Optional[str]
    prioridad: str
    tipo: str
    fechaVencimiento: Optional[datetime]
    horasEstimadas: Optional[float]
    columnaId: str
    proyectoId: str
    faseId: Optional[str] = None
    etapaId: Optional[str] = None
    responsables: List[str]
    etiquetas: List[str]
    estaVencida: bool
    subtareas: List[str] = []
    horasRegistradas: float = 0.0
    perfilVisual: Optional[RespuestaPerfilVisualTarea] = None
    creadoEn: datetime
