import os
import pickle
from typing import List, Dict, Any

import numpy as np
from sentence_transformers import SentenceTransformer
from app.patterns.adapter.fabrica_ia import ProveedorIA
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
STORE_PATH = os.path.join(BASE_DIR, "data", "assistant_index.pkl")


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
        if "Groq" in nombre_fabrica:
            modelo = "llama-3.3-70b-versatile"
        elif "Gemini" in nombre_fabrica:
            modelo = "gemini-3.5-flash"
        elif "Anthropic" in nombre_fabrica:
            modelo = "claude-haiku-4-5-20251001"
        else:
            modelo = "gpt-3.5-turbo"

        payload = {
            "model": modelo,
            "max_tokens": 2048,
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