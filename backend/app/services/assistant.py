import os
import pickle
from typing import List, Dict, Any

import numpy as np
from sentence_transformers import SentenceTransformer
from app.patterns.adapter.fabrica_ia import ProveedorIA
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
STORE_PATH = os.path.join(BASE_DIR, "data", "assistant_index.pkl")
HISTORY_PATH = os.path.join(BASE_DIR, "data", "chat_history.json")


class VectorAssistant:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self._ensure_storage()
        self._load()

    def _ensure_storage(self):
        data_dir = os.path.join(BASE_DIR, "data")
        os.makedirs(data_dir, exist_ok=True)

    def _load(self):
        if os.path.exists(STORE_PATH):
            with open(STORE_PATH, "rb") as f:
                self.store = pickle.load(f)
        else:
            self.store = {"docs": [], "embeddings": None}
        # no FAISS: we use brute-force similarity over stored embeddings

    def _save(self):
        with open(STORE_PATH, "wb") as f:
            pickle.dump(self.store, f)

    def index(self, docs: List[Dict[str, Any]]):
        """Indexa una lista de documentos: {'id': str, 'text': str, 'meta': {...}}"""
        texts = [d["text"] for d in docs]
        embeddings = self.model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        # append
        start = len(self.store["docs"])
        for i, d in enumerate(docs):
            self.store["docs"].append(d)
        if self.store["embeddings"] is None:
            self.store["embeddings"] = embeddings.astype(np.float32)
        else:
            self.store["embeddings"] = np.vstack([self.store["embeddings"], embeddings.astype(np.float32)])
        self._save()

    def query(self, query_text: str, k: int = 3):
        if not self.store["docs"]:
            return []
        q_emb = self.model.encode([query_text], convert_to_numpy=True).astype(np.float32)
        results = []
        # fallback to brute-force
        emb_matrix = np.array(self.store["embeddings"]).astype(np.float32)
        # cosine similarity
        def cos_sim(a, b):
            a = a / np.linalg.norm(a)
            b = b / np.linalg.norm(b)
            return float(np.dot(a, b))

        sims = [cos_sim(q_emb[0], e) for e in emb_matrix]
        idxs = np.argsort(sims)[-k:][::-1]
        for idx in idxs:
            doc = self.store["docs"][int(idx)]
            results.append({"id": doc.get("id"), "text": doc.get("text"), "meta": doc.get("meta"), "score": float(sims[int(idx)])})
        return results

    def _extract_text_from_provider(self, data: Dict[str, Any]) -> str:
        # OpenAI ChatCompletion format
        try:
            if isinstance(data, dict):
                if data.get("choices") and isinstance(data.get("choices"), list):
                    c = data["choices"][0]
                    # ChatCompletion response
                    if isinstance(c.get("message"), dict) and c["message"].get("content"):
                        return c["message"]["content"]
                    # older format
                    if c.get("text"):
                        return c.get("text")
                # Anthropic format
                if data.get("content") and isinstance(data.get("content"), list):
                    first = data["content"][0]
                    if isinstance(first, dict) and first.get("text"):
                        return first.get("text")
                if data.get("completion"):
                    return data.get("completion")
                if data.get("text"):
                    return data.get("text")
        except Exception:
            pass
        # fallback: stringify
        try:
            return json.dumps(data)
        except Exception:
            return str(data)

    # ── Historial de chat ──────────────────────────────────────────────────

    def _load_history(self) -> Dict[str, List[Dict[str, Any]]]:
        """Carga el historial completo desde disco. Devuelve dict {session_id: [mensajes]}."""
        if os.path.exists(HISTORY_PATH):
            try:
                with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def _save_history(self, history: Dict[str, List[Dict[str, Any]]]) -> None:
        """Persiste el historial completo en disco."""
        try:
            with open(HISTORY_PATH, "w", encoding="utf-8") as f:
                json.dump(history, f, ensure_ascii=False, indent=2)
        except OSError:
            pass

    def save_message(self, session_id: str, role: str, text: str) -> Dict[str, Any]:
        """Guarda un mensaje en el historial de la sesion indicada.

        Args:
            session_id: Identificador de la conversacion (ej. el id del proyecto).
            role:       "user" o "assistant".
            text:       Contenido del mensaje.

        Returns:
            El mensaje guardado con su timestamp.
        """
        import datetime

        history = self._load_history()
        if session_id not in history:
            history[session_id] = []

        message = {
            "role": role,
            "text": text,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        }
        history[session_id].append(message)

        # Limitar a los ultimos 200 mensajes por sesion para evitar crecimiento infinito
        if len(history[session_id]) > 200:
            history[session_id] = history[session_id][-200:]

        self._save_history(history)
        return message

    def get_history(self, session_id: str, limit: int = 200) -> List[Dict[str, Any]]:
        """Devuelve los ultimos limit mensajes de una sesion.

        Args:
            session_id: Identificador de la conversacion.
            limit:      Numero maximo de mensajes a devolver.

        Returns:
            Lista de mensajes ordenados del mas antiguo al mas reciente.
        """
        history = self._load_history()
        messages = history.get(session_id, [])
        return messages[-limit:] if limit else messages

    def delete_history(self, session_id: str) -> bool:
        """Elimina el historial completo de una sesion.

        Returns:
            True si existia y fue borrado, False si no existia.
        """
        history = self._load_history()
        if session_id in history:
            del history[session_id]
            self._save_history(history)
            return True
        return False

    # ── Respuesta RAG ──────────────────────────────────────────────────────

    def answer(self, query_text: str, k: int = 3) -> Dict[str, Any]:
        """Realiza la búsqueda vectorial y, si hay proveedor LLM configurado,
        genera una respuesta natural usando el proveedor seleccionado via Factory+Adapter.
        Si no hay proveedor configurado, devuelve las fuentes concatenadas como fallback.
        Returns: { answer: str, sources: [..] }
        """
        results = self.query(query_text, k=k)
        if not results:
            return {"answer": "No hay contexto indexado.", "sources": []}

        # build context text
        context = "\n\n".join([f"Fuente ({r['id']}): {r['text']}" for r in results])

        # Prepare payload for LLM
        system = (
            "Eres un asistente que responde preguntas sobre un proyecto. "
            "Usando las siguientes fuentes, responde concisamente en español y cita las fuentes si aplican."
        )
        prompt = f"Fuentes:\n{context}\n\nPregunta: {query_text}\n\nRespuesta:"

        # select provider via ProveedorIA (env LLM_PROVIDER or auto)
        provider_env = os.environ.get("LLM_PROVIDER", "auto")
        proveedor = ProveedorIA()
        try:
            fabrica = proveedor.get(provider_env)
        except ValueError:
            try:
                fabrica = proveedor.get("auto")
            except ValueError:
                # No hay proveedor disponible -> fallback a fuentes
                answer = "\n\n".join([f"- ({r['id']}) {r['text']}" for r in results])
                return {"answer": answer, "sources": results, "error": "no_provider_configured"}

        # Seleccionar modelo según proveedor activo
        nombre_fabrica = type(fabrica).__name__
        if "Gemini" in nombre_fabrica:
            modelo = "gemini-2.0-flash"
        elif "Anthropic" in nombre_fabrica:
            modelo = "claude-haiku-4-5-20251001"
        else:
            modelo = "gpt-3.5-turbo"

        payload = {
            "model": modelo,
            "max_tokens": 400,
            "temperature": 0.2,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }

        adapter = fabrica.create()
        resp = adapter.generar(payload)

        # If provider returned error or no provider configured, fallback to concatenated sources
        if not resp or (isinstance(resp, dict) and resp.get("error")):
            answer = "\n\n".join([f"- ({r['id']}) {r['text']}" for r in results])
            return {"answer": answer, "sources": results, "error": resp.get("error") if isinstance(resp, dict) else None}

        text = self._extract_text_from_provider(resp)
        return {"answer": text, "sources": results}


assistant = VectorAssistant()