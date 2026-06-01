/* ═══════════════════════════════════════════════════
   TaskFlow — modules/perfil/perfil.payload.js
   Construye payloads para las peticiones del módulo Perfil.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.perfilPayload = (function () {
  "use strict";

  return {
    actualizarPerfil: function (data) {
      return {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        avatarUri: data.avatarUri || null,
      };
    }
  };
})();
