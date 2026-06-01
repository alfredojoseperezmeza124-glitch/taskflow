/* ═══════════════════════════════════════════════════
   TaskFlow — modules/dashboard/dashboard.payload.js
   Construye payloads para las peticiones del módulo Dashboard.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.dashboardPayload = (function () {
  "use strict";

  return {
    // El dashboard es principalmente de lectura, pero definimos la estructura por consistencia
    filtros: function (params) {
      return {
        faseId: params.faseId || "",
        etapaId: params.etapaId || "",
        prioridad: params.prioridad || "",
        tipo: params.tipo || "",
        responsableId: params.responsableId || "",
        contexto: params.contexto || "todos",
        semanas: Number(params.semanas) || 8,
        incluyeSubEtapa: params.incluyeSubEtapa !== false,
      };
    }
  };
})();
