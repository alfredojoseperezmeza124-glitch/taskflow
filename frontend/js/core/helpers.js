/* ═══════════════════════════════════════════════════
   TaskFlow — core/helpers.js
   Utilidades compartidas entre módulos.
   Extraídas de app.js para desacoplar.
════════════════════════════════════════════════════ */

window.TF = window.TF || {};

window.TF.helpers = (function () {
  "use strict";

  /* ── Toast ── */
  function toast(msg, tipo) {
    if (typeof window.toast === "function") {
      window.toast(msg, tipo);
    }
  }

  /* ── Modales ── */
  function abrirModal(id) {
    if (typeof window.abrirModal === "function") {
      window.abrirModal(id);
    }
  }

  function cerrarModal(id) {
    if (typeof window.cerrarModal === "function") {
      window.cerrarModal(id);
    }
  }

  /* ── Iniciales ── */
  function inic(n) {
    if (typeof window.inic === "function") return window.inic(n);
    return (
      (n || "")
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase() || "--"
    );
  }

  /* ── Fecha formateada ── */
  function fFecha(iso) {
    if (typeof window.fFecha === "function") return window.fFecha(iso);
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /* ── Badges ── */
  function badgeRol(r) {
    if (typeof window.badgeRol === "function") return window.badgeRol(r);
    const m = { ADMIN: "bi", PROJECT_MANAGER: "bb", DEVELOPER: "bg" };
    return `<span class="badge ${m[r] || "bm"}">${r}</span>`;
  }

  function badgePrio(p) {
    if (typeof window.badgePrio === "function") return window.badgePrio(p);
    const m = { BAJA: "bg", MEDIA: "ba", ALTA: "br", URGENTE: "br" };
    return `<span class="badge ${m[p] || "bm"}">${p}</span>`;
  }

  function badgeTipo(t) {
    if (typeof window.badgeTipo === "function") return window.badgeTipo(t);
    const m = { BUG: "br", FEATURE: "bb", TASK: "bm", IMPROVEMENT: "bg" };
    return `<span class="badge ${m[t] || "bm"}">${(t || "").toLowerCase()}</span>`;
  }

  function badgeEstado(e) {
    if (typeof window.badgeEstado === "function") return window.badgeEstado(e);
    const m = {
      PLANIFICADO: "bb",
      EN_PROGRESO: "ba",
      PAUSADO: "bm",
      COMPLETADO: "bg",
      ARCHIVADO: "bm",
    };
    return `<span class="badge ${m[e] || "bm"}">${e}</span>`;
  }

  function colPrio(p) {
    if (typeof window.colPrio === "function") return window.colPrio(p);
    const m = {
      BAJA: "p-baja",
      MEDIA: "p-media",
      ALTA: "p-alta",
      URGENTE: "p-urgente",
    };
    return m[p] || "p-baja";
  }

  /* ── Escape HTML ── */
  function escHtml(txt) {
    return String(txt || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  return {
    toast,
    abrirModal,
    cerrarModal,
    inic,
    fFecha,
    badgeRol,
    badgePrio,
    badgeTipo,
    badgeEstado,
    colPrio,
    escHtml,
  };
})();
