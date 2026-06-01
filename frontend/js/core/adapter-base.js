/* ═══════════════════════════════════════════════════
   TaskFlow — core/adapter-base.js
   PATRÓN ADAPTER — Clase base.

   Cada módulo extiende AdapterBase para normalizar
   las respuestas crudas de la API del backend a un
   formato estándar consumible por el frontend.

   Ejemplo de uso:
     class ProyectosAdapter extends TF.AdapterBase {
       adapt(raw) { return { id: raw.id, ... }; }
     }
════════════════════════════════════════════════════ */

window.TF = window.TF || {};

window.TF.AdapterBase = (function () {
  "use strict";

  /**
   * Clase base para todos los Adapters del frontend.
   *
   * Proporciona:
   * - adapt(raw)      → Debe ser sobreescrito. Normaliza UN objeto.
   * - adaptList(arr)   → Normaliza un array llamando adapt() en cada elemento.
   * - adaptPaginado(r) → Normaliza respuestas paginadas del backend.
   */
  class AdapterBase {
    /**
     * Normaliza una respuesta cruda individual.
     * @param {Object} rawResponse — Objeto crudo del backend.
     * @returns {Object} Objeto normalizado para el frontend.
     */
    adapt(rawResponse) {
      throw new Error(
        `[AdapterBase] El método adapt() debe ser implementado en ${this.constructor.name}`
      );
    }

    /**
     * Normaliza un array de respuestas.
     * @param {Array} rawArray — Array crudo del backend.
     * @returns {Array} Array de objetos normalizados.
     */
    adaptList(rawArray) {
      if (!Array.isArray(rawArray)) return [];
      return rawArray.map((item) => this.adapt(item));
    }

    /**
     * Normaliza una respuesta paginada del backend.
     * Soporta tanto arrays planos como { datos, pagina, totalPaginas }.
     * @param {Object|Array} rawResponse — Respuesta del backend.
     * @returns {{ datos: Array, pagina: number, totalPaginas: number }}
     */
    adaptPaginado(rawResponse) {
      if (Array.isArray(rawResponse)) {
        return {
          datos: this.adaptList(rawResponse),
          pagina: 1,
          totalPaginas: 1,
        };
      }
      return {
        datos: this.adaptList(rawResponse?.datos || []),
        pagina: rawResponse?.pagina || 1,
        totalPaginas: rawResponse?.totalPaginas || 1,
      };
    }
  }

  return AdapterBase;
})();
