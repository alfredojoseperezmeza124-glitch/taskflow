/* ═══════════════════════════════════════════════════
   TaskFlow — modules/login/login.adapter.js
   PATRÓN ADAPTER — Normaliza respuestas del backend
   para el módulo de autenticación (Login).
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.loginAdapter = (function () {
  "use strict";

  const AdapterBase = window.TF.AdapterBase;

  /**
   * LoginAdapter
   * Normaliza la respuesta de POST /usuarios/login
   * y GET /notificaciones/ para el flujo de login.
   */
  class LoginAdapter extends AdapterBase {
    /**
     * Normaliza la respuesta del login.
     * El backend retorna: { token_acceso, usuario: {...} }
     * @param {Object} raw — Respuesta cruda del backend
     * @returns {Object} Sesión normalizada
     */
    adapt(raw) {
      return {
        tokenAcceso: raw.token_acceso || null,
        token_acceso: raw.token_acceso || null, // legacy compat
        usuario: this.adaptUsuario(raw.usuario || {}),
      };
    }

    /**
     * Normaliza los datos del usuario.
     * @param {Object} raw — Objeto usuario crudo
     * @returns {Object} Usuario normalizado
     */
    adaptUsuario(raw) {
      return {
        id: raw.id || "",
        nombre: raw.nombre || "",
        email: raw.email || "",
        rol: raw.rol || "DEVELOPER",
        avatarUri: raw.avatarUri || null,
        descripcion: raw.descripcion || null,
        ultimoAcceso: raw.ultimoAcceso || null,
        estaActivo: raw.estaActivo !== false,
      };
    }

    /**
     * Normaliza la lista de notificaciones para el badge post-login.
     * @param {Array} rawNotificaciones — Array de notificaciones crudas
     * @returns {{ total: number, noLeidas: number }}
     */
    adaptNotificaciones(rawNotificaciones) {
      const lista = Array.isArray(rawNotificaciones) ? rawNotificaciones : [];
      return {
        total: lista.length,
        noLeidas: lista.filter((n) => !n.leida).length,
      };
    }
  }

  return new LoginAdapter();
})();
