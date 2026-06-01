/* ═══════════════════════════════════════════════════
   TaskFlow — modules/usuarios/usuarios.response.js
   Modelo de response normalizado para el módulo Usuarios.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.usuariosResponse = (function () {
  "use strict";

  return {
    crearUsuarioModel: function (raw) {
      return {
        id: raw.id || "",
        nombre: raw.nombre || "",
        email: raw.email || "",
        rol: raw.rol || "DEVELOPER",
        ultimoAcceso: raw.ultimoAcceso || null,
        estaActivo: raw.estaActivo !== false,
      };
    }
  };
})();
