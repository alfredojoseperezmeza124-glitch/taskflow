/* ═══════════════════════════════════════════════════
   TaskFlow — modules/registro/registro.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Registro.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.registroAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class RegistroAdapter extends AdapterBase {
    adapt(raw) {
      return window.TF.modules.registroResponse.crearUsuarioResponse(raw);
    }
  }

  return new RegistroAdapter();
})();
