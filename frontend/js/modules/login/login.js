/* ═══════════════════════════════════════════════════
   TaskFlow — modules/login/login.js
   Módulo de Login — Lógica del formulario de inicio
   de sesión. Usa LoginAdapter para normalizar la
   respuesta y LoginPayload para construir el request.

   Registro del módulo en TF.moduleLoader.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.loginAdapter;
  const payload = window.TF.modules.loginPayload;
  const state = window.TF.state;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("login", {
    name: "login",
    htmlPath: "js/modules/login/login.html",
    cssPath: null,
    adapter: adapter,
    payload: payload,
    init: function () {
      // La inicialización del login se maneja desde app.js
    },
  });
})();
