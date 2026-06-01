/* ═══════════════════════════════════════════════════
   TaskFlow — modules/tareas/tareas.response.js
   Modelo de response normalizado para el módulo Tareas.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.tareasResponse = (function () {
  "use strict";

  return {
    crearTareaModel: function (raw) {
      return {
        id: raw.id || "",
        titulo: raw.titulo || "",
        descripcion: raw.descripcion || "",
        tipo: raw.tipo || "TASK",
        prioridad: raw.prioridad || "MEDIA",
        columnaId: raw.columnaId || "",
        proyectoId: raw.proyectoId || "",
        faseId: raw.faseId || "",
        etapaId: raw.etapaId || "",
        fechaVencimiento: raw.fechaVencimiento || null,
        responsables: Array.isArray(raw.responsables) ? raw.responsables : [],
        creadoEn: raw.creadoEn || null,
        estaVencida: !!raw.estaVencida,
        subtareas: Array.isArray(raw.subtareas) ? raw.subtareas : [],
      };
    }
  };
})();
