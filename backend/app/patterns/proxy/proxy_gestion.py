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
        proyecto = await self._db["proyectos"].find_one({"_id": proyecto_id})
        if not proyecto:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        if validar_membresia and rol != "ADMIN" and usuario_id not in proyecto.get("miembros", []):
            raise HTTPException(status_code=403, detail="Sin acceso al proyecto")

        if requiere_propietario and rol != "ADMIN" and proyecto.get("propietarioId") != usuario_id:
            raise HTTPException(
                status_code=403,
                detail="Solo el propietario o un Admin puede ejecutar esta accion en el proyecto",
            )

        if proyecto.get("estaArchivado") and not permitir_archivado:
            raise HTTPException(status_code=400, detail="El proyecto esta archivado y es de solo lectura")

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
        proyecto = await self._db["proyectos"].find_one({"_id": proyecto_id}, {"_id": 1, "estado": 1, "estaArchivado": 1})
        if not proyecto:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        if proyecto.get("estaArchivado") and not permitir_archivado:
            raise HTTPException(status_code=400, detail="No se puede gestionar tareas en un proyecto archivado")

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
        tarea = await self._db["tareas"].find_one({"_id": tarea_id})
        if not tarea:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")

        proyecto = await self._db["proyectos"].find_one(
            {"_id": tarea["proyectoId"]},
            {"_id": 1, "estado": 1, "estaArchivado": 1},
        )
        if not proyecto:
            raise HTTPException(status_code=404, detail="Proyecto asociado a la tarea no encontrado")
        if proyecto.get("estaArchivado") and not permitir_proyecto_archivado:
            raise HTTPException(status_code=400, detail="No se puede gestionar tareas en un proyecto archivado")

        await self._registrar_auditoria(
            tipo_entidad="tarea_proxy",
            entidad_id=tarea_id,
            accion=f"PROXY_PRE_{accion}",
            usuario_id=usuario_id,
            proyecto_id=tarea["proyectoId"],
            valor_anterior={"columnaId": tarea.get("columnaId"), "proyectoArchivado": proyecto.get("estaArchivado", False)},
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

