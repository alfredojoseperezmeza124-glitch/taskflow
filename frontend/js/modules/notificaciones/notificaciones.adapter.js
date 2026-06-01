/* ═══════════════════════════════════════════════════
   TaskFlow — modules/notificaciones/notificaciones.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Notificaciones.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.notificacionesAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class NotificacionesAdapter extends AdapterBase {
    adapt(raw) {
      if (Array.isArray(raw)) {
        return raw.map(n => window.TF.modules.notificacionesResponse.crearNotificacionModel(n));
      }
      return window.TF.modules.notificacionesResponse.crearNotificacionModel(raw);
    }

    adaptPreferencias(raw) {
      return window.TF.modules.notificacionesResponse.crearPreferenciasModel(raw || {});
    }
  }

  return new NotificacionesAdapter();
})();
