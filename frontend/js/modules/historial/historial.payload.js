/* ═══════════════════════════════════════════════════
   TaskFlow — modules/historial/historial.payload.js
   Construye payloads para las peticiones del módulo Historial.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.historialPayload = (function () {
  "use strict";

  return {
    buscarParams: function (data) {
      return {
        texto: data.texto || "",
        prioridad: data.prioridad || "",
        tipo: data.tipo || "",
      };
    }
  };
})();
