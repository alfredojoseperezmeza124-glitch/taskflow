/* ═══════════════════════════════════════════════════
   TaskFlow — core/response-chain.js
   CADENA DE RESPONSABILIDAD — Handlers de RESPONSE.

   Cadena: NormalizeHandler → ErrorHandler → CacheHandler

   Estos handlers procesan la respuesta DESPUÉS de
   recibirla del backend.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};

window.TF.ResponseChain = (function () {
  "use strict";

  const ChainHandler = window.TF.ChainHandler;

  /* ── 1. NormalizeHandler ──
     Normaliza el formato de la respuesta: asegura que
     las respuestas paginadas tengan estructura consistente. */
  class NormalizeHandler extends ChainHandler {
    constructor() {
      super("NormalizeHandler");
    }

    async handle(ctx) {
      // Si la respuesta es un objeto con campo "datos", normalizar paginación
      if (ctx.data && typeof ctx.data === "object" && !Array.isArray(ctx.data)) {
        if ("datos" in ctx.data) {
          ctx.paginado = true;
          ctx.datosNormalizados = {
            datos: Array.isArray(ctx.data.datos) ? ctx.data.datos : [],
            pagina: ctx.data.pagina || 1,
            totalPaginas: ctx.data.totalPaginas || 1,
          };
        }
      }
      return super.handle(ctx);
    }
  }

  /* ── 2. ErrorHandler ──
     Maneja errores de la respuesta HTTP. Si el status
     no es ok, extrae el detalle del error y lanza. */
  class ErrorHandler extends ChainHandler {
    constructor() {
      super("ErrorHandler");
    }

    async handle(ctx) {
      if (ctx.httpResponse && !ctx.httpResponse.ok) {
        const detalle = ctx.data?.detail || "Error en la solicitud";
        ctx.error = new Error(detalle);
        ctx.error.status = ctx.httpResponse.status;
        throw ctx.error;
      }
      return super.handle(ctx);
    }
  }

  /* ── 3. CacheHandler ──
     Almacena la respuesta en un caché por TTL (opcional).
     Solo cachea peticiones GET exitosas. */
  class CacheHandler extends ChainHandler {
    constructor() {
      super("CacheHandler");
      /** @type {Map<string, {data: any, ts: number}>} */
      this._cache = new Map();
      this._defaultTTL = 60000; // 1 minuto
    }

    async handle(ctx) {
      // Solo cachear GETs
      if (ctx.method === "GET" && ctx.cacheKey) {
        const cached = this._cache.get(ctx.cacheKey);
        if (cached && Date.now() - cached.ts < (ctx.cacheTTL || this._defaultTTL)) {
          ctx.data = cached.data;
          ctx.fromCache = true;
          return ctx;
        }
      }

      // Pasar al siguiente handler
      const result = await super.handle(ctx);

      // Guardar en caché si aplica
      if (ctx.method === "GET" && ctx.cacheKey && ctx.data) {
        this._cache.set(ctx.cacheKey, { data: ctx.data, ts: Date.now() });
      }

      return result;
    }

    limpiarCache() {
      this._cache.clear();
    }
  }

  /* ── Fábrica: construye la cadena ya enlazada ── */
  function crearCadenaResponse() {
    const error = new ErrorHandler();
    const normalize = new NormalizeHandler();
    const cache = new CacheHandler();

    error.setNext(normalize).setNext(cache);

    return { primerHandler: error, cacheHandler: cache };
  }

  return {
    NormalizeHandler,
    ErrorHandler,
    CacheHandler,
    crearCadenaResponse,
  };
})();
