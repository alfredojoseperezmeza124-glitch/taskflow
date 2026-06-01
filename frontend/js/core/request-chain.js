/* ═══════════════════════════════════════════════════
   TaskFlow — core/request-chain.js
   CADENA DE RESPONSABILIDAD — Handlers de REQUEST.

   Cadena: AuthHandler → ValidationHandler → LogHandler

   Estos handlers procesan el contexto ANTES de que
   la petición HTTP sea enviada al backend.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};

window.TF.RequestChain = (function () {
  "use strict";

  const ChainHandler = window.TF.ChainHandler;
  const state = window.TF.state;

  /* ── 1. AuthHandler ──
     Inyecta el token de autenticación en los headers
     si la petición lo requiere. */
  class AuthHandler extends ChainHandler {
    constructor() {
      super("AuthHandler");
    }

    async handle(ctx) {
      if (ctx.requiresAuth !== false) {
        const token = state.getToken();
        if (token) {
          ctx.headers = ctx.headers || {};
          ctx.headers["Authorization"] = `Bearer ${token}`;
        }
      }
      return super.handle(ctx);
    }
  }

  /* ── 2. ValidationHandler ──
     Valida campos obligatorios en el body antes de
     enviar la petición. Lanza error si falta alguno. */
  class ValidationHandler extends ChainHandler {
    constructor() {
      super("ValidationHandler");
    }

    async handle(ctx) {
      if (ctx.validaciones && ctx.body) {
        for (const campo of ctx.validaciones) {
          const valor = ctx.body[campo];
          if (valor === undefined || valor === null || valor === "") {
            throw new Error(`El campo "${campo}" es obligatorio`);
          }
        }
      }
      return super.handle(ctx);
    }
  }

  /* ── 3. LogHandler ──
     Registra en consola (debug) cada petición saliente.
     Útil para desarrollo y troubleshooting. */
  class LogHandler extends ChainHandler {
    constructor() {
      super("LogHandler");
    }

    async handle(ctx) {
      console.debug(
        `[TF:Request] ${ctx.method} ${ctx.url}`,
        ctx.body ? "(con body)" : ""
      );
      return super.handle(ctx);
    }
  }

  /* ── Fábrica: construye la cadena ya enlazada ── */
  function crearCadenaRequest() {
    const auth = new AuthHandler();
    const validation = new ValidationHandler();
    const log = new LogHandler();

    auth.setNext(validation).setNext(log);

    return auth; // el primer handler de la cadena
  }

  return {
    AuthHandler,
    ValidationHandler,
    LogHandler,
    crearCadenaRequest,
  };
})();
