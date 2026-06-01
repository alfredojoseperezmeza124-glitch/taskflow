/* ═══════════════════════════════════════════════════
   TaskFlow — app.js
   Inicialización principal, gestión de tema, sidebar,
   tabla-cards y navegación delegada en módulos.
════════════════════════════════════════════════════ */

"use strict";

// Variables globales para retrocompatibilidad
let S = null;
let proyActualId = null;
let colsActuales = [];
let miembrosActuales = [];

const MOBILE_SIDEBAR_BREAKPOINT = 900;
let _obsTablasTarjeta = null;
let _rafTablasTarjeta = null;

/* ── Sincronizar estado global con TF.state ── */
function sincronizarConEstado() {
  const state = window.TF.state;
  S = state.getSesion();
  proyActualId = state.getProyActualId();
  colsActuales = state.getColsActuales();
  miembrosActuales = state.getMiembros();
}

/* ── TOAST ── */
function toast(msg, tipo = "ok") {
  const w = document.getElementById("toastWrap");
  if (!w) return;
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ── MODALES ── */
function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
}

function cerrarModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

function toggleVerPass() {
  const campo = document.getElementById("lPass");
  const btn = document.getElementById("btnVerPass");
  if (!campo) return;
  if (campo.type === "password") {
    campo.type = "text";
    if (btn) {
      btn.innerHTML = '<i class="ph ph-eye-slash" style="font-size:16px"></i>';
    }
  } else {
    campo.type = "password";
    if (btn) {
      btn.innerHTML = '<i class="ph ph-eye" style="font-size:16px"></i>';
    }
  }
}

/* ── TEMA ── */
function aplicarTema(tema) {
  document.documentElement.setAttribute("data-tema", tema);
  localStorage.setItem("tf_tema", tema);
  const btn = document.getElementById("btnTema");
  if (btn) {
    btn.innerHTML =
      tema === "claro"
        ? '<i class="ph ph-moon"></i>'
        : '<i class="ph ph-sun"></i>';
  }
}

function toggleTema() {
  const actual = document.documentElement.getAttribute("data-tema") || "oscuro";
  aplicarTema(actual === "oscuro" ? "claro" : "oscuro");
}

/* ── SIDEBAR ── */
function _esSidebarMovil() {
  return window.matchMedia(`(max-width: ${MOBILE_SIDEBAR_BREAKPOINT}px)`).matches;
}

function _cerrarSidebarMovil() {
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.remove("mobile-sidebar-open");
}

function _aplicarSidebarColapsado(colapsado) {
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.toggle("sidebar-collapsed", !!colapsado);
  localStorage.setItem("tf_sidebar_collapsed", colapsado ? "1" : "0");
}

function toggleSidebar() {
  const app = document.getElementById("app");
  if (!app || app.classList.contains("sin-sidebar")) return;
  if (_esSidebarMovil()) {
    app.classList.toggle("mobile-sidebar-open");
    return;
  }
  _aplicarSidebarColapsado(!app.classList.contains("sidebar-collapsed"));
}

function _restaurarEstadoSidebar() {
  const app = document.getElementById("app");
  if (!app || app.classList.contains("sin-sidebar")) return;
  if (_esSidebarMovil()) {
    app.classList.remove("sidebar-collapsed");
    return;
  }
  _cerrarSidebarMovil();
  const guardado = localStorage.getItem("tf_sidebar_collapsed") === "1";
  _aplicarSidebarColapsado(guardado);
}

