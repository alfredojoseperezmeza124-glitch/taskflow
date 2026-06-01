/* ═══════════════════════════════════════════════════
   TaskFlow — modules/reportes/reportes.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Reportes.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.reportesAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class ReportesAdapter extends AdapterBase {
    adaptMetricas(raw) {
      return window.TF.modules.reportesResponse.crearMetricasModel(raw || {});
    }

    adaptAuditoria(raw) {
      if (Array.isArray(raw)) {
        return raw.map(r => window.TF.modules.reportesResponse.crearAuditoriaModel(r));
      }
      return window.TF.modules.reportesResponse.crearAuditoriaModel(raw);
    }
  }

  return new ReportesAdapter();
})();
