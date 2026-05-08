from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import traceback
import logging

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger("taskflow")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from contextlib import asynccontextmanager

from app.db.conexion import ConexionMongoDB
from app.db.indices import crear_indices
from app.routes import usuarios, proyectos, tableros, tareas, notificaciones, reportes, subtareas


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    ConexionMongoDB.obtener_instancia().conectar()
    await crear_indices()
    yield
    ConexionMongoDB.obtener_instancia().desconectar()


app = FastAPI(
    title="TaskFlow API",
    version="1.0.0",
    description="""
## Plataforma de Gestión Colaborativa de Tareas

API REST desarrollada con **FastAPI** y **MongoDB Atlas**.

### Patrones de diseño implementados

| Patrón | Módulo | Uso en el sistema |
|--------|--------|-------------------|
| **Singleton** | `db/conexion.py` | Cliente único de MongoDB durante toda la app |
| **Factory Method** | `patterns/factory/` | Crea tareas según tipo: BUG, FEATURE, TASK, IMPROVEMENT |
| **Abstract Factory** | `patterns/abstract_factory/` | Genera familias de variables CSS para cada tema visual |
| **Prototype** | `patterns/prototype/` | Clona tareas y proyectos con nuevos IDs |
| **Builder** | `patterns/builder/` | Construye tareas complejas y subtareas paso a paso |
| **Adapter** | `patterns/adapter/` | Traduce notificaciones a Email/WhatsApp/SMS |
| **Bridge** | `patterns/bridge/` | Exporta reportes separando tipo de reporte y formato de salida |
| **Composite** | `patterns/composite/` | Construye jerarquías de proyecto/fase/etapa/subtarea y calcula progreso recursivo |
| **Decorator** | `patterns/decorator/` | Aplica reglas configurables de SLA, notificación y auditoría en tareas |
| **Facade** | `patterns/facade/` | Simplifica operaciones complejas de ciclo de vida y estructura de proyectos |
| **Proxy** | `patterns/proxy/` | Ejecuta validaciones previas/posteriores para la gestión de tareas y proyectos |
| **Flyweight** | `patterns/flyweight/` | Reutiliza perfiles visuales compartidos para tareas por tipo/prioridad/estado |

### Autenticación

Todas las rutas protegidas requieren el header:
```
Authorization: Bearer <token_jwt>
```
El token se obtiene en `POST /api/v1/usuarios/login` y expira en **8 horas**.

### Roles del sistema

| Rol | Permisos |
|-----|----------|
| **ADMIN** | Acceso total: usuarios, configuración, auditoría global |
| **PROJECT_MANAGER** | Proyectos, tableros, columnas, reportes, invitaciones |
| **DEVELOPER** | Tareas, subtareas, comentarios, tiempo, notificaciones propias |
""",
    lifespan=ciclo_de_vida,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={"name": "TaskFlow", "email": "admin@taskflow.io"},
    license_info={"name": "Universidad Popular del Cesar — Patrones de Diseño 2026"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def handler_global(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logger.error(f"Error en {request.url}:\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": tb},
        headers={"Access-Control-Allow-Origin": request.headers.get("origin", "*")},
    )

PREFIJO = "/api/v1"

app.include_router(usuarios.enrutador, prefix=PREFIJO)
app.include_router(proyectos.enrutador, prefix=PREFIJO)
app.include_router(tableros.enrutador, prefix=PREFIJO)
app.include_router(tareas.enrutador, prefix=PREFIJO)
app.include_router(subtareas.enrutador, prefix=PREFIJO)
app.include_router(notificaciones.enrutador, prefix=PREFIJO)
app.include_router(reportes.enrutador, prefix=PREFIJO)


@app.get("/", tags=["Salud"], summary="Estado de la API")
async def raiz():
    return {
        "mensaje": "TaskFlow API activa",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
    }


@app.get("/salud", tags=["Salud"], summary="Health check")
async def salud():
    return {"estado": "ok"}


def schema_openapi_personalizado():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        contact=app.contact,
        license_info=app.license_info,
    )

    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Token JWT obtenido en POST /api/v1/usuarios/login",
        }
    }

    rutas_publicas = {
        "/api/v1/usuarios/registro": ["post"],
        "/api/v1/usuarios/login": ["post"],
        "/": ["get"],
        "/salud": ["get"],
    }
    for ruta, métodos in schema.get("paths", {}).items():
        for metodo, operacion in métodos.items():
            if ruta in rutas_publicas and metodo in rutas_publicas[ruta]:
                operacion["security"] = []
            else:
                operacion.setdefault("security", [{"BearerAuth": []}])

    schema["tags"] = [
        {"name": "Usuarios",         "description": "RF-01 · Registro, login JWT, perfil y gestión de cuentas"},
        {"name": "Proyectos",         "description": "RF-02 · CRUD de proyectos, invitaciones, clonado (Prototype), archivado y simplificación de operaciones complejas (Facade + Proxy)"},
        {"name": "Tableros",          "description": "RF-03 · Tableros Kanban, columnas y límites WIP"},
        {"name": "Tareas",            "description": "RF-04 · Gestión de tareas (Factory Method + Builder + Prototype + Composite + Decorator + Proxy + Flyweight), comentarios y tiempo"},
        {"name": "Subtareas",         "description": "RF-04b · Subtareas por tarea — Patrón Builder (ConstructorSubtarea)"},
        {"name": "Notificaciones",    "description": "RF-05 · IN_APP + Email/WhatsApp/SMS via Factory Method + Adapter. SSE en tiempo real."},
        {"name": "Reportes y Configuración", "description": "RF-06/07/08/09 · Historial, auditoría, métricas, filtros y configuración del sistema"},
        {"name": "Salud",             "description": "Health check y metadatos de la API"},
    ]

    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = schema_openapi_personalizado
