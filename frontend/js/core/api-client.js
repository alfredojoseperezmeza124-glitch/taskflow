/* ═══════════════════════════════════════════════════
   TaskFlow — core/api-client.js
   Cliente HTTP central con Cadena de Responsabilidad.

   Integra las cadenas de request y response.
   Expone TF.apiClient.request() y la función global
   api() para retrocompatibilidad.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};

window.TF.apiClient = (function () {
  "use strict";

  const API_URL = window.API_URL || "http://localhost:8000/api/v1";
  const requestChain = window.TF.RequestChain.crearCadenaRequest();
  const { primerHandler: responseChain, cacheHandler } =
    window.TF.ResponseChain.crearCadenaResponse();

  /**
   * Realiza una petición HTTP pasando por las cadenas de responsabilidad.
   *
   * @param {string} method — GET, POST, PUT, DELETE
   * @param {string} ruta — Ruta relativa (ej: "/proyectos/")
   * @param {Object|null} body — Body de la petición
   * @param {Object} opciones — Opciones adicionales
   * @param {boolean} opciones.requiresAuth — Si requiere token (default true)
   * @param {string[]} opciones.validaciones — Campos obligatorios a validar
   * @param {string} opciones.cacheKey — Clave para cachear (solo GET)
   * @param {number} opciones.cacheTTL — TTL en ms para el caché
   * @returns {Promise<any>} Datos de la respuesta
   */
  async function request(method, ruta, body, opciones) {
    opciones = opciones || {};

    // 1. Construir contexto de request
    const ctx = {
      method: method,
      url: `${API_URL}${ruta}`,
      ruta: ruta,
      headers: { "Content-Type": "application/json" },
      body: body,
      requiresAuth: opciones.requiresAuth !== false,
      validaciones: opciones.validaciones || null,
      cacheKey: opciones.cacheKey || null,
      cacheTTL: opciones.cacheTTL || null,
    };

    // 2. Pasar por la cadena de REQUEST (auth → validation → log)
    await requestChain.handle(ctx);

    // 3. Ejecutar la petición HTTP real
    const httpResponse = await fetch(ctx.url, {
      method: ctx.method,
      headers: ctx.headers,
      body: ctx.body ? JSON.stringify(ctx.body) : null,
    });

    const data = await httpResponse.json();

    // 4. Construir contexto de response
    const responseCtx = {
      method: ctx.method,
      url: ctx.url,
      httpResponse: httpResponse,
      data: data,
      cacheKey: ctx.cacheKey,
      cacheTTL: ctx.cacheTTL,
    };

    // 5. Pasar por la cadena de RESPONSE (error → normalize → cache)
    await responseChain.handle(responseCtx);

    return responseCtx.data;
  }

  /**
   * Función legacy compatible con la api() original de app.js
   */
  function apiLegacy(met, ruta, body, token) {
    return request(met, ruta, body, {
      requiresAuth: token !== false,
    });
  }

  function limpiarCache() {
    cacheHandler.limpiarCache();
  }

  function getApiUrl() {
    return API_URL;
  }

  return {
    request,
    apiLegacy,
    limpiarCache,
    getApiUrl,
    API_URL,
  };
})();

/* ── Mantener la función global api() para retrocompatibilidad ── */
window.api = window.TF.apiClient.apiLegacy;