/* ── TABLAS EN TARJETAS (RESPONSIVE) ── */
function _aplicarTablasComoTarjetas() {
  document.querySelectorAll(".tabla-wrap table").forEach((tabla) => {
    tabla.classList.add("tabla-cards");
    const encabezados = Array.from(tabla.querySelectorAll("thead th")).map((th) =>
      th.textContent.trim(),
    );

    tabla.querySelectorAll("tbody tr").forEach((fila) => {
      const celdas = Array.from(fila.children).filter(
        (n) => n.tagName === "TD",
      );
      const esFilaInformativa =
        celdas.length === 1 && Number(celdas[0].getAttribute("colspan") || 1) > 1;
      fila.classList.toggle("tabla-row-empty", esFilaInformativa);

      celdas.forEach((celda, idx) => {
        const etiqueta = esFilaInformativa ? "" : encabezados[idx] || "";
        if (etiqueta) {
          celda.setAttribute("data-label", etiqueta);
        } else {
          celda.removeAttribute("data-label");
        }
        const esAcciones = etiqueta.toLowerCase().includes("accion");
        celda.classList.toggle("td-acciones", esAcciones);
      });
    });
  });
}

function _programarTablasComoTarjetas() {
  if (_rafTablasTarjeta) return;
  _rafTablasTarjeta = requestAnimationFrame(() => {
    _rafTablasTarjeta = null;
    _aplicarTablasComoTarjetas();
  });
}

function _iniciarObserverTablasTarjeta() {
  if (_obsTablasTarjeta) return;
  const contenido = document.getElementById("contenido");
  if (!contenido) return;
  _obsTablasTarjeta = new MutationObserver(() => {
    _programarTablasComoTarjetas();
  });
  _obsTablasTarjeta.observe(contenido, {
    childList: true,
    subtree: true,
  });
  _programarTablasComoTarjetas();
}

/* ── NAVEGACIÓN ── */
function mostrarPantalla(nombre) {
  document
    .querySelectorAll(".pantalla")
    .forEach((p) => p.classList.remove("activa"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("activo"));
  
  const targetSlot = document.getElementById(`slot-${nombre}`);
  if (targetSlot) {
    const p = targetSlot.querySelector(".pantalla");
    if (p) p.classList.add("activa");
  }

  document.querySelector(`[data-p="${nombre}"]`)?.classList.add("activo");
  const bc = document.getElementById("topBreadcrumb");
  const etiquetas = {
    dashboard: "Dashboard",
    proyectos: "Proyectos",
    tablero: "Tablero Kanban",
    tareas: "Tareas",
    usuarios: "Usuarios",
    reportes: "Reportes",
    historial: "Historial",
    notificaciones: "Notificaciones",
    perfil: "Mi Perfil",
    registro: "Crear Usuario",
    configuracion: "Configuración",
  };
  if (bc) bc.textContent = etiquetas[nombre] || "";
  _cerrarSidebarMovil();
  _programarTablasComoTarjetas();

  // Llamar al init() o cargador del módulo correspondiente
  const modulo = window.TF.moduleLoader.obtener(nombre);
  if (modulo && typeof modulo.init === "function") {
    modulo.init();
  } else {
    // Si no está registrado en el moduleLoader, verificar funciones globales legacy
    const acc = {
      tablero: async () => {
        if (window.cargarSelectores) await window.cargarSelectores();
        if (window._inicializarTablero) window._inicializarTablero();
      },
      tareas: async () => {
        if (window.cargarSelectores) await window.cargarSelectores();
        if (window._inicializarTareas) window._inicializarTareas();
      },
    };
    acc[nombre]?.();
  }
}

/* ── UI TRAS LOGIN ── */
function actualizarUI() {
  sincronizarConEstado();
  if (!S) return;
  const rol = S.usuario.rol;
  const u = S.usuario;

  ["sidebar", "topSep", "topBreadcrumb", "topUsuario", "btnSalir"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "";
    },
  );

  const topAv = document.getElementById("topAvatar");
  if (topAv) {
    if (u.avatarUri) {
      topAv.innerHTML = `<img src="${u.avatarUri}" style="width:22px;height:22px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'">`;
    } else {
      topAv.textContent = inic(u.nombre);
    }
  }

  const topNombre = document.getElementById("topNombre");
  if (topNombre) topNombre.textContent = u.nombre;

  const topRol = document.getElementById("topRolBadge");
  if (topRol) topRol.textContent = rol;

  const navUs = document.getElementById("navUsuarios");
  if (navUs) navUs.style.display = rol === "ADMIN" ? "" : "none";

  const navReg = document.getElementById("navRegistrar");
  if (navReg) navReg.style.display = rol === "ADMIN" ? "" : "none";

  const navNot = document.getElementById("navNotificaciones");
  if (navNot) navNot.style.display = "";

  const btnNot = document.getElementById("btnNotif");
  if (btnNot) btnNot.style.display = "";

  const btnSidebar = document.getElementById("btnSidebarToggle");
  if (btnSidebar) btnSidebar.style.display = "";

  const app = document.getElementById("app");
  if (app) {
    app.classList.remove("sin-sidebar");
    _restaurarEstadoSidebar();
  }
}

