/* ═══════════════════════════════════════════════════
   TaskFlow — modules/registro/registro.response.js
   Modelo de response normalizado para el módulo Registro.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.registroResponse = (function () {
  "use strict";

  return {
    crearUsuarioResponse: function (raw) {
      return {
        id: raw.id || "",
        nombre: raw.nombre || "",
        email: raw.email || "",
        rol: raw.rol || "DEVELOPER",
        estaActivo: raw.estaActivo !== false,
      };
    }
  };
})();
