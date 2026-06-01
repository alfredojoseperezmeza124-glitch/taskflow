/* ═══════════════════════════════════════════════════
   TaskFlow — modules/tablero/tablero.payload.js
   Construye payloads para las peticiones del módulo Tablero.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.tableroPayload = (function () {
  "use strict";

  return {
    moverTarea: function (columnaDestinoId) {
      return {
        columnaIdDestino: columnaDestinoId,
      };
    },

    crearColumna: function (nombre) {
      return {
        nombre: nombre,
      };
    }
  };
})();
