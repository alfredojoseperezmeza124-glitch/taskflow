"""
PATRON PROXY - ProxyGestionProyectos / ProxyGestionTareas
Aplica validaciones previas y registro posterior para operaciones de gestion
de proyectos y tareas.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Awaitable, Callable, TypeVar
import uuid

from fastapi import HTTPException
from app.patterns.chain.validador import (
    ValidadorProyectoExiste,
    ValidadorMembresiaProyecto,
    ValidadorPropietarioProyecto,
    ValidadorProyectoArchivado,
    ValidadorTareaExiste,
    ValidadorSLA,
)
from app.patterns.state.estado_proyecto import EstadoProyectoFactory

ResultadoT = TypeVar("ResultadoT")
class _ProxyBase:
    def __init__(self, db) -> None:
        self._db = db

    async def _registrar_auditoria(
        self,
        *,
        tipo_entidad: str,
        entidad_id: str,
        accion: str,
        usuario_id: str,
        proyecto_id: str,
        valor_anterior,
        valor_nuevo,
    ) -> None:
        await self._db["registros_auditoria"].insert_one(
            {
                "_id": str(uuid.uuid4()),
                "tipoEntidad": tipo_entidad,
                "entidadId": entidad_id,
                "accion": accion,
                "usuarioId": usuario_id,
                "valorAnterior": valor_anterior,
                "valorNuevo": valor_nuevo,
                "proyectoId": proyecto_id,
                "marca": datetime.now(timezone.utc),
            }
        )


class ProxyGestionProyectos(_ProxyBase):
    async def ejecutar_en_proyecto(
        self,
        *,
        proyecto_id: str,
        usuario_id: str,
        rol: str,
        accion: str,
        operacion: Callable[[dict], Awaitable[ResultadoT]],
        validar_membresia: bool = True,
        requiere_propietario: bool = False,
        permitir_archivado: bool = False,
    ) -> ResultadoT:
        contexto = {
            "db": self._db,
            "proyecto_id": proyecto_id,
            "usuario_id": usuario_id,
            "rol": rol,
            "permitir_archivado": permitir_archivado,
        }
        cadena = ValidadorProyectoArchivado(ValidadorSLA())
        if validar_membresia:
            cadena = ValidadorMembresiaProyecto(cadena)
        if requiere_propietario:
            cadena = ValidadorPropietarioProyecto(cadena)
        cadena = ValidadorProyectoExiste(cadena)

        await cadena.validar(contexto)
        proyecto = contexto["proyecto"]
        await self._registrar_auditoria(
            tipo_entidad="proyecto_proxy",
            entidad_id=proyecto_id,
            accion=f"PROXY_PRE_{accion}",
            usuario_id=usuario_id,
            proyecto_id=proyecto_id,
            valor_anterior={"estado": proyecto.get("estado"), "estaArchivado": proyecto.get("estaArchivado", False)},
            valor_nuevo=None,
        )

        resultado = await operacion(proyecto)

        await self._registrar_auditoria(
            tipo_entidad="proyecto_proxy",
            entidad_id=proyecto_id,
            accion=f"PROXY_POST_{accion}",
            usuario_id=usuario_id,
            proyecto_id=proyecto_id,
            valor_anterior=None,
            valor_nuevo={"resultado": "OK"},
        )
        return resultado


class ProxyGestionTareas(_ProxyBase):
    async def ejecutar_creacion_en_proyecto(
        self,
        *,
        proyecto_id: str,
        usuario_id: str,
        accion: str,
        operacion: Callable[[dict], Awaitable[ResultadoT]],
        permitir_archivado: bool = False,
    ) -> ResultadoT:
        contexto = {
            "db": self._db,
            "proyecto_id": proyecto_id,
            "usuario_id": usuario_id,
            "permitir_archivado": permitir_archivado,
        }
        cadena = ValidadorProyectoExiste(ValidadorProyectoArchivado(ValidadorSLA()))
        await cadena.validar(contexto)
        proyecto = contexto["proyecto"]

        estado = EstadoProyectoFactory.crear(proyecto.get("estado"))
        if not estado.puede_crear_tarea():
            raise HTTPException(status_code=400, detail="No se pueden crear tareas en el estado actual del proyecto")

        await self._registrar_auditoria(
            tipo_entidad="tarea_proxy",
            entidad_id=f"proyecto:{proyecto_id}",
            accion=f"PROXY_PRE_{accion}",
            usuario_id=usuario_id,
            proyecto_id=proyecto_id,
            valor_anterior={"estadoProyecto": proyecto.get("estado"), "estaArchivado": proyecto.get("estaArchivado", False)},
            valor_nuevo=None,
        )

        resultado = await operacion(proyecto)

        await self._registrar_auditoria(
            tipo_entidad="tarea_proxy",
            entidad_id=f"proyecto:{proyecto_id}",
            accion=f"PROXY_POST_{accion}",
            usuario_id=usuario_id,
            proyecto_id=proyecto_id,
            valor_anterior=None,
            valor_nuevo={"resultado": "OK"},
        )
        return resultado

    async def ejecutar_en_tarea(
        self,
        *,
        tarea_id: str,
        usuario_id: str,
        accion: str,
        operacion: Callable[[dict], Awaitable[ResultadoT]],
        permitir_proyecto_archivado: bool = False,
    ) -> ResultadoT:
        contexto = {
            "db": self._db,
            "tarea_id": tarea_id,
            "usuario_id": usuario_id,
            "permitir_archivado": permitir_proyecto_archivado,
        }
        cadena = ValidadorTareaExiste(ValidadorProyectoExiste(ValidadorProyectoArchivado(ValidadorSLA())))
        await cadena.validar(contexto)
        tarea = contexto["tarea"]

        await self._registrar_auditoria(
            tipo_entidad="tarea_proxy",
            entidad_id=tarea_id,
            accion=f"PROXY_PRE_{accion}",
            usuario_id=usuario_id,
            proyecto_id=tarea["proyectoId"],
            valor_anterior={"columnaId": tarea.get("columnaId"), "proyectoArchivado": contexto["proyecto"].get("estaArchivado", False)},
            valor_nuevo=None,
        )

        resultado = await operacion(tarea)

        await self._registrar_auditoria(
            tipo_entidad="tarea_proxy",
            entidad_id=tarea_id,
            accion=f"PROXY_POST_{accion}",
            usuario_id=usuario_id,
            proyecto_id=tarea["proyectoId"],
            valor_anterior=None,
            valor_nuevo={"resultado": "OK"},
        )
        return resultado

