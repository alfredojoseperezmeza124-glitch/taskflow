from fastapi import APIRouter, Depends
from typing import List
from app.schemas.proyectos import (
    CrearProyecto,
    ActualizarProyecto,
    InvitarMiembro,
    CrearFase,
    ActualizarFase,
    CrearEtapa,
    ActualizarEtapa,
    RespuestaFase,
    RespuestaEtapa,
)
from app.services import servicio_proyecto
from app.core.dependencias import obtener_usuario_actual, requerir_rol

enrutador = APIRouter(prefix="/proyectos", tags=["Proyectos"])


@enrutador.get("/")
async def listar(usuario: dict = Depends(obtener_usuario_actual)):
    return await servicio_proyecto.listar_proyectos(usuario["_id"], usuario["rol"])


@enrutador.get("/{proyecto_id}")
async def obtener(proyecto_id: str, usuario: dict = Depends(obtener_usuario_actual)):
    return await servicio_proyecto.obtener_proyecto(proyecto_id, usuario["_id"], usuario["rol"])


@enrutador.get("/{proyecto_id}/miembros")
async def miembros(proyecto_id: str, _: dict = Depends(obtener_usuario_actual)):
    return await servicio_proyecto.obtener_miembros_proyecto(proyecto_id)


@enrutador.post("/", status_code=201)
async def crear(
    datos: CrearProyecto,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.crear_proyecto(datos, usuario["_id"])


@enrutador.put("/{proyecto_id}")
async def actualizar(
    proyecto_id: str,
    datos: ActualizarProyecto,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.actualizar_proyecto(proyecto_id, datos, usuario["_id"], usuario["rol"])


@enrutador.delete("/{proyecto_id}")
async def eliminar(
    proyecto_id: str,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.eliminar_proyecto(proyecto_id, usuario["_id"], usuario["rol"])


@enrutador.post("/{proyecto_id}/archivar")
async def archivar(
    proyecto_id: str,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.archivar_proyecto(proyecto_id, usuario["_id"], usuario["rol"])


@enrutador.post("/{proyecto_id}/invitar")
async def invitar(
    proyecto_id: str,
    datos: InvitarMiembro,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.invitar_miembro(proyecto_id, datos, usuario["_id"], usuario["rol"])


@enrutador.post("/{proyecto_id}/clonar", status_code=201)
async def clonar(
    proyecto_id: str,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.clonar_proyecto_servicio(proyecto_id, usuario["_id"], usuario["rol"])


@enrutador.get("/{proyecto_id}/jerarquia")
async def jerarquia_proyecto(proyecto_id: str, usuario: dict = Depends(obtener_usuario_actual)):
    return await servicio_proyecto.obtener_jerarquia_proyecto_compuesta(
        proyecto_id, usuario["_id"], usuario["rol"]
    )


@enrutador.get("/{proyecto_id}/fases", response_model=List[RespuestaFase])
async def listar_fases(proyecto_id: str, usuario: dict = Depends(obtener_usuario_actual)):
    return await servicio_proyecto.listar_fases_proyecto(proyecto_id, usuario["_id"], usuario["rol"])


@enrutador.post("/{proyecto_id}/fases", status_code=201, response_model=RespuestaFase)
async def crear_fase(
    proyecto_id: str,
    datos: CrearFase,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.crear_fase(proyecto_id, datos, usuario["_id"], usuario["rol"])


@enrutador.put("/fases/{fase_id}", response_model=RespuestaFase)
async def actualizar_fase(
    fase_id: str,
    datos: ActualizarFase,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.actualizar_fase(fase_id, datos, usuario["_id"], usuario["rol"])


@enrutador.delete("/fases/{fase_id}")
async def eliminar_fase(
    fase_id: str,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.eliminar_fase(fase_id, usuario["_id"], usuario["rol"])


@enrutador.get("/fases/{fase_id}/etapas", response_model=List[RespuestaEtapa])
async def listar_etapas(fase_id: str, usuario: dict = Depends(obtener_usuario_actual)):
    return await servicio_proyecto.listar_etapas_fase(fase_id, usuario["_id"], usuario["rol"])


@enrutador.post("/fases/{fase_id}/etapas", status_code=201, response_model=RespuestaEtapa)
async def crear_etapa(
    fase_id: str,
    datos: CrearEtapa,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.crear_etapa(fase_id, datos, usuario["_id"], usuario["rol"])


@enrutador.put("/etapas/{etapa_id}", response_model=RespuestaEtapa)
async def actualizar_etapa(
    etapa_id: str,
    datos: ActualizarEtapa,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.actualizar_etapa(etapa_id, datos, usuario["_id"], usuario["rol"])


@enrutador.delete("/etapas/{etapa_id}")
async def eliminar_etapa(
    etapa_id: str,
    usuario: dict = Depends(requerir_rol("PROJECT_MANAGER", "ADMIN")),
):
    return await servicio_proyecto.eliminar_etapa(etapa_id, usuario["_id"], usuario["rol"])
