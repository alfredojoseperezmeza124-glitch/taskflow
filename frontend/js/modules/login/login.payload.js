/* ═══════════════════════════════════════════════════
   TaskFlow — modules/login/login.payload.js
   Construye payloads para las peticiones del módulo Login.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.loginPayload = (function () {
  "use strict";

  /**
   * Construye el payload para iniciar sesión.
   * @param {string} email
   * @param {string} contrasena
   * @returns {Object} Payload para POST /usuarios/login
   */
  function crearPayloadLogin(email, contrasena) {
    return {
      email: email,
      contrasena: contrasena,
    };
  }

  /**
   * Construye el payload para registrar un usuario.
   * @param {Object} datos
   * @returns {Object} Payload para POST /usuarios/registro
   */
  function crearPayloadRegistro(datos) {
    return {
      nombre: datos.nombre,
      email: datos.email,
      contrasena: datos.contrasena,
      rol: datos.rol || "DEVELOPER",
    };
  }

  return {
    crearPayloadLogin,
    crearPayloadRegistro,
  };
})();
