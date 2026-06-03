from app.patterns.adapter.iai_adapter import IAIAdapter
from app.patterns.adapter.apis_externas import AnthropicAPI, OpenAIAPI
from app.patterns.adapter.apis_externas import GeminiAPI, GroqAPI


class AnthropicAdaptee(IAIAdapter):
    def generar(self, payload: dict) -> dict:
        import os
        key = os.environ.get("ANTHROPIC_API_KEY")
        return AnthropicAPI.send_messages(payload, key)


class OpenAIAdaptee(IAIAdapter):
    def generar(self, payload: dict) -> dict:
        import os
        key = os.environ.get("OPENAI_API_KEY")
        return OpenAIAPI.send_messages(payload, key)


class GeminiAdaptee(IAIAdapter):
    def generar(self, payload: dict) -> dict:
        import os
        key = os.environ.get("GEMINI_API_KEY")
        return GeminiAPI.send_messages(payload, key)


class GroqAdaptee(IAIAdapter):
    def generar(self, payload: dict) -> dict:
        import os
        key = os.environ.get("GROQ_API_KEY")
        return GroqAPI.send_messages(payload, key)