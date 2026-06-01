/* ═══════════════════════════════════════════════════
   TaskFlow — modules/reportes/reportes.response.js
   Modelo de response normalizado para el módulo Reportes.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.reportesResponse = (function () {
  "use strict";

  return {
    crearMetricasModel: function (raw) {
      return {
        totalTareas: Number(raw.totalTareas) || 0,
        tareasCompletadas: Number(raw.tareasCompletadas) || 0,
        tareasVencidas: Number(raw.tareasVencidas) || 0,
        progreso: Number(raw.progreso) || 0,
        tareasPorEstado: raw.tareasPorEstado || {},
        tareasPorPrioridad: raw.tareasPorPrioridad || {},
        tareasPorUsuario: raw.tareasPorUsuario || {},
      };
    },

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
