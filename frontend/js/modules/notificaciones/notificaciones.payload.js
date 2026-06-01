/* ═══════════════════════════════════════════════════
   TaskFlow — modules/notificaciones/notificaciones.payload.js
   Construye payloads para las peticiones del módulo Notificaciones.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.notificacionesPayload = (function () {
  "use strict";

  return {
    actualizarPreferencias: function (data) {
      return {
        notificacionAsignacion: !!data.notificacionAsignacion,
        notificacionVencimiento: !!data.notificacionVencimiento,
        notificacionComentario: !!data.notificacionComentario,
        notificacionCambioEstado: !!data.notificacionCambioEstado,
      };
    },

    enviarExterno: function (data) {
      const cuerpo = {
        canal: data.canal || "email",
        usuarioId: data.usuarioId,
        mensaje: data.mensaje,
        asunto: data.asunto || "Notificacion TaskFlow",
      };
      if (data.canal === "whatsapp" || data.canal === "sms") {
        cuerpo.contacto = data.contacto;
      }
      return cuerpo;
    }
  };
})();
