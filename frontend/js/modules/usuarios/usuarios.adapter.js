/* ═══════════════════════════════════════════════════
   TaskFlow — modules/usuarios/usuarios.adapter.js
   PATRÓN ADAPTER — Normaliza las respuestas del backend
   para el módulo Usuarios.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.usuariosAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  class UsuariosAdapter extends AdapterBase {
    adapt(raw) {
      if (Array.isArray(raw)) {
        return raw.map(u => this.adaptUsuario(u));
      }
      return this.adaptUsuario(raw);
    }

    adaptUsuario(raw) {
      return window.TF.modules.usuariosResponse.crearUsuarioModel(raw);
    }
  }

  return new UsuariosAdapter();
})();
