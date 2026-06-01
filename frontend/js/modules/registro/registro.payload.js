/* ═══════════════════════════════════════════════════
   TaskFlow — modules/registro/registro.payload.js
   Construye payloads para las peticiones del módulo Registro.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.registroPayload = (function () {
  "use strict";

  return {
    crearUsuario: function (data) {
      return {
        nombre: data.nombre,
        email: data.email,
        contrasena: data.contrasena,
        rol: data.rol || "DEVELOPER",
      };
    }
  };
})();
