"""
APIs externas para notificaciones.
  - Email REAL via Gmail SMTP (nativo de Python, sin dependencias extra)
  - WhatsApp y SMS REALES via Twilio (si esta configurado)
  - Si faltan credenciales de Twilio, devuelve error explícito
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    from app.core.configuracion import configuracion
    _CONFIGURACION_DISPONIBLE = True
except Exception:
    configuracion = None
    _CONFIGURACION_DISPONIBLE = False


def _twilio_config():
    if not (_CONFIGURACION_DISPONIBLE and configuracion):
        return None, None, None, None

    return (
        (getattr(configuracion, "twilio_account_sid", None) or "").strip(),
        (getattr(configuracion, "twilio_auth_token", None) or "").strip(),
        (getattr(configuracion, "twilio_sms_from", None) or "").strip(),
        (getattr(configuracion, "twilio_whatsapp_from", None) or "").strip(),
    )


class EmailRequest:
    def __init__(self, to: str, subject: str, body: str):
        self.to = to
        self.subject = subject
        self.body = body


class EmailResponse:
    def __init__(self, delivered: str, message_id: str = ""):
        self.delivered = delivered
        self.message_id = message_id


class EmailAPI:
    """
    Envia emails REALES via Gmail SMTP.
    Sin credenciales en .env: modo simulacion (log en consola).
    """

    @staticmethod
    def send_email(request: EmailRequest) -> EmailResponse:
        if not request.to or "@" not in request.to:
            return EmailResponse(delivered="N")

        smtp_user = None
        smtp_password = None
        if _CONFIGURACION_DISPONIBLE and configuracion:
            smtp_user = getattr(configuracion, "email_smtp_user", None)
            smtp_password = getattr(configuracion, "email_smtp_password", None)

        if not smtp_user or not smtp_password:
            print("[Email] Falta configuración SMTP: EMAIL_SMTP_USER y EMAIL_SMTP_PASSWORD")
            return EmailResponse(delivered="N", message_id="")

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = request.subject
            msg["From"] = smtp_user
            msg["To"] = request.to

            html_body = f"""
<html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
  <div style="background:white;padding:24px;border-radius:10px;max-width:520px;
              margin:0 auto;border-top:4px solid #6c63ff;">
    <h2 style="color:#6c63ff;margin-top:0;font-size:18px;">
      TaskFlow &mdash; Notificacion
    </h2>
    <p style="color:#333;line-height:1.7;font-size:14px;">
      {request.body.replace(chr(10), "<br>")}
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="color:#999;font-size:11px;text-align:center;margin:0;">
      Mensaje automatico enviado desde TaskFlow
    </p>
  </div>
