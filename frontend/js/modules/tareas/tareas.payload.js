/* ═══════════════════════════════════════════════════
   TaskFlow — modules/tareas/tareas.payload.js
   Construye payloads para las peticiones del módulo Tareas.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.tareasPayload = (function () {
  "use strict";

  return {
    crearTarea: function (data) {
      return {
        titulo: data.titulo,
        descripcion: data.descripcion || null,
        tipo: data.tipo || "TASK",
        prioridad: data.prioridad || "MEDIA",
        columnaId: data.columnaId,
        proyectoId: data.proyectoId,
        faseId: data.faseId || null,
        etapaId: data.etapaId || null,
        fechaVencimiento: data.fechaVencimiento || null,
        responsables: Array.isArray(data.responsables) ? data.responsables : [],
        etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas : [],
      };
    },

    actualizarTarea: function (data) {
      return {
        titulo: data.titulo,
        descripcion: data.descripcion || null,
        tipo: data.tipo || "TASK",
        prioridad: data.prioridad || "MEDIA",
        fechaVencimiento: data.fechaVencimiento || null,
        faseId: data.faseId || null,
        etapaId: data.etapaId || null,
        responsables: Array.isArray(data.responsables) ? data.responsables : [],
      };
    }
  };
})();
