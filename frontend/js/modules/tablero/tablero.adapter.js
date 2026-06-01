/* ═══════════════════════════════════════════════════
   TaskFlow — modules/tablero/tablero.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Tablero.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.tableroAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class TableroAdapter extends AdapterBase {
    adapt(raw) {
      if (Array.isArray(raw)) {
        return raw.map(t => this.adaptTablero(t));
      }
      return this.adaptTablero(raw);
    }

    adaptTablero(raw) {
      return window.TF.modules.tableroResponse.crearTableroModel(raw);
    }

    adaptSubtareaEtapa(raw) {
      return {
        id: raw.id || "",
        titulo: raw.titulo || "",
        completada: !!raw.completada,
        faseId: raw.faseId || "",
        etapaId: raw.etapaId || "",
        faseNombre: raw.faseNombre || "",
        etapaNombre: raw.etapaNombre || "",
        responsables: Array.isArray(raw.responsables) ? raw.responsables : [],
      };
    }
  }

  return new TableroAdapter();
})();
