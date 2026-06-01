/* ═══════════════════════════════════════════════════
   TaskFlow — core/chain-handler.js
   PATRÓN CADENA DE RESPONSABILIDAD — Clase base.

   Cada handler procesa un contexto y decide si pasa
   la responsabilidad al siguiente handler de la cadena.

   Ejemplo:
     const auth = new AuthHandler();
     const log  = new LogHandler();
     auth.setNext(log);
     await auth.handle(ctx);
════════════════════════════════════════════════════ */

window.TF = window.TF || {};

window.TF.ChainHandler = (function () {
  "use strict";

  /**
   * Clase base para la Cadena de Responsabilidad.
   *
   * Cada handler concreto:
   * 1. Sobreescribe handle(context)
   * 2. Procesa su lógica
   * 3. Llama super.handle(context) para pasar al siguiente
   */
  class ChainHandler {
    constructor(nombre) {
      /** @type {ChainHandler|null} */
      this._next = null;
      /** @type {string} Nombre descriptivo del handler */
      this.nombre = nombre || this.constructor.name;
    }

    /**
     * Encadena el siguiente handler.
     * @param {ChainHandler} handler — Siguiente handler en la cadena.
     * @returns {ChainHandler} El handler pasado (permite encadenar: a.setNext(b).setNext(c))
     */
    setNext(handler) {
      this._next = handler;
      return handler;
    }

    /**
     * Procesa el contexto. Si hay siguiente handler, le delega.
     * @param {Object} context — Objeto mutable que viaja por la cadena.
     * @returns {Promise<Object>} El contexto procesado.
     */
    async handle(context) {
      if (this._next) {
        return this._next.handle(context);
      }
      return context;
    }
  }

  return ChainHandler;
})();
