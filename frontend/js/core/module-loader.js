/* ═══════════════════════════════════════════════════
   TaskFlow — core/module-loader.js
   Cargador dinámico de módulos.

   Reemplaza loader.js: en lugar de tener TODO el HTML
   hardcodeado en un JS, cada módulo tiene su archivo
   .html que se carga dinámicamente.

   Cada módulo se registra en TF.modules y se carga
   cuando su slot aparece en el DOM.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};
window.TF.modules = window.TF.modules || {};

window.TF.moduleLoader = (function () {
  "use strict";

  /** @type {Map<string, Object>} Registro de módulos */
  const _modulosRegistrados = new Map();

  /** @type {Map<string, string>} Caché de HTML cargado */
  const _cacheHtml = new Map();

  /** @type {Set<string>} CSS ya inyectados */
  const _cssInyectados = new Set();

  /**
   * Registra un módulo en el sistema.
   * @param {string} nombre — Nombre del módulo (ej: "proyectos")
   * @param {Object} modulo — Definición del módulo
   * @param {string} modulo.htmlPath — Ruta al archivo HTML del módulo
   * @param {string|null} modulo.cssPath — Ruta al CSS específico (opcional)
   * @param {Function} modulo.init — Función de inicialización
   * @param {Object} modulo.adapter — Instancia del adapter del módulo
   * @param {Object} modulo.payload — Instancia del payload builder
   */
  function registrar(nombre, modulo) {
    _modulosRegistrados.set(nombre, modulo);
    window.TF.modules[nombre] = modulo;
  }

  /**
   * Carga el HTML de un módulo y lo inyecta en su slot.
   * @param {string} nombre — Nombre del módulo
   * @returns {Promise<void>}
   */
  async function cargarModulo(nombre) {
    const modulo = _modulosRegistrados.get(nombre);
    if (!modulo) {
      console.warn(`[ModuleLoader] Módulo "${nombre}" no registrado`);
      return;
    }

    const slot = document.getElementById("slot-" + nombre);
    if (!slot) {
      return; // El slot no existe en el DOM
    }

    // Cargar HTML
    let html = _cacheHtml.get(nombre);
    if (!html && modulo.htmlPath) {
      try {
        const resp = await fetch(modulo.htmlPath);
        if (resp.ok) {
          html = await resp.text();
          _cacheHtml.set(nombre, html);
        }
      } catch (e) {
        console.error(`[ModuleLoader] Error cargando HTML de "${nombre}":`, e);
      }
    }

    if (html) {
      slot.innerHTML = html;
    }

    // Cargar CSS si aplica
    if (modulo.cssPath && !_cssInyectados.has(modulo.cssPath)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = modulo.cssPath;
      document.head.appendChild(link);
      _cssInyectados.add(modulo.cssPath);
    }

    // Inicializar módulo
    if (typeof modulo.init === "function") {
      try {
        await modulo.init();
      } catch (e) {
        console.error(`[ModuleLoader] Error inicializando "${nombre}":`, e);
      }
    }
  }

  /**
   * Carga todos los módulos registrados.
   * @returns {Promise<void>}
   */
  async function cargarTodos() {
    const promesas = [];
    for (const nombre of _modulosRegistrados.keys()) {
      promesas.push(cargarModulo(nombre));
    }
    await Promise.all(promesas);
  }

  /**
   * Obtiene un módulo registrado.
   * @param {string} nombre
   * @returns {Object|null}
   */
  function obtener(nombre) {
    return _modulosRegistrados.get(nombre) || null;
  }

  /**
   * Lista todos los módulos registrados.
   * @returns {string[]}
   */
  function listar() {
    return [..._modulosRegistrados.keys()];
  }

  return {
    registrar,
    cargarModulo,
    cargarTodos,
    obtener,
    listar,
  };
})();
