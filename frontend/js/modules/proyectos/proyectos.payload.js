/* ═══════════════════════════════════════════════════
   TaskFlow — modules/proyectos/proyectos.payload.js
   Construye payloads para las peticiones del módulo Proyectos.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.proyectosPayload = (function () {
  "use strict";

  return {
    crearProyecto: function (data) {
      return {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        fechaInicio: data.fechaInicio,
        fechaFinEstimada: data.fechaFinEstimada,
      };
    },

    crearFase: function (data) {
      return {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
      };
    },

    crearEtapa: function (data) {
      return {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
      };
    },

    actualizarReglas: function (data) {
      return {
        reglasDecoradores: {
          auditoriaEnriquecidaActiva: !!data.auditoriaEnriquecidaActiva,
          notificacionAutomaticaActiva: !!data.notificacionAutomaticaActiva,
          validacionSlaActiva: !!data.validacionSlaActiva,
          maxHorasPorTarea: Number(data.maxHorasPorTarea) || 80,
          notificarBugUrgenteAlPm: !!data.notificarBugUrgenteAlPm,
          validarHorasAntesDeMoverEnProgreso: !!data.validarHorasAntesDeMoverEnProgreso,
        }
      };
    }
  };
})();
