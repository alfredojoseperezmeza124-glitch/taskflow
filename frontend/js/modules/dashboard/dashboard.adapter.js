/* ═══════════════════════════════════════════════════
   TaskFlow — modules/dashboard/dashboard.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Dashboard.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.dashboardAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class DashboardAdapter extends AdapterBase {
    adaptProyecto(raw) {
      return {
        id: raw.id || "",
        nombre: raw.nombre || "",
        descripcion: raw.descripcion || "",
        estado: raw.estado || "PLANIFICADO",
        progreso: Number(raw.progreso) || 0,
        fechaFinEstimada: raw.fechaFinEstimada || null,
      };
    }

    adaptTarea(raw) {
      return {
        id: raw.id || "",
        titulo: raw.titulo || "",
        tipo: raw.tipo || "TASK",
        prioridad: raw.prioridad || "MEDIA",
        columnaId: raw.columnaId || "",
        faseId: raw.faseId || "",
        etapaId: raw.etapaId || "",
        responsables: Array.isArray(raw.responsables) ? raw.responsables : [],
        estaVencida: raw.estaVencida || false,
        creadoEn: raw.creadoEn || null,
      };
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

  return new DashboardAdapter();
})();
