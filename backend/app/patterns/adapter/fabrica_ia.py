from abc import ABC, abstractmethod
from typing import Dict
from app.patterns.adapter.iai_adapter import IAIAdapter
from app.patterns.adapter.ia_adaptees import AnthropicAdaptee, OpenAIAdaptee
from app.patterns.adapter.ia_adaptees import GeminiAdaptee, GroqAdaptee


class FabricaIA(ABC):
    @abstractmethod
    def create(self) -> IAIAdapter:
        pass


class FabricaAnthropic(FabricaIA):
    def create(self) -> IAIAdapter:
        return AnthropicAdaptee()


class FabricaOpenAI(FabricaIA):
    def create(self) -> IAIAdapter:
        return OpenAIAdaptee()


class FabricaGemini(FabricaIA):
    def create(self) -> IAIAdapter:
        return GeminiAdaptee()


class FabricaGroq(FabricaIA):
    def create(self) -> IAIAdapter:
        return GroqAdaptee()


class ProveedorIA:
    """Factory provider for LLM adapters. Use `get(provider)` to obtain a factory,
    then call `.create()` to get an adapter instance.
    Supported providers: 'anthropic', 'openai'."""

    def __init__(self) -> None:
        self._fabricas: Dict[str, FabricaIA] = {
            "anthropic": FabricaAnthropic(),
            "openai": FabricaOpenAI(),
            "gemini": FabricaGemini(),
            "groq": FabricaGroq(),
        }

    def get(self, provider: str) -> FabricaIA:
        p = (provider or "").lower()
        if p == "auto":
            # decide based on env availability
            import os
            # prefer Groq if present (gratuito y rápido), luego Gemini, Anthropic, OpenAI
            if os.environ.get("GROQ_API_KEY"):
                p = "groq"
            elif os.environ.get("GEMINI_API_KEY"):
                p = "gemini"
            elif os.environ.get("ANTHROPIC_API_KEY"):
                p = "anthropic"
            elif os.environ.get("OPENAI_API_KEY"):
                p = "openai"

        fabrica = self._fabricas.get(p)
        if not fabrica:
            raise ValueError(f"Proveedor IA '{provider}' no soportado. Use 'anthropic', 'openai', 'gemini', 'groq' o 'auto'.")
        return fabrica