/* ═══════════════════════════════════════════════════
   TaskFlow — app.js
   Estado global, HTTP, utilidades, navegación, auth, tema
   ACTUALIZADO: conecta SSE al iniciar sesión
════════════════════════════════════════════════════ */

const API = window.API_URL || "http://localhost:8000/api/v1";
let S = null;
let proyActualId = null;
let colsActuales = [];
let miembrosActuales = [];
const _cacheEstructuraProyecto = new Map();
const MOBILE_SIDEBAR_BREAKPOINT = 900;
let _obsTablasTarjeta = null;
let _rafTablasTarjeta = null;

/* ── HTTP ── */
async function api(met, ruta, body = null, token = true) {
  const h = { "Content-Type": "application/json" };
  if (token && S?.token_acceso) h["Authorization"] = `Bearer ${S.token_acceso}`;
  const r = await fetch(`${API}${ruta}`, {
    method: met,
    headers: h,
    body: body ? JSON.stringify(body) : null,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || "Error en la solicitud");
  return d;
}

/* ── TOAST ── */
function toast(msg, tipo = "ok") {
  const w = document.getElementById("toastWrap");
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ── MODALES ── */
function abrirModal(id) {
  document.getElementById(id).classList.add("open");
}
function cerrarModal(id) {
  document.getElementById(id).classList.remove("open");
}

function toggleVerPass() {
  const campo = document.getElementById("lPass");
  const btn = document.getElementById("btnVerPass");
  if (!campo) return;
  if (campo.type === "password") {
    campo.type = "text";
    if (btn)
      btn.innerHTML = '<i class="ph ph-eye-slash" style="font-size:16px"></i>';
  } else {
    campo.type = "password";
    if (btn) btn.innerHTML = '<i class="ph ph-eye" style="font-size:16px"></i>';
  }
}

/* ── TEMA ── */
function aplicarTema(tema) {
  document.documentElement.setAttribute("data-tema", tema);
  localStorage.setItem("tf_tema", tema);
  const btn = document.getElementById("btnTema");
  if (btn)
    btn.innerHTML =
      tema === "claro"
        ? '<i class="ph ph-moon"></i>'
        : '<i class="ph ph-sun"></i>';
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

/* ── TABLAS EN TARJETAS ── */
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
  document.getElementById(`pantalla-${nombre}`)?.classList.add("activa");
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
  _limpiarPantalla(nombre);
  _cerrarSidebarMovil();
  _programarTablasComoTarjetas();

  const acc = {
    dashboard: cargarDashboard,
    proyectos: cargarProyectos,
    tablero: async () => {
      await cargarSelectores();
      _inicializarTablero();
    },
    tareas: async () => {
      await cargarSelectores();
      _inicializarTareas();
    },
    usuarios: cargarUsuarios,
    reportes: async () => {
      await cargarSelectores();
      inicializarTabsReporte();
    },
    historial: cargarSelectores,
    notificaciones: () => {
      cargarNotificaciones();
      cargarTodasNotificaciones();
    },
    perfil: cargarPerfil,
    configuracion: () => {
      const check = document.getElementById("pantalla-configuracion");
      if (!check || check.children.length === 0) {
        setTimeout(() => cargarConfiguracion(), 100);
        return;
      }
      cargarConfiguracion();
    },
  };
  acc[nombre]?.();
}

/* ── UI TRAS LOGIN ── */
function actualizarUI() {
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
  if (u.avatarUri) {
    topAv.innerHTML = `<img src="${u.avatarUri}" style="width:22px;height:22px;border-radius:50%;object-fit:cover" onerror="this.style.display='none'">`;
  } else {
    topAv.textContent = inic(u.nombre);
  }

  document.getElementById("topNombre").textContent = u.nombre;
  document.getElementById("topRolBadge").textContent = rol;

  document.getElementById("navUsuarios").style.display =
    rol === "ADMIN" ? "" : "none";
  document.getElementById("navRegistrar").style.display =
    rol === "ADMIN" ? "" : "none";
  document.getElementById("navNotificaciones").style.display = "";
  document.getElementById("btnNotif").style.display = "";
  const btnSidebar = document.getElementById("btnSidebarToggle");
  if (btnSidebar) btnSidebar.style.display = "";

  document.getElementById("app").classList.remove("sin-sidebar");
  _restaurarEstadoSidebar();
}

/* ── HELPERS ── */
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

async function cargarEstructuraProyecto(proyectoId, forzar = false) {
  if (!proyectoId) {
    return { fases: [], fasesPorId: {}, etapasPorFase: {}, etapasPorId: {} };
  }
  if (!forzar && _cacheEstructuraProyecto.has(proyectoId)) {
    return _cacheEstructuraProyecto.get(proyectoId);
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
  _cacheEstructuraProyecto.set(proyectoId, estructura);
  return estructura;
}

function invalidarCacheEstructuraProyecto(proyectoId = null) {
  if (proyectoId) {
    _cacheEstructuraProyecto.delete(proyectoId);
    return;
  }
  _cacheEstructuraProyecto.clear();
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
  document.getElementById("lError").textContent = "";
  const email = document.getElementById("lEmail").value.trim();
  const pass = document.getElementById("lPass").value;
  if (!email || !pass) {
    document.getElementById("lError").textContent = "Completa todos los campos";
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando...';
  try {
    S = await api(
      "POST",
      "/usuarios/login",
      { email, contrasena: pass },
      false,
    );
    localStorage.setItem("tf_s", JSON.stringify(S));
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
      const noLeidas = ns.filter((n) => !n.leida).length;
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
    document.getElementById("lError").textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Iniciar sesión";
  }
}

function cerrarSesion() {
  // Desconectar SSE
  if (typeof window._desconectarStreamSSE === "function")
    window._desconectarStreamSSE();

  S = null;
  proyActualId = null;
  colsActuales = [];
  miembrosActuales = [];
  if (typeof _cacheUsuarios !== "undefined") _cacheUsuarios = null;
  invalidarCacheEstructuraProyecto();
  localStorage.removeItem("tf_s");

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
  document.getElementById("app").classList.add("sin-sidebar");
  document.getElementById("app").classList.remove("sidebar-collapsed");
  document.getElementById("app").classList.remove("mobile-sidebar-open");
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

async function crearUsuario() {
  document.getElementById("rError").textContent = "";
  try {
    await api(
      "POST",
      "/usuarios/registro",
      {
        nombre: document.getElementById("rNombre").value,
        email: document.getElementById("rEmail").value,
        contrasena: document.getElementById("rPass").value,
        rol: document.getElementById("rRol").value,
      },
      false,
    );
    toast("Usuario creado correctamente");
    ["rNombre", "rEmail", "rPass"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
  } catch (e) {
    document.getElementById("rError").textContent = e.message;
  }
}

/* ── NOTIF BADGE ── */
function actualizarBadgeNotif(n) {
  const b = document.getElementById("badgeNotif");
  if (!b) return;
  b.style.display = n > 0 ? "" : "none";
  b.textContent = n;
}

/* ── LIMPIEZA ── */
function _limpiarPantalla(pantallaNueva) {
  // placeholder para futura lógica de limpieza
}

function _inicializarTablero() {
  const sel = document.getElementById("selPT");
  if (!sel) return;
  if (sel.value) {
    proyActualId = sel.value;
    cargarTablero(proyActualId);
  } else {
    proyActualId = null;
    colsActuales = [];
    const board = document.getElementById("kanbanBoard");
    if (board)
      board.innerHTML =
        '<div class="vacío" style="width:100%">Selecciona un proyecto para ver el tablero</div>';
    const bc = document.getElementById("tBreadcrumb");
    if (bc) bc.textContent = "";
  }
}

function _inicializarTareas() {
  const sel = document.getElementById("selTareasProy");
  if (!sel) return;
  if (proyActualId && [...sel.options].some((o) => o.value === proyActualId)) {
    sel.value = proyActualId;
    cargarTareasPaginadas(proyActualId, 1);
  } else if (sel.value) {
    cargarTareasPaginadas(sel.value, 1);
  } else if (sel.options.length > 1) {
    sel.selectedIndex = 1;
    cargarTareasPaginadas(sel.value, 1);
  } else {
    const tb = document.getElementById("tbTareas");
    if (tb)
      tb.innerHTML =
        '<tr><td colspan="7" class="vacío">Selecciona un proyecto para ver las tareas</td></tr>';
  }
}

/* ── LOGIN STATS DINÁMICO ── */
async function actualizarStatsLogin() {
  const el = document.getElementById("loginPatronesCount");
  if (!el) return;
  try {
    const r = await fetch(`${API}/openapi.json`, { method: "GET" });
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
    const temaGuardado = localStorage.getItem("tf_tema") || "oscuro";
    aplicarTema(temaGuardado);

    document.querySelectorAll(".overlay").forEach((o) =>
      o.addEventListener("click", (e) => {
        if (e.target === o) o.classList.remove("open");
      }),
    );

    document.getElementById("app").classList.add("sin-sidebar");

    const saved = localStorage.getItem("tf_s");
    if (saved) {
      try {
        S = JSON.parse(saved);
        const overlay = document.getElementById("loginOverlay");
        if (overlay) overlay.classList.add("oculto");
        actualizarUI();
        mostrarPantalla("dashboard");

        // Reconectar SSE al recargar página con sesión activa
        setTimeout(() => {
          if (typeof window._conectarStreamSSE === "function")
            window._conectarStreamSSE();
        }, 1000);
      } catch {
        localStorage.removeItem("tf_s");
      }
    }

    document.getElementById("lPass")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") iniciarSesion();
    });
    document.getElementById("colNombre")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmarAgregarColumna();
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
