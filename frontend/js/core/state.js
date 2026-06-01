/* ═══════════════════════════════════════════════════
   TaskFlow — core/state.js
   Estado global centralizado de la aplicación.
   Patrón: Módulo IIFE con namespace TF.state
════════════════════════════════════════════════════ */

window.TF = window.TF || {};

window.TF.state = (function () {
  "use strict";

  /* ── Estado mutable ── */
  let _sesion = null;           // { token_acceso, usuario: {...} }
  let _proyActualId = null;
  let _colsActuales = [];
  let _miembrosActuales = [];
  const _cacheEstructuraProyecto = new Map();
  const MOBILE_SIDEBAR_BREAKPOINT = 900;

  /* ── Getters ── */
  function getSesion()          { return _sesion; }
  function getToken()           { return _sesion?.token_acceso || null; }
  function getUsuario()         { return _sesion?.usuario || null; }
  function getRol()             { return _sesion?.usuario?.rol || null; }
  function getProyActualId()    { return _proyActualId; }
  function getColsActuales()    { return _colsActuales; }
  function getMiembros()        { return _miembrosActuales; }
  function getMobileBP()        { return MOBILE_SIDEBAR_BREAKPOINT; }

  /* ── Setters ── */
  function setSesion(s) {
    _sesion = s;
    // Sincronizar con la variable global legacy
    window.S = s;
  }

  function setProyActualId(id) {
    _proyActualId = id;
    window.proyActualId = id;
  }

  function setColsActuales(cols) {
    _colsActuales = cols;
    window.colsActuales = cols;
  }

  function setMiembros(m) {
    _miembrosActuales = m;
    window.miembrosActuales = m;
  }

  /* ── Caché de estructura proyecto ── */
  function getCacheEstructura(proyId) {
    return _cacheEstructuraProyecto.get(proyId);
  }

  function setCacheEstructura(proyId, data) {
    _cacheEstructuraProyecto.set(proyId, data);
  }

  function invalidarCacheEstructura(proyId) {
    if (proyId) {
      _cacheEstructuraProyecto.delete(proyId);
    } else {
      _cacheEstructuraProyecto.clear();
    }
  }

  /* ── Persistencia ── */
  function guardarSesion() {
    if (_sesion) localStorage.setItem("tf_s", JSON.stringify(_sesion));
  }

  function restaurarSesion() {
    try {
      const saved = localStorage.getItem("tf_s");
      if (saved) {
        _sesion = JSON.parse(saved);
        window.S = _sesion;
        return true;
      }
    } catch {
      localStorage.removeItem("tf_s");
    }
    return false;
  }

  function limpiarSesion() {
    _sesion = null;
    _proyActualId = null;
    _colsActuales = [];
    _miembrosActuales = [];
    _cacheEstructuraProyecto.clear();
    window.S = null;
    window.proyActualId = null;
    window.colsActuales = [];
    window.miembrosActuales = [];
    localStorage.removeItem("tf_s");
  }

  /* ── Sincronizar con variables globales legacy ── */
  function sincronizarLegacy() {
    window.S = _sesion;
    window.proyActualId = _proyActualId;
    window.colsActuales = _colsActuales;
    window.miembrosActuales = _miembrosActuales;
  }

  return {
    getSesion,
    getToken,
    getUsuario,
    getRol,
    getProyActualId,
    getColsActuales,
    getMiembros,
    getMobileBP,
    setSesion,
    setProyActualId,
    setColsActuales,
    setMiembros,
    getCacheEstructura,
    setCacheEstructura,
    invalidarCacheEstructura,
    guardarSesion,
    restaurarSesion,
    limpiarSesion,
    sincronizarLegacy,
  };
})();
