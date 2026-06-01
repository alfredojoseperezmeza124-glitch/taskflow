/* ═══════════════════════════════════════════════════
   TaskFlow — modules/perfil/perfil.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Perfil.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.perfilAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class PerfilAdapter extends AdapterBase {
    adapt(raw) {
      return window.TF.modules.perfilResponse.crearPerfilModel(raw);
    }
  }

  return new PerfilAdapter();
})();
