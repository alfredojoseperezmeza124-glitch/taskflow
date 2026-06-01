/* ═══════════════════════════════════════════════════
   TaskFlow — modules/tareas/tareas.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Tareas.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.tareasAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class TareasAdapter extends AdapterBase {
    adapt(raw) {
      if (Array.isArray(raw)) {
        return raw.map(t => this.adaptTarea(t));
      }
      return this.adaptTarea(raw);
    }

    adaptTarea(raw) {
      return window.TF.modules.tareasResponse.crearTareaModel(raw);
    }

    adaptSubtareaEtapa(raw) {
      return {
        id: raw.id || "",
        titulo: raw.titulo || "",
        completada: !!raw.completada,
        fechaVencimiento: raw.fechaVencimiento || null,
        responsables: Array.isArray(raw.responsables) ? raw.responsables : [],
        faseId: raw.faseId || "",
        etapaId: raw.etapaId || "",
        faseNombre: raw.faseNombre || "",
        etapaNombre: raw.etapaNombre || "",
        creadoEn: raw.creadoEn || null,
      };
    }
  }

  return new TareasAdapter();
})();
