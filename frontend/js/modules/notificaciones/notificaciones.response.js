/* ═══════════════════════════════════════════════════
   TaskFlow — modules/notificaciones/notificaciones.response.js
   Modelo de response normalizado para el módulo Notificaciones.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.modules.notificacionesResponse = (function () {
  "use strict";

  return {
    crearNotificacionModel: function (raw) {
      return {
        id: raw.id || "",
        usuarioId: raw.usuarioId || "",
        tipo: raw.tipo || "OTRO",
        mensaje: raw.mensaje || "",
        leida: !!raw.leida,
        creadoEn: raw.creadoEn || null,
        tareaId: raw.tareaId || null,
        tituloTarea: raw.tituloTarea || null,
      };
    },

    crearPreferenciasModel: function (raw) {
      return {
        notificacionAsignacion: raw.notificacionAsignacion !== false,
        notificacionVencimiento: raw.notificacionVencimiento !== false,
        notificacionComentario: raw.notificacionComentario !== false,
        notificacionCambioEstado: raw.notificacionCambioEstado !== false,
      };
    }
  };
})();