/* ── HELPERS LEGACY COMPAT ── */
function inic(n = "") {
  return (
    n
      .split(" ")
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "--"
  );
}

function fFecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function badgeRol(r) {
  const m = { ADMIN: "bi", PROJECT_MANAGER: "bb", DEVELOPER: "bg" };
  return `<span class="badge ${m[r] || "bm"}">${r}</span>`;
}
function badgePrio(p) {
  const m = { BAJA: "bg", MEDIA: "ba", ALTA: "br", URGENTE: "br" };
  return `<span class="badge ${m[p] || "bm"}">${p}</span>`;
}
function badgeTipo(t) {
  const m = { BUG: "br", FEATURE: "bb", TASK: "bm", IMPROVEMENT: "bg" };
  return `<span class="badge ${m[t] || "bm"}">${t.toLowerCase()}</span>`;
}
function badgeEstado(e) {
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
  const m = {
    BAJA: "p-baja",
    MEDIA: "p-media",
    ALTA: "p-alta",
    URGENTE: "p-urgente",
  };
  return m[p] || "p-baja";
}

/* ── CACHE ESTRUCTURA PROYECTO ── */
async function cargarEstructuraProyecto(proyectoId, forzar = false) {
  if (!proyectoId) {
    return { fases: [], fasesPorId: {}, etapasPorFase: {}, etapasPorId: {} };
  }
  const state = window.TF.state;
  if (!forzar && state.getCacheEstructura(proyectoId)) {
    return state.getCacheEstructura(proyectoId);
  }

  const [fases, jerarquia] = await Promise.all([
    api("GET", `/proyectos/${proyectoId}/fases`),
    api("GET", `/proyectos/${proyectoId}/jerarquia`),
  ]);
  const fasesLista = Array.isArray(fases) ? fases : [];

  const fasesPorId = {};
  const etapasPorFase = {};
  const etapasPorId = {};

  fasesLista.forEach((fase) => {
    fasesPorId[fase.id] = fase;
    if (!etapasPorFase[fase.id]) etapasPorFase[fase.id] = [];
  });

  const fasesJerarquia = Array.isArray(jerarquia?.hijos) ? jerarquia.hijos : [];
  fasesJerarquia.forEach((nodoFase) => {
    const faseId = nodoFase?.id;
    if (!faseId) return;
    if (!etapasPorFase[faseId]) etapasPorFase[faseId] = [];
    const etapas = Array.isArray(nodoFase?.hijos) ? nodoFase.hijos : [];
    etapas.forEach((nodoEtapa) => {
      if (!nodoEtapa?.id) return;
      const etapa = {
        id: nodoEtapa.id,
        nombre: nodoEtapa.titulo || nodoEtapa.nombre || "Etapa",
        faseId,
      };
      etapasPorFase[faseId].push(etapa);
      etapasPorId[etapa.id] = etapa;
    });
  });

  const estructura = { fases: fasesLista, fasesPorId, etapasPorFase, etapasPorId };
  state.setCacheEstructura(proyectoId, estructura);
  return estructura;
}

function invalidarCacheEstructuraProyecto(proyectoId = null) {
  window.TF.state.invalidarCacheEstructura(proyectoId);
}

function resolverContextoEstructura(estructura, faseId, etapaId) {
  const etapa = etapaId ? estructura?.etapasPorId?.[etapaId] || null : null;
  const fase =
    (faseId ? estructura?.fasesPorId?.[faseId] || null : null) ||
    (etapa?.faseId ? estructura?.fasesPorId?.[etapa.faseId] || null : null);
  return { fase, etapa };
}

