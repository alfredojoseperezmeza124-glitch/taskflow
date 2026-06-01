/* ═══════════════════════════════════════════════════
   TaskFlow — modules/historial/historial.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Historial.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.historialAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class HistorialAdapter extends AdapterBase {
    adapt(raw) {
      if (Array.isArray(raw)) {
        return raw.map(r => window.TF.modules.historialResponse.crearAuditoriaModel(r));
      }
      return window.TF.modules.historialResponse.crearAuditoriaModel(raw);
    }
  }

  return new HistorialAdapter();
})();
