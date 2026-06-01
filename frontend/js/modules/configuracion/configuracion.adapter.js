/* ═══════════════════════════════════════════════════
   TaskFlow — modules/configuracion/configuracion.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Configuración.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.configuracionAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class ConfiguracionAdapter extends AdapterBase {
    adapt(raw) {
      return window.TF.modules.configuracionResponse.crearConfigModel(raw);
    }
  }

  return new ConfiguracionAdapter();
})();
