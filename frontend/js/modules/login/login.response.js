/* ═══════════════════════════════════════════════════
   TaskFlow — modules/login/login.response.js
   Modelo de response normalizado para el módulo Login.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};
window.TF.modules.loginResponse = {
  /**
   * Estructura normalizada de la respuesta de login:
   * {
   *   tokenAcceso: string,
   *   usuario: {
   *     id: string,
   *     nombre: string,
   *     email: string,
   *     rol: "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER",
   *     avatarUri: string | null,
   *     descripcion: string | null,
   *     ultimoAcceso: string | null,
   *   }
   * }
   */
  ejemplo: {
    tokenAcceso: "",
    usuario: {
      id: "",
      nombre: "",
      email: "",
      rol: "DEVELOPER",
      avatarUri: null,
      descripcion: null,
      ultimoAcceso: null,
    },
  },
};