/* ── AUTENTICACIÓN ── */
async function iniciarSesion() {
  const btn = document.getElementById("btnLogin");
  const errEl = document.getElementById("lError");
  if (errEl) errEl.textContent = "";
  
  const email = document.getElementById("lEmail")?.value?.trim();
  const pass = document.getElementById("lPass")?.value;
  if (!email || !pass) {
    if (errEl) errEl.textContent = "Completa todos los campos";
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando...';
  try {
    const rawS = await api(
      "POST",
      "/usuarios/login",
      { email, contrasena: pass },
      false,
    );
    
    // Aplicar adapter
    const adapter = window.TF.modules.loginAdapter;
    S = adapter ? adapter.adapt(rawS) : rawS;
    
    // Guardar en el estado central
    window.TF.state.setSesion(S);
    window.TF.state.guardarSesion();
    
    const overlay = document.getElementById("loginOverlay");
    if (overlay) overlay.classList.add("oculto");
    
    actualizarUI();
    mostrarPantalla("dashboard");

    // ── Conectar SSE de notificaciones en tiempo real ──
    if (typeof window._conectarStreamSSE === "function") {
      setTimeout(() => window._conectarStreamSSE(), 800);
    }

    try {
      const ns = await api("GET", "/notificaciones/");
      const adaptado = adapter ? adapter.adaptNotificaciones(ns) : null;
      const noLeidas = adaptado ? adaptado.noLeidas : ns.filter((n) => !n.leida).length;
      actualizarBadgeNotif(noLeidas);
      setTimeout(() => {
        if (noLeidas > 0) {
          toast(
            `Hola ${S.usuario.nombre} — tienes ${noLeidas} notificación${noLeidas > 1 ? "es" : ""} sin leer`,
          );
        } else {
          toast(`Bienvenido, ${S.usuario.nombre}`);
        }
      }, 400);
    } catch {
      toast(`Bienvenido, ${S.usuario.nombre}`);
    }
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Iniciar sesión";
  }
}

function cerrarSesion() {
  if (typeof window._desconectarStreamSSE === "function") {
    window._desconectarStreamSSE();
  }

  window.TF.state.limpiarSesion();
  sincronizarConEstado();

  if (typeof _cacheUsuarios !== "undefined") _cacheUsuarios = null;

  [
    "sidebar",
    "topSep",
    "topBreadcrumb",
    "btnNotif",
    "topUsuario",
    "btnSalir",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  
  const app = document.getElementById("app");
  if (app) {
    app.classList.add("sin-sidebar");
    app.classList.remove("sidebar-collapsed");
    app.classList.remove("mobile-sidebar-open");
  }

  const btnSidebar = document.getElementById("btnSidebarToggle");
  if (btnSidebar) btnSidebar.style.display = "none";
  
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("activo"));

  const overlay = document.getElementById("loginOverlay");
  if (overlay) {
    overlay.classList.remove("oculto");
    const lEmail = document.getElementById("lEmail");
    const lPass = document.getElementById("lPass");
    const lError = document.getElementById("lError");
    if (lEmail) lEmail.value = "";
    if (lPass) lPass.value = "";
    if (lError) lError.textContent = "";
  }
  toast("Sesión cerrada");
}

/* ── NOTIF BADGE ── */
function actualizarBadgeNotif(n) {
  const b = document.getElementById("badgeNotif");
  if (!b) return;
  b.style.display = n > 0 ? "" : "none";
  b.textContent = n;
}

function _inicializarTablero() {
  const sel = document.getElementById("selPT");
  if (!sel) return;
  if (sel.value) {
    window.TF.state.setProyActualId(sel.value);
    sincronizarConEstado();
    if (window.cargarTablero) window.cargarTablero(proyActualId);
  } else {
    window.TF.state.setProyActualId(null);
    window.TF.state.setColsActuales([]);
    sincronizarConEstado();
    const board = document.getElementById("kanbanBoard");
    if (board) {
      board.innerHTML =
        '<div class="vacío" style="width:100%">Selecciona un proyecto para ver el tablero</div>';
    }
    const bc = document.getElementById("tBreadcrumb");
    if (bc) bc.textContent = "";
  }
}

function _inicializarTareas() {
  const sel = document.getElementById("selTareasProy");
  if (!sel) return;
  if (proyActualId && [...sel.options].some((o) => o.value === proyActualId)) {
    sel.value = proyActualId;
    if (window.cargarTareasPaginadas) window.cargarTareasPaginadas(proyActualId, 1);
  } else if (sel.value) {
    if (window.cargarTareasPaginadas) window.cargarTareasPaginadas(sel.value, 1);
  } else if (sel.options.length > 1) {
    sel.selectedIndex = 1;
    if (window.cargarTareasPaginadas) window.cargarTareasPaginadas(sel.value, 1);
  } else {
    const tb = document.getElementById("tbTareas");
    if (tb) {
      tb.innerHTML =
        '<tr><td colspan="7" class="vacío">Selecciona un proyecto para ver las tareas</td></tr>';
    }
  }
}

/* ── LOGIN STATS DINÁMICO ── */
async function actualizarStatsLogin() {
  const el = document.getElementById("loginPatronesCount");
  if (!el) return;
  try {
    const r = await fetch(`${window.TF.apiClient.API_URL}/openapi.json`, { method: "GET" });
    if (!r.ok) throw new Error("No se pudo leer OpenAPI");
    const schema = await r.json();
    const descripcion = schema?.info?.description || "";
    const filasPatrones =
      descripcion.match(/\|\s+\*\*[^|]+\*\*\s+\|\s+`patterns\//g) || [];
    const total = filasPatrones.length;
    el.textContent = total > 0 ? String(total) : "—";
  } catch (_) {
    el.textContent = "—";
  }
}

/* ── INIT ── */
(function init() {
  document.addEventListener("taskflow:ready", () => {
    // Restaurar tema guardado
    const temaGuardado = localStorage.getItem("tf_tema") || "oscuro";
    aplicarTema(temaGuardado);

    // Event listeners para overlays de modales
    document.querySelectorAll(".overlay").forEach((o) =>
      o.addEventListener("click", (e) => {
        if (e.target === o) o.classList.remove("open");
      }),
    );

    const app = document.getElementById("app");
    if (app) app.classList.add("sin-sidebar");

    // Intentar restaurar sesión activa
    if (window.TF.state.restaurarSesion()) {
      sincronizarConEstado();
      const overlay = document.getElementById("loginOverlay");
      if (overlay) overlay.classList.add("oculto");
      actualizarUI();
      mostrarPantalla("dashboard");

      // Reconectar SSE al recargar página con sesión activa
      setTimeout(() => {
        if (typeof window._conectarStreamSSE === "function") {
          window._conectarStreamSSE();
        }
      }, 1000);
    }

    document.getElementById("lPass")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") iniciarSesion();
    });
    
    document.getElementById("colNombre")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && typeof window.confirmarAgregarColumna === "function") {
        window.confirmarAgregarColumna();
      }
    });

    const hoy = new Date().toISOString().split("T")[0];
    const pFI = document.getElementById("pFI");
    if (pFI) pFI.value = hoy;

    window.addEventListener("resize", _restaurarEstadoSidebar);
    window.addEventListener("orientationchange", _restaurarEstadoSidebar);
    
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") _cerrarSidebarMovil();
    });
    
    document.addEventListener("click", (e) => {
      const app = document.getElementById("app");
      if (!app || !app.classList.contains("mobile-sidebar-open")) return;
      const sidebar = document.getElementById("sidebar");
      const btnSidebar = document.getElementById("btnSidebarToggle");
      const target = e.target;
      if (sidebar?.contains(target) || btnSidebar?.contains(target)) return;
      _cerrarSidebarMovil();
    });
    
    _iniciarObserverTablasTarjeta();
    actualizarStatsLogin();
  });
})();
