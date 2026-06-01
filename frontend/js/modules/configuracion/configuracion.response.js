/* ═══════════════════════════════════════════════════
   TaskFlow — modules/configuracion/configuracion.response.js
   Modelo de response normalizado para el módulo Configuración.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.configuracionResponse = (function () {
  "use strict";

  return {
    crearConfigModel: function (raw) {
      return {
        nombrePlataforma: raw.nombrePlataforma || "TaskFlow",
        zona_horaria: raw.zona_horaria || "America/Bogota",
        tamanoMaxArchivoMb: Number(raw.tamanoMaxArchivoMb) || 10,
        tema: raw.tema || "oscuro",
        politicaContrasena: {
          longitudMinima: Number(raw.politicaContrasena?.longitudMinima) || 8,
          requiereMayusculas: raw.politicaContrasena?.requiereMayusculas !== false,
          requiereNumeros: raw.politicaContrasena?.requiereNumeros !== false,
          requiereSimbolos: !!raw.politicaContrasena?.requiereSimbolos,
          caducidadDias: Number(raw.politicaContrasena?.caducidadDias) || 0,
        }
      };
    }
  };
})();
