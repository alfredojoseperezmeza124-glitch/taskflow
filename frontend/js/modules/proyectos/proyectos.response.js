/* ═══════════════════════════════════════════════════
   TaskFlow — modules/proyectos/proyectos.response.js
   Modelo de response normalizado para el módulo Proyectos.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.proyectosResponse = (function () {
  "use strict";

  return {
    crearProyectoModel: function (raw) {
      return {
        id: raw.id || "",
        nombre: raw.nombre || "",
        descripcion: raw.descripcion || "",
        fechaInicio: raw.fechaInicio || null,
        fechaFinEstimada: raw.fechaFinEstimada || null,
        estado: raw.estado || "PLANIFICADO",
        progreso: Number(raw.progreso) || 0,
        estaArchivado: !!raw.estaArchivado,
        reglasDecoradores: {
          auditoriaEnriquecidaActiva: raw.reglasDecoradores?.auditoriaEnriquecidaActiva !== false,
          notificacionAutomaticaActiva: raw.reglasDecoradores?.notificacionAutomaticaActiva !== false,
          validacionSlaActiva: raw.reglasDecoradores?.validacionSlaActiva !== false,
          maxHorasPorTarea: Number(raw.reglasDecoradores?.maxHorasPorTarea) || 80,
          notificarBugUrgenteAlPm: raw.reglasDecoradores?.notificarBugUrgenteAlPm !== false,
          validarHorasAntesDeMoverEnProgreso: raw.reglasDecoradores?.validarHorasAntesDeMoverEnProgreso !== false,
        }
      };
    }
  };
})();
