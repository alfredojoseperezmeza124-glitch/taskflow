from app.db.conexion import ConexionMongoDB


async def crear_indices() -> None:
    db = ConexionMongoDB.obtener_instancia().obtener_base_datos()

    await db["usuarios"].create_index("email", unique=True)
    await db["usuarios"].create_index("_id")

    await db["proyectos"].create_index("propietarioId")
    await db["proyectos"].create_index("estado")
    await db["fases"].create_index("proyectoId")
    await db["fases"].create_index([("proyectoId", 1), ("orden", 1)])
    await db["etapas"].create_index("proyectoId")
    await db["etapas"].create_index("faseId")
    await db["etapas"].create_index([("faseId", 1), ("orden", 1)])

    await db["tableros"].create_index("proyectoId")

    await db["tareas"].create_index("columnaId")
    await db["tareas"].create_index("proyectoId")
    await db["tareas"].create_index("faseId")
    await db["tareas"].create_index("etapaId")
    await db["tareas"].create_index([("proyectoId", 1), ("faseId", 1)])
    await db["tareas"].create_index([("proyectoId", 1), ("etapaId", 1)])
    await db["tareas"].create_index([("titulo", "text"), ("descripcion", "text")])
    await db["subtareas"].create_index("tareaId")
    await db["subtareas"].create_index("etapaId")
    await db["subtareas"].create_index("proyectoId")

    await db["notificaciones"].create_index("usuarioId")
    await db["notificaciones"].create_index("leida")

    await db["registros_auditoria"].create_index("proyectoId")
    await db["registros_auditoria"].create_index("usuarioId")

    await db["filtros_guardados"].create_index([("usuarioId", 1), ("proyectoId", 1)])
