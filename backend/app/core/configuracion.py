from pydantic_settings import BaseSettings
from pathlib import Path

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


class Configuracion(BaseSettings):
    # Allow extra environment variables (e.g., OPENAI_API_KEY) and load .env
    model_config = {
        "extra": "ignore",
        "env_file": str(_ENV_PATH),
        "env_file_encoding": "utf-8",
    }
    mongodb_url: str
    nombre_bd: str = "taskflow"
    clave_secreta_jwt: str
    algoritmo_jwt: str = "HS256"
    minutos_expiracion_token: int = 480
    puerto: int = 8000

    # Email SMTP (Gmail) — opcional, solo para envio real
    email_smtp_user: str = None
    email_smtp_password: str = None

    # Twilio — opcional para WhatsApp y SMS reales
    twilio_account_sid: str = None
    twilio_auth_token: str = None
    twilio_sms_from: str = None
    twilio_whatsapp_from: str = None
    twilio_whatsapp_content_sid: str = None
    twilio_whatsapp_content_variables: str = None
    twilio_whatsapp_mensaje_key: str = "1"

configuracion = Configuracion()
