/* ═══════════════════════════════════════════════════
   TaskFlow — modules/historial/historial.response.js
   Modelo de response normalizado para el módulo Historial.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.historialResponse = (function () {
  "use strict";

  return {
    crearAuditoriaModel: function (raw) {
      return {
        id: raw.id || "",
        proyectoId: raw.proyectoId || "",
        usuarioId: raw.usuarioId || "",
        accion: raw.accion || "—",
        tipoEntidad: raw.tipoEntidad || "—",
        marca: raw.marca || null,
        valorAnterior: raw.valorAnterior || null,
      };
    }
  };
})();
