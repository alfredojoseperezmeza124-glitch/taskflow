"""
PATRÓN DECORATOR — ServicioTareaBase
Permite añadir reglas de negocio sobre crear/actualizar/mover tareas
sin modificar el núcleo del servicio.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable
import uuid

from fastapi import HTTPException

from app.schemas.tareas import CrearTarea, ActualizarTarea, MoverTarea
from app.services.servicio_notificacion import crear_notificacion_interna

OperacionCrear = Callable[[CrearTarea, str], Awaitable[dict]]
OperacionActualizar = Callable[[str, ActualizarTarea, str], Awaitable[dict]]
OperacionMover = Callable[[str, MoverTarea, str], Awaitable[dict]]


def _a_bool(valor, predeterminado: bool) -> bool:
    if isinstance(valor, bool):
        return valor
    if isinstance(valor, (int, float)):
        return bool(valor)
    if isinstance(valor, str):
        return valor.strip().lower() in {"1", "true", "si", "sí", "yes", "on"}
    return predeterminado


def _a_float(valor, predeterminado: float) -> float:
    try:
        numero = float(valor)
        return numero if numero >= 0 else predeterminado
    except (TypeError, ValueError):
        return predeterminado


def _tomar_valor(reglas: dict, *claves, predeterminado=None):
    for clave in claves:
        if clave in reglas:
            return reglas[clave]
    return predeterminado


@dataclass
class ReglasDecoradorProyecto:
    auditoria_enriquecida: bool = True
    notificacion_automatica: bool = True
    validacion_sla: bool = True
    max_horas_por_tarea: float = 80.0
    notificar_bug_urgente_pm: bool = True
    validar_horas_antes_mover_en_progreso: bool = True

    @classmethod
    def desde_dict(cls, reglas: dict | None) -> "ReglasDecoradorProyecto":
        if not isinstance(reglas, dict):
            return cls()

        return cls(
            auditoria_enriquecida=_a_bool(
                _tomar_valor(reglas, "auditoriaEnriquecidaActiva", "auditoria_enriquecida", predeterminado=True),
                True,
            ),
            notificacion_automatica=_a_bool(
                _tomar_valor(reglas, "notificacionAutomaticaActiva", "notificacion_automatica", predeterminado=True),
                True,
            ),
            validacion_sla=_a_bool(
                _tomar_valor(reglas, "validacionSlaActiva", "validacion_sla", predeterminado=True),
                True,
            ),
            max_horas_por_tarea=_a_float(
                _tomar_valor(reglas, "maxHorasPorTarea", "max_horas_por_tarea", predeterminado=80.0),
                80.0,
            ),
            notificar_bug_urgente_pm=_a_bool(
                _tomar_valor(reglas, "notificarBugUrgenteAlPm", "notificar_bug_urgente_pm", predeterminado=True),
                True,
            ),
            validar_horas_antes_mover_en_progreso=_a_bool(
                _tomar_valor(
                    reglas,
                    "validarHorasAntesDeMoverEnProgreso",
                    "validar_horas_antes_mover_en_progreso",
                    predeterminado=True,
                ),
                True,
            ),
        )


class ServicioTareaBase(ABC):
    @abstractmethod
    async def crear(self, datos: CrearTarea, usuario_id: str) -> dict:
        pass

    @abstractmethod
    async def actualizar(self, tarea_id: str, datos: ActualizarTarea, usuario_id: str) -> dict:
        pass

    @abstractmethod
    async def mover(self, tarea_id: str, datos: MoverTarea, usuario_id: str) -> dict:
        pass


class ServicioTareaNucleo(ServicioTareaBase):
    """Implementación base que delega en operaciones del servicio real."""

    def __init__(
        self,
        *,
        crear_operacion: OperacionCrear,
        actualizar_operacion: OperacionActualizar,
        mover_operacion: OperacionMover,
    ) -> None:
        self._crear_operacion = crear_operacion
        self._actualizar_operacion = actualizar_operacion
        self._mover_operacion = mover_operacion

    async def crear(self, datos: CrearTarea, usuario_id: str) -> dict:
        return await self._crear_operacion(datos, usuario_id)

    async def actualizar(self, tarea_id: str, datos: ActualizarTarea, usuario_id: str) -> dict:
        return await self._actualizar_operacion(tarea_id, datos, usuario_id)

    async def mover(self, tarea_id: str, datos: MoverTarea, usuario_id: str) -> dict:
        return await self._mover_operacion(tarea_id, datos, usuario_id)


class DecoradorServicioTarea(ServicioTareaBase):
    """Decorador base."""

    def __init__(self, servicio: ServicioTareaBase) -> None:
        self._servicio = servicio

    async def crear(self, datos: CrearTarea, usuario_id: str) -> dict:
        return await self._servicio.crear(datos, usuario_id)

    async def actualizar(self, tarea_id: str, datos: ActualizarTarea, usuario_id: str) -> dict:
        return await self._servicio.actualizar(tarea_id, datos, usuario_id)

    async def mover(self, tarea_id: str, datos: MoverTarea, usuario_id: str) -> dict:
        return await self._servicio.mover(tarea_id, datos, usuario_id)


class TareaConValidacionSLA(DecoradorServicioTarea):
    """Valida horas estimadas según reglas de SLA del proyecto."""

    def __init__(self, servicio: ServicioTareaBase, db, reglas: ReglasDecoradorProyecto) -> None:
        super().__init__(servicio)
        self._db = db
        self._reglas = reglas

    def _validar_horas(self, horas_estimadas, *, obligatorio: bool, contexto: str) -> None:
        if horas_estimadas is None:
            if obligatorio:
                raise HTTPException(
                    status_code=400,
                    detail=f"La tarea debe tener horas estimadas para {contexto} (regla SLA activa).",
                )
            return
        if horas_estimadas > self._reglas.max_horas_por_tarea:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Las horas estimadas ({horas_estimadas}) exceden el máximo permitido "
                    f"({self._reglas.max_horas_por_tarea}) por regla SLA."
                ),
            )

    @staticmethod
    def _es_columna_en_progreso(nombre_columna: str) -> bool:
        nombre = (nombre_columna or "").lower()
        return "progreso" in nombre or "in progress" in nombre or "doing" in nombre

    async def crear(self, datos: CrearTarea, usuario_id: str) -> dict:
        self._validar_horas(datos.horasEstimadas, obligatorio=False, contexto="crear la tarea")
        return await self._servicio.crear(datos, usuario_id)

    async def actualizar(self, tarea_id: str, datos: ActualizarTarea, usuario_id: str) -> dict:
        if datos.horasEstimadas is not None:
            self._validar_horas(datos.horasEstimadas, obligatorio=False, contexto="actualizar la tarea")
        return await self._servicio.actualizar(tarea_id, datos, usuario_id)

    async def mover(self, tarea_id: str, datos: MoverTarea, usuario_id: str) -> dict:
        if not self._reglas.validar_horas_antes_mover_en_progreso:
            return await self._servicio.mover(tarea_id, datos, usuario_id)

        columna = await self._db["columnas"].find_one({"_id": datos.columnaIdDestino}, {"nombre": 1})
        if not columna or not self._es_columna_en_progreso(columna.get("nombre", "")):
            return await self._servicio.mover(tarea_id, datos, usuario_id)

        tarea = await self._db["tareas"].find_one({"_id": tarea_id}, {"horasEstimadas": 1})
        if tarea:
            self._validar_horas(
                tarea.get("horasEstimadas"),
                obligatorio=False,
                contexto="mover la tarea a En Progreso",
            )
        return await self._servicio.mover(tarea_id, datos, usuario_id)


class TareaConNotificacionAutomatica(DecoradorServicioTarea):
    """Dispara notificaciones automáticas según reglas del proyecto."""

    def __init__(self, servicio: ServicioTareaBase, db, reglas: ReglasDecoradorProyecto) -> None:
        super().__init__(servicio)
        self._db = db
        self._reglas = reglas

    @staticmethod
    def _es_bug_urgente(tipo: str | None, prioridad: str | None) -> bool:
        return (tipo or "").upper() == "BUG" and (prioridad or "").upper() == "URGENTE"

    async def _obtener_destinatarios_pm(self, proyecto_id: str) -> set[str]:
        proyecto = await self._db["proyectos"].find_one({"_id": proyecto_id})
        if not proyecto:
            return set()

        destinatarios = {proyecto.get("propietarioId")}
        miembros = proyecto.get("miembros", [])
        if miembros:
            cursor = self._db["usuarios"].find(
                {"_id": {"$in": miembros}, "rol": "PROJECT_MANAGER"},
                {"_id": 1},
            )
            pm_ids = [u["_id"] async for u in cursor]
            destinatarios.update(pm_ids)

        return {d for d in destinatarios if d}

    async def _notificar_bug_urgente_pm(
        self,
        *,
        proyecto_id: str,
        tarea_id: str,
        titulo_tarea: str,
        accion: str,
        usuario_id: str,
    ) -> None:
        if not self._reglas.notificar_bug_urgente_pm:
            return

        destinatarios = await self._obtener_destinatarios_pm(proyecto_id)
        for destinatario_id in destinatarios:
            if destinatario_id == usuario_id:
                continue
            await crear_notificacion_interna(
                self._db,
                destinatario_id,
                f"BUG URGENTE {accion}: '{titulo_tarea}'.",
                "BUG_URGENTE",
                tarea_id=tarea_id,
                proyecto_id=proyecto_id,
                titulo_tarea=titulo_tarea,
            )

    async def crear(self, datos: CrearTarea, usuario_id: str) -> dict:
        resultado = await self._servicio.crear(datos, usuario_id)
        if self._es_bug_urgente(datos.tipo.value, datos.prioridad.value):
            await self._notificar_bug_urgente_pm(
                proyecto_id=resultado["proyectoId"],
                tarea_id=resultado["id"],
                titulo_tarea=resultado["titulo"],
                accion="creada",
                usuario_id=usuario_id,
            )
        return resultado

    async def actualizar(self, tarea_id: str, datos: ActualizarTarea, usuario_id: str) -> dict:
        tarea_antes = await self._db["tareas"].find_one(
            {"_id": tarea_id},
            {"tipo": 1, "prioridad": 1, "proyectoId": 1},
        )
        era_bug_urgente = False
        if tarea_antes:
            era_bug_urgente = self._es_bug_urgente(
                tarea_antes.get("tipo"),
                tarea_antes.get("prioridad"),
            )

        resultado = await self._servicio.actualizar(tarea_id, datos, usuario_id)
        es_bug_urgente_ahora = self._es_bug_urgente(resultado.get("tipo"), resultado.get("prioridad"))
        if not era_bug_urgente and es_bug_urgente_ahora:
            await self._notificar_bug_urgente_pm(
                proyecto_id=resultado["proyectoId"],
                tarea_id=resultado["id"],
                titulo_tarea=resultado["titulo"],
                accion="actualizada",
                usuario_id=usuario_id,
            )
        return resultado

    async def mover(self, tarea_id: str, datos: MoverTarea, usuario_id: str) -> dict:
        resultado = await self._servicio.mover(tarea_id, datos, usuario_id)
        if not self._es_bug_urgente(resultado.get("tipo"), resultado.get("prioridad")):
            return resultado

        columna = await self._db["columnas"].find_one({"_id": datos.columnaIdDestino}, {"nombre": 1})
        nombre_columna = columna.get("nombre", "nueva columna") if columna else "nueva columna"
        await self._notificar_bug_urgente_pm(
            proyecto_id=resultado["proyectoId"],
            tarea_id=resultado["id"],
            titulo_tarea=resultado["titulo"],
            accion=f"movida a '{nombre_columna}'",
            usuario_id=usuario_id,
        )
        return resultado


class TareaConAuditoriaEnriquecida(DecoradorServicioTarea):
    """Registra eventos adicionales de auditoría antes y después de cada operación."""

    def __init__(self, servicio: ServicioTareaBase, db) -> None:
        super().__init__(servicio)
        self._db = db

    async def _registrar(
        self,
        *,
        accion: str,
        usuario_id: str,
        proyecto_id: str,
        entidad_id: str,
        valor_anterior,
        valor_nuevo,
    ) -> None:
        await self._db["registros_auditoria"].insert_one(
            {
                "_id": str(uuid.uuid4()),
                "tipoEntidad": "tarea_decorator",
                "entidadId": entidad_id,
                "accion": accion,
                "usuarioId": usuario_id,
                "valorAnterior": valor_anterior,
                "valorNuevo": valor_nuevo,
                "proyectoId": proyecto_id,
                "marca": datetime.now(timezone.utc),
            }
        )

    async def _proyecto_id_tarea(self, tarea_id: str) -> str | None:
        tarea = await self._db["tareas"].find_one({"_id": tarea_id}, {"proyectoId": 1})
        if not tarea:
            return None
        return tarea.get("proyectoId")

    async def crear(self, datos: CrearTarea, usuario_id: str) -> dict:
        await self._registrar(
            accion="DECORATOR_PRE_CREAR",
            usuario_id=usuario_id,
            proyecto_id=datos.proyectoId,
            entidad_id="pendiente",
            valor_anterior=None,
            valor_nuevo=datos.model_dump(),
        )
        resultado = await self._servicio.crear(datos, usuario_id)
        await self._registrar(
            accion="DECORATOR_POST_CREAR",
            usuario_id=usuario_id,
            proyecto_id=resultado["proyectoId"],
            entidad_id=resultado["id"],
            valor_anterior=None,
            valor_nuevo=resultado,
        )
        return resultado

    async def actualizar(self, tarea_id: str, datos: ActualizarTarea, usuario_id: str) -> dict:
        proyecto_id = await self._proyecto_id_tarea(tarea_id)
        if proyecto_id:
            await self._registrar(
                accion="DECORATOR_PRE_ACTUALIZAR",
                usuario_id=usuario_id,
                proyecto_id=proyecto_id,
                entidad_id=tarea_id,
                valor_anterior=None,
                valor_nuevo=datos.model_dump(exclude_none=True),
            )
        resultado = await self._servicio.actualizar(tarea_id, datos, usuario_id)
        await self._registrar(
            accion="DECORATOR_POST_ACTUALIZAR",
            usuario_id=usuario_id,
            proyecto_id=resultado["proyectoId"],
            entidad_id=tarea_id,
            valor_anterior=None,
            valor_nuevo=resultado,
        )
        return resultado

    async def mover(self, tarea_id: str, datos: MoverTarea, usuario_id: str) -> dict:
        proyecto_id = await self._proyecto_id_tarea(tarea_id)
        if proyecto_id:
            await self._registrar(
                accion="DECORATOR_PRE_MOVER",
                usuario_id=usuario_id,
                proyecto_id=proyecto_id,
                entidad_id=tarea_id,
                valor_anterior=None,
                valor_nuevo={"columnaIdDestino": datos.columnaIdDestino},
            )
        resultado = await self._servicio.mover(tarea_id, datos, usuario_id)
        await self._registrar(
            accion="DECORATOR_POST_MOVER",
            usuario_id=usuario_id,
            proyecto_id=resultado["proyectoId"],
            entidad_id=tarea_id,
            valor_anterior=None,
            valor_nuevo=resultado,
        )
        return resultado


def construir_servicio_tarea(
    *,
    db,
    reglas_config: dict | None,
    crear_operacion: OperacionCrear,
    actualizar_operacion: OperacionActualizar,
    mover_operacion: OperacionMover,
) -> ServicioTareaBase:
    """
    Compone dinámicamente el pipeline de decoradores según reglas del proyecto.
    """
    reglas = ReglasDecoradorProyecto.desde_dict(reglas_config)

    servicio: ServicioTareaBase = ServicioTareaNucleo(
        crear_operacion=crear_operacion,
        actualizar_operacion=actualizar_operacion,
        mover_operacion=mover_operacion,
    )

    if reglas.validacion_sla:
        servicio = TareaConValidacionSLA(servicio, db, reglas)
    if reglas.notificacion_automatica:
        servicio = TareaConNotificacionAutomatica(servicio, db, reglas)
    if reglas.auditoria_enriquecida:
        servicio = TareaConAuditoriaEnriquecida(servicio, db)

    return servicio