</body></html>"""

            msg.attach(MIMEText(html_body, "html"))
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

            msg_id = msg.get("Message-ID", "")
            print(f"[Email REAL enviado] -> {request.to}")
            return EmailResponse(delivered="Y", message_id=msg_id)

        except smtplib.SMTPAuthenticationError:
            print("[Email] Error de autenticacion Gmail — verifica EMAIL_SMTP_PASSWORD")
            return EmailResponse(delivered="N")
        except Exception as e:
            print(f"[Email] Error: {str(e)}")
            return EmailResponse(delivered="N")


class WhatsAppRequest:
    def __init__(self, phone: str, body: str = "", content_sid: str = "", content_variables: str = ""):
        self.phone = phone
        self.body = body
        self.content_sid = content_sid
        self.content_variables = content_variables


class WhatsAppResponse:
    def __init__(self, status: str, message_id: str, error_code: str = "", error_message: str = ""):
        self.status = status
        self.message_id = message_id
        self.error_code = error_code
        self.error_message = error_message


class WhatsAppAPI:
    @staticmethod
    def send_message(request: WhatsAppRequest) -> WhatsAppResponse:
        if not request.phone:
            return WhatsAppResponse(status="failed", message_id="")
        if not request.body and not request.content_sid:
            return WhatsAppResponse(status="failed", message_id="")

        account_sid, auth_token, _sms_from, wa_from = _twilio_config()

        if account_sid and auth_token and wa_from:
            try:
                from twilio.rest import Client

                client = Client(account_sid, auth_token)
                from_number = wa_from if wa_from.startswith("whatsapp:") else f"whatsapp:{wa_from}"
                to_number = request.phone if request.phone.startswith("whatsapp:") else f"whatsapp:{request.phone}"
                payload = {"from_": from_number, "to": to_number}
                if request.content_sid:
                    payload["content_sid"] = request.content_sid
                    if request.content_variables:
                        payload["content_variables"] = request.content_variables
                else:
                    payload["body"] = request.body
                mensaje = client.messages.create(**payload)
                return WhatsAppResponse(
                    status=(mensaje.status or ""),
                    message_id=mensaje.sid or "",
                    error_code=str(mensaje.error_code or ""),
                    error_message=str(mensaje.error_message or ""),
                )
            except Exception as e:
                print(f"[WhatsApp Twilio] Error: {str(e)}")
                return WhatsAppResponse(status="failed", message_id="", error_message=str(e))

        print("  Falta configuración Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM")
        return WhatsAppResponse(status="failed", message_id="")


class SmsRequest:
    def __init__(self, number: str, text: str):
        self.number = number
        self.text = text


class SmsResponse:
    def __init__(
        self,
        code: int,
        description: str,
        message_id: str = "",
        status: str = "",
        error_code: str = "",
        error_message: str = "",
    ):
        self.code = code
        self.description = description
        self.message_id = message_id
        self.status = status
        self.error_code = error_code
        self.error_message = error_message


class SmsAPI:
    @staticmethod
    def send_sms(request: SmsRequest) -> SmsResponse:
        if not request.number or not request.text:
            return SmsResponse(code=400, description="Invalid")

        account_sid, auth_token, sms_from, _wa_from = _twilio_config()

        if account_sid and auth_token and sms_from:
            try:
                from twilio.rest import Client

                client = Client(account_sid, auth_token)
                mensaje = client.messages.create(
                    body=request.text,
                    from_=sms_from,
                    to=request.number,
                )
                estado = (mensaje.status or "").lower()
                aceptado = estado in {"accepted", "queued", "sending", "sent", "delivered"}
                return SmsResponse(
                    code=200 if aceptado else 500,
                    description=f"Twilio status: {mensaje.status}",
                    message_id=mensaje.sid or "",
                    status=mensaje.status or "",
                    error_code=str(mensaje.error_code or ""),
                    error_message=str(mensaje.error_message or ""),
                )
            except Exception as e:
                print(f"[SMS Twilio] Error: {str(e)}")
                return SmsResponse(
                    code=500,
                    description=f"Twilio error: {str(e)}",
                    status="failed",
                    error_message=str(e),
                )

        print("  Falta configuración Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_SMS_FROM")
        return SmsResponse(code=500, description="Twilio no configurado", message_id="")


# ------------------ Wrappers para proveedores LLM ------------------
try:
    import openai as _openai
except Exception:
    _openai = None

import httpx as _httpx
try:
    # google-genai package import path
    import google.genai as _genai
except Exception:
    _genai = None


class AnthropicAPI:
    @staticmethod
    def send_messages(payload: dict, api_key: str):
        """Reenvía payload a Anthropic y devuelve JSON (sin levantar excepción)."""
        if not api_key:
            return {"error": "no_key"}
        url = "https://api.anthropic.com/v1/messages"
        headers = {"Content-Type": "application/json", "x-api-key": api_key}
        try:
            resp = _httpx.post(url, json=payload, headers=headers, timeout=30.0)
            resp.raise_for_status()
            return resp.json()
        except _httpx.HTTPStatusError as e:
            return {"error": "upstream_status", "status_code": e.response.status_code, "text": e.response.text}
        except Exception as e:
            return {"error": "proxy_error", "detail": str(e)}


class OpenAIAPI:
    @staticmethod
    def send_messages(payload: dict, api_key: str):
        """Llama a OpenAI ChatCompletion y devuelve el dict resultante.
        payload expected: { model, messages:[{role,content}], max_tokens }
        """
        if not api_key or _openai is None:
            return {"error": "openai_not_available"}
        try:
            _openai.api_key = api_key
            msgs = payload.get("messages") or []
            resp = _openai.ChatCompletion.create(
                model=payload.get("model", "gpt-3.5-turbo"),
                messages=msgs,
                max_tokens=payload.get("max_tokens", 500),
                temperature=payload.get("temperature", 0.2),
            )
            return dict(resp)
        except Exception as e:
            return {"error": "openai_error", "detail": str(e)}


class GeminiAPI:
    @staticmethod
    def send_messages(payload: dict, api_key: str):
        """Llama a la API REST de Gemini (v1beta) usando generateContent.
        Compatible con gemini-2.5-flash, gemini-2.0-flash y modelos modernos.
        Devuelve un dict con la clave 'text' en caso de éxito.
        """
        if not api_key:
            return {"error": "no_key"}

        # Modelos Gemini 2.x usan la API v1beta con generateContent
        model = (payload.get("model") or "gemini-2.0-flash").replace("/", "-")

        # Construir el prompt unificando system + mensajes
        parts_text = []

        # Si hay system prompt, incluirlo al inicio
        system = payload.get("system")
        if system:
            parts_text.append(system)

        # Agregar mensajes del historial
        msgs = payload.get("messages") or []
        for m in msgs:
            role = (m.get("role") or "user").lower()
            content = m.get("content") or ""
            if role == "system":
                parts_text.insert(0, content)
            else:
                parts_text.append(content)

        prompt_text = "\n\n".join(parts_text) if parts_text else ""

        # Body correcto para generateContent (API v1beta / Gemini 2.x)
        body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt_text}]
                }
            ],
            "generationConfig": {
                "temperature": float(payload.get("temperature", 0.2)),
                "maxOutputTokens": int(payload.get("max_tokens", 400)),
            }
        }

        # Intentar primero v1beta (Gemini 2.x), luego v1 como fallback
        endpoints = [
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent",
        ]

        last_error = None
        for ep in endpoints:
            url = f"{ep}?key={api_key}"
            try:
                resp = _httpx.post(url, json=body, timeout=30.0)
                if resp.status_code == 404:
                    last_error = {"error": "upstream_status", "status_code": 404, "text": resp.text}
                    continue
                resp.raise_for_status()
                j = resp.json()

                # Extraer texto de la respuesta generateContent
                # Estructura: candidates[0].content.parts[0].text
                text = None
                try:
                    candidates = j.get("candidates") or []
                    if candidates:
                        content_obj = candidates[0].get("content") or {}
                        parts = content_obj.get("parts") or []
                        if parts and parts[0].get("text"):
                            text = parts[0]["text"]
                except Exception:
                    pass

                if text:
                    return {"text": text}
                # Si no se pudo extraer, devolver el JSON crudo como texto
                return {"text": str(j)}

            except _httpx.HTTPStatusError as e:
                last_error = {
                    "error": "upstream_status",
                    "status_code": e.response.status_code,
                    "text": e.response.text
                }
                continue
            except Exception as e:
                last_error = {"error": "proxy_error", "detail": str(e)}
                continue

        return last_error or {"error": "no_response"}


class GroqAPI:
    """
    Llama a la API de Groq (compatible con el formato OpenAI ChatCompletion).
    Modelos recomendados: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
    API gratuita: https://console.groq.com
    """

    @staticmethod
    def send_messages(payload: dict, api_key: str):
        if not api_key:
            return {"error": "no_key"}

        model = payload.get("model") or "llama-3.3-70b-versatile"

        # Construir lista de mensajes en formato OpenAI
        messages = []
        system = payload.get("system")
        if system:
            messages.append({"role": "system", "content": system})

        for m in payload.get("messages") or []:
            role = (m.get("role") or "user").lower()
            content = m.get("content") or ""
            if role == "system":
                # Insertar al inicio si viene como mensaje
                messages.insert(0, {"role": "system", "content": content})
            else:
                messages.append({"role": role, "content": content})

        body = {
            "model": model,
            "messages": messages,
            "max_tokens": int(payload.get("max_tokens", 2048)),
            "temperature": float(payload.get("temperature", 0.2)),
        }

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        try:
            resp = _httpx.post(url, json=body, headers=headers, timeout=30.0)
            resp.raise_for_status()
            j = resp.json()

            # Formato OpenAI: choices[0].message.content
            text = None
            try:
                text = j["choices"][0]["message"]["content"]
            except (KeyError, IndexError):
                pass

            if text:
                return {"text": text}
            return {"text": str(j)}

        except _httpx.HTTPStatusError as e:
            return {
                "error": "upstream_status",
                "status_code": e.response.status_code,
                "text": e.response.text,
            }
        except Exception as e:
            return {"error": "proxy_error", "detail": str(e)}