/* ═══════════════════════════════════════════════════
   TaskFlow — modules/perfil/perfil.response.js
   Modelo de response normalizado para el módulo Perfil.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.perfilResponse = (function () {
  "use strict";

  return {
    crearPerfilModel: function (raw) {
      return {
        id: raw.id || "",
        nombre: raw.nombre || "",
        email: raw.email || "",
        rol: raw.rol || "DEVELOPER",
        avatarUri: raw.avatarUri || null,
        descripcion: raw.descripcion || null,
        ultimoAcceso: raw.ultimoAcceso || null,
        fechaRegistro: raw.fechaRegistro || raw.creadoEn || null,
      };
    }
  };
})();
