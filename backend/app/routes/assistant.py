from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any

from app.services.assistant import assistant
import os
try:
    import openai
    OPENAI_AVAILABLE = True
except Exception:
    openai = None
    OPENAI_AVAILABLE = False
import httpx

OPENAI_KEY = os.environ.get("OPENAI_API_KEY")
if OPENAI_KEY and OPENAI_AVAILABLE:
    openai.api_key = OPENAI_KEY

enrutador = APIRouter()


class DocItem(BaseModel):
    id: str
    text: str
    meta: Dict[str, Any] = {}


class IndexRequest(BaseModel):
    docs: List[DocItem]


class QueryRequest(BaseModel):
    query: str
    k: int = 3


@enrutador.post("/assistant/index", tags=["Assistant"], summary="Indexar documentos para el asistente")
async def index(req: IndexRequest):
    items = [d.dict() for d in req.docs]
    assistant.index(items)
    return {"indexed": len(items)}


@enrutador.post("/assistant/query", tags=["Assistant"], summary="Consultar al asistente con contexto")
async def query(req: QueryRequest):
    resp = assistant.answer(req.query, k=req.k)
    return resp


@enrutador.get("/assistant/health", tags=["Assistant"], summary="Health del asistente")
async def health():
    return {"status": "ready"}


from fastapi import Form, UploadFile, File
from app.patterns.adapter.fabrica_ia import ProveedorIA


@enrutador.post("/assistant/message", tags=["Assistant"], summary="Guardar mensaje del chat")
async def save_message(role: str = Form(None), text: str = Form(None), session_id: str = Form(None)):
    from app.db.conexion import ConexionMongoDB
    from datetime import datetime
    db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
    doc = {
        "session_id": session_id or "default",
        "role": role or "user",
        "text": text,
        "meta": {},
        "created_at": datetime.utcnow(),
    }
    res = await db["assistant_chats"].insert_one(doc)
    return {"inserted_id": str(res.inserted_id)}


@enrutador.get("/assistant/history", tags=["Assistant"], summary="Obtener historial de chat por sesión")
async def history(session_id: str = None, limit: int = 100):
    from app.db.conexion import ConexionMongoDB
    db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
    q = {"session_id": session_id or "default"}
    cursor = db["assistant_chats"].find(q).sort("created_at", -1).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    return {"history": list(reversed(items))}


@enrutador.post("/assistant/upload", tags=["Assistant"], summary="Subir archivo y guardar referencia en historial")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(None)):
    from app.db.conexion import ConexionMongoDB
    from datetime import datetime
    import uuid

    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'data', 'uploads')
    uploads_dir = os.path.abspath(uploads_dir)
    os.makedirs(uploads_dir, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    dest_path = os.path.join(uploads_dir, unique_name)
    with open(dest_path, "wb") as f:
        contents = await file.read()
        f.write(contents)

    db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
    doc = {
        "session_id": session_id or "default",
        "role": "user",
        "text": f"Uploaded file: {file.filename}",
        "meta": {"filename": file.filename, "path": dest_path},
        "created_at": datetime.utcnow(),
    }
    res = await db["assistant_chats"].insert_one(doc)
    return {"filename": file.filename, "stored_name": unique_name, "inserted_id": str(res.inserted_id)}


@enrutador.post("/assistant/proxy_anthropic", tags=["Assistant"], summary="Proxy LLM (Factory+Adapter)")
async def proxy_anthropic(payload: Dict[str, Any]):

    provider_env = os.environ.get("LLM_PROVIDER", "auto")
    proveedor = ProveedorIA()
    try:
        fabrica = proveedor.get(provider_env)
    except ValueError:
        try:
            fabrica = proveedor.get("auto")
        except ValueError:
            return {"error": "No hay proveedor configurado. Configure GROQ_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY u OPENAI_API_KEY en el servidor."}

    # Sobrescribir el modelo según el proveedor activo
    nombre_fabrica = type(fabrica).__name__
    if "Groq" in nombre_fabrica:
        payload["model"] = "llama-3.3-70b-versatile"
    elif "Gemini" in nombre_fabrica:
        payload["model"] = "gemini-2.0-flash"
    elif "Anthropic" in nombre_fabrica:
        payload["model"] = "claude-haiku-4-5-20251001"
    else:
        payload["model"] = "gpt-3.5-turbo"

    adapter = fabrica.create()
    result = adapter.generar(payload)
    return result