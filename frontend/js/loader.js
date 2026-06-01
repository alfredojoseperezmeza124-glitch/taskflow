/* ═══════════════════════════════════════════════════
   TaskFlow — loader.js
   Reemplazo modular. Carga todos los módulos registrados
   a través del cargador de módulos dinámicos y dispara
   el evento taskflow:ready al finalizar.
════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  console.log("[Loader] Iniciando carga modular de pantallas...");
  try {
    // Cargar todos los módulos registrados dinámicamente
    await window.TF.moduleLoader.cargarTodos();
    console.log("[Loader] Todas las pantallas se han cargado correctamente.");
  } catch (e) {
    console.error("[Loader] Error cargando pantallas modulares:", e);
  } finally {
    // Notificar al resto del sistema que la SPA está lista
    document.dispatchEvent(new Event("taskflow:ready"));
  }
});
