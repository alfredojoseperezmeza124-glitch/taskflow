/* ═══════════════════════════════════════════════════
   TaskFlow — modules/reportes/reportes.payload.js
   Construye payloads para las peticiones del módulo Reportes.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.reportesPayload = (function () {
  "use strict";

  return {
    exportarParams: function (tipo, formato) {
      return {
        tipo: tipo || "tareas",
        formato: formato || "json",
      };
    }
  };
})();
