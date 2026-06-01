/* ═══════════════════════════════════════════════════
   TaskFlow — modules/dashboard/dashboard.response.js
   Modelo de response normalizado para el módulo Dashboard.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.dashboardResponse = (function () {
  "use strict";

  // Documentación del modelo de respuesta de Dashboard
  return {
    crearDashboardData: function (data) {
      return {
        esGlobal: data.esGlobal || false,
        proyectoId: data.proyectoId || null,
        tareas: data.tareas || [],
        subtareasEtapa: data.subtareasEtapa || [],
        columnasPorId: data.columnasPorId || {},
        fasesPorId: data.fasesPorId || {},
        etapasPorId: data.etapasPorId || {},
        usuariosPorId: data.usuariosPorId || {},
        proyectosPorId: data.proyectosPorId || {},
      };
    }
  };
})();
