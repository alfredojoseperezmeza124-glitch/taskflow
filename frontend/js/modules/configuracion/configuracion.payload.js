/* ═══════════════════════════════════════════════════
   TaskFlow — modules/configuracion/configuracion.payload.js
   Construye payloads para las peticiones del módulo Configuración.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.configuracionPayload = (function () {
  "use strict";

  return {
    actualizarConfiguracion: function (data) {
      const cuerpo = {};
      if (data.nombrePlataforma !== undefined) cuerpo.nombrePlataforma = data.nombrePlataforma;
      if (data.zona_horaria !== undefined) cuerpo.zona_horaria = data.zona_horaria;
      if (data.tamanoMaxArchivoMb !== undefined) cuerpo.tamanoMaxArchivoMb = data.tamanoMaxArchivoMb;
      if (data.tema !== undefined) cuerpo.tema = data.tema;
      if (data.politicaContrasena !== undefined) {
        cuerpo.politicaContrasena = {
          longitudMinima: Number(data.politicaContrasena.longitudMinima) || 8,
          requiereMayusculas: !!data.politicaContrasena.requiereMayusculas,
          requiereNumeros: !!data.politicaContrasena.requiereNumeros,
          requiereSimbolos: !!data.politicaContrasena.requiereSimbolos,
          caducidadDias: Number(data.politicaContrasena.caducidadDias) || 0,
        };
      }
      return cuerpo;
    }
  };
})();
