/* ═══════════════════════════════════════════════════
   TaskFlow — modules/proyectos/proyectos.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Proyectos.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.proyectosAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class ProyectosAdapter extends AdapterBase {
    adapt(raw) {
      if (Array.isArray(raw)) {
        return raw.map(p => this.adaptProyecto(p));
      }
      return this.adaptProyecto(raw);
    }

    adaptProyecto(raw) {
      return window.TF.modules.proyectosResponse.crearProyectoModel(raw);
    }

    adaptNodoJerarquia(raw) {
      return {
        id: raw.id || "",
        titulo: raw.titulo || raw.nombre || "",
        categoria: raw.categoria || "NODO",
        progreso: Number(raw.progreso) || 0,
        horasEstimadas: Number(raw.horasEstimadas) || 0,
        responsables: Array.isArray(raw.responsables) ? raw.responsables : [],
        hijos: Array.isArray(raw.hijos) ? raw.hijos.map(h => this.adaptNodoJerarquia(h)) : [],
      };
    }
  }

  return new ProyectosAdapter();
})();
