/**
 * TaskFlow — AsistenteFlotante
 * Patrón Singleton: una sola instancia global del FAB del asistente.
 * Patrón Observer: escucha eventos del ciclo de vida de la sesión y
 *   del proyecto activo para actualizar su estado visual.
 *
 * Permite acceder al asistente IA desde cualquier pantalla del sistema.
 */
(function () {
  "use strict";

  /* ── Singleton guard ──────────────────────────────────────── */
  if (window._AsistenteFlotanteInit) return;
  window._AsistenteFlotanteInit = true;

  /* ── Estado interno ───────────────────────────────────────── */
  let _proyId = null;
  let _proyNombre = "";
  let _visible = false;
  let _notifPendiente = 0;

  /* ── Crear HTML del FAB ───────────────────────────────────── */
  function _crearFAB() {
    if (document.getElementById("tf-asistente-fab")) return;

    const fab = document.createElement("div");
    fab.id = "tf-asistente-fab";
    fab.setAttribute("role", "button");
    fab.setAttribute("aria-label", "Abrir asistente IA");
    fab.setAttribute("tabindex", "0");
    fab.innerHTML = `
      <div class="tf-fab-robot">
        <div class="tf-fab-antenna">
          <div class="tf-fab-antenna-ball"></div>
        </div>
        <div class="tf-fab-head">
          <div class="tf-fab-eyes">
            <div class="tf-fab-eye"><div class="tf-fab-pupil"></div></div>
            <div class="tf-fab-eye"><div class="tf-fab-pupil"></div></div>
          </div>
          <div class="tf-fab-mouth"></div>
        </div>
      </div>
      <div class="tf-fab-badge" id="tf-fab-badge" style="display:none">0</div>
      <div class="tf-fab-tooltip">
        <i class="ph ph-sparkle"></i>
        <span id="tf-fab-tooltip-txt">Asistente IA</span>
      </div>
    `;

    fab.addEventListener("click", _abrirAsistente);
    fab.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") _abrirAsistente();
    });

    document.body.appendChild(fab);
  }

  /* ── Abrir el asistente ───────────────────────────────────── */
  function _abrirAsistente() {
    if (typeof abrirAsistenteProyecto === "function") {
      // Sin proyecto activo → abrirAsistenteProyecto mostrará el selector
      abrirAsistenteProyecto(_proyId || null, _proyNombre || "");
    }
    _limpiarBadge();
  }

  /* ── Animación del FAB ────────────────────────────────────── */
  function _animarFAB(tipo) {
    const fab = document.getElementById("tf-asistente-fab");
    if (!fab) return;
    fab.classList.remove("tf-fab-anim-shake", "tf-fab-anim-bounce");
    void fab.offsetWidth; // reflow
    if (tipo === "shake") fab.classList.add("tf-fab-anim-shake");
    if (tipo === "bounce") fab.classList.add("tf-fab-anim-bounce");
    setTimeout(() => {
      fab.classList.remove("tf-fab-anim-shake", "tf-fab-anim-bounce");
    }, 600);
  }

  /* ── Badge de notificaciones pendientes ──────────────────── */
  function _limpiarBadge() {
    _notifPendiente = 0;
    const badge = document.getElementById("tf-fab-badge");
    if (badge) badge.style.display = "none";
  }

  function _incrementarBadge() {
    _notifPendiente++;
    const badge = document.getElementById("tf-fab-badge");
    if (badge) {
      badge.textContent = _notifPendiente > 9 ? "9+" : _notifPendiente;
      badge.style.display = "flex";
    }
    _animarFAB("bounce");
  }

  /* ── Visibilidad del FAB ─────────────────────────────────── */
  function _mostrar() {
    _visible = true;
    const fab = document.getElementById("tf-asistente-fab");
    if (fab) {
      fab.classList.add("tf-fab-visible");
      setTimeout(() => fab.classList.add("tf-fab-ready"), 50);
    }
  }

  function _ocultar() {
    _visible = false;
    const fab = document.getElementById("tf-asistente-fab");
    if (fab) {
      fab.classList.remove("tf-fab-visible", "tf-fab-ready");
    }
  }

  /* ── Actualizar proyecto activo ─────────────────────────── */
  function _actualizarProyecto(proyId, proyNombre) {
    _proyId = proyId || null;
    _proyNombre = proyNombre || "";
    const fab = document.getElementById("tf-asistente-fab");
    const tooltip = document.getElementById("tf-fab-tooltip-txt");
    if (!fab) return;

    if (_proyId) {
      fab.classList.add("tf-fab-con-proyecto");
      if (tooltip) tooltip.textContent = _proyNombre || "Asistente IA";
    } else {
      fab.classList.remove("tf-fab-con-proyecto");
      if (tooltip) tooltip.textContent = "Abre un proyecto";
    }
  }

  /* ── Observer: escuchar eventos globales de la app ────────── */
  function _registrarObservers() {
    // Sesión iniciada
    window.addEventListener("taskflow:sesion-iniciada", () => _mostrar());
    // Sesión cerrada
    window.addEventListener("taskflow:sesion-cerrada", () => {
      _ocultar();
      _actualizarProyecto(null, "");
    });
    // Proyecto cambiado
    window.addEventListener("taskflow:proyecto-activo", (e) => {
      const { id, nombre } = e.detail || {};
      _actualizarProyecto(id, nombre);
    });
    // Notificación nueva (para badge)
    window.addEventListener("taskflow:notificacion-nueva", () => {
      const modal = document.getElementById("mAsistenteProyecto");
      const abierto = modal && modal.classList.contains("open");
      if (!abierto) _incrementarBadge();
    });
  }

  /* ── Sincronizar con sesión existente (recarga de página) ──── */
  function _sincronizarEstadoInicial() {
    // Escuchar el evento de sesión restaurada desde localStorage
    document.addEventListener("taskflow:ready", () => {
      // Dar tiempo a que app.js procese el localStorage (es síncrono, pero el
      // evento se despacha en el mismo tick — usamos microtask para ir después)
      Promise.resolve().then(() => {
        if (window.S) {
          _mostrar();
          if (window.proyActualId) {
            _actualizarProyecto(window.proyActualId, "");
          }
        }
      });
    });

    // Fallback: polling breve por si el evento ya pasó (edge case)
    let intentos = 0;
    const poll = () => {
      if (_visible) return; // ya apareció
      if (window.S) { _mostrar(); return; }
      if (++intentos < 20) setTimeout(poll, 300); // max 6 s
    };
    setTimeout(poll, 500);
  }

  /* ── Init ────────────────────────────────────────────────── */
  function _init() {
    _crearFAB();
    _registrarObservers();
    _sincronizarEstadoInicial();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _init);
  } else {
    _init();
  }

  /* ── API pública ────────────────────────────────────────── */
  window.AsistenteFlotante = {
    mostrar: _mostrar,
    ocultar: _ocultar,
    actualizarProyecto: _actualizarProyecto,
    notificar: _incrementarBadge,
    animar: _animarFAB,
  };
})();
