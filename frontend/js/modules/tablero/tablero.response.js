/* ═══════════════════════════════════════════════════
   TaskFlow — modules/tablero/tablero.response.js
   Modelo de response normalizado para el módulo Tablero.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.tableroResponse = (function () {
  "use strict";

  return {
    crearTableroModel: function (raw) {
      return {
        id: raw.id || "",
        nombre: raw.nombre || "",
        proyectoId: raw.proyectoId || "",
        columnas: Array.isArray(raw.columnas) ? raw.columnas.map(col => this.crearColumnaModel(col)) : [],
      };
    },

    crearColumnaModel: function (raw) {
      return {
        id: raw.id || "",
        nombre: raw.nombre || "",
        limiteWip: raw.limiteWip || null,
        tareas: Array.isArray(raw.tareas) ? raw.tareas : [],
      };
    }
  };
})();
