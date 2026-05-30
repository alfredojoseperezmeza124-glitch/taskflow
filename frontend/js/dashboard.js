/* ═══════════════════════════════════════════════════
   TaskFlow — dashboard.js
   Dashboard avanzado con filtros jerárquicos (fase/etapa)
   y métricas integradas con tareas + subtareas de etapa
════════════════════════════════════════════════════ */

/* ── Highcharts CDN (cargado una vez) ── */
let _hcCargado = false;
async function _cargarHighcharts() {
  if (_hcCargado || window.Highcharts) {
    _hcCargado = true;
    return;
  }
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src =
      "https://cdnjs.cloudflare.com/ajax/libs/highcharts/11.2.0/highcharts.js";
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  _hcCargado = true;
}

/* ── Paleta adaptada al tema ── */
function _hcColores() {
  const esClaro =
    document.documentElement.getAttribute("data-tema") === "claro";
  return {
    bg: esClaro ? "#ffffff" : "#111113",
    tooltipBg: esClaro ? "#ffffff" : "#141417",
    txt: esClaro ? "#52525b" : "#a1a1aa",
    txth: esClaro ? "#09090b" : "#fafafa",
    borde: esClaro ? "#d4d4d8" : "#3f3f46",
    serie: [
      "#6366f1",
      "#22c55e",
      "#f59e0b",
      "#ef4444",
      "#06b6d4",
      "#a855f7",
      "#ec4899",
      "#14b8a6",
    ],
  };
}

function _hcBase() {
  const c = _hcColores();
  return {
    chart: {
      backgroundColor: "transparent",
      style: { fontFamily: "Inter, sans-serif" },
      spacingTop: 10,
      spacingRight: 8,
      spacingLeft: 8,
      spacingBottom: 8,
    },
    title: { text: "" },
    credits: { enabled: false },
    legend: {
      itemStyle: { color: c.txt, fontSize: "11px", fontWeight: "500" },
      itemHoverStyle: { color: c.txth },
      symbolRadius: 99,
      symbolHeight: 10,
      symbolWidth: 10,
    },
    xAxis: {
      labels: { style: { color: c.txt, fontSize: "11px" } },
      lineColor: c.borde,
      tickColor: c.borde,
    },
    yAxis: {
      labels: { style: { color: c.txt, fontSize: "11px" } },
      gridLineColor: c.borde,
      title: { text: "" },
    },
    tooltip: {
      backgroundColor: c.tooltipBg,
      borderColor: c.borde,
      borderRadius: 10,
      style: { color: c.txth, fontSize: "12px" },
      shadow: true,
      padding: 10,
    },
    plotOptions: {
      series: {
        animation: { duration: 450 },
        states: { inactive: { opacity: 1 } },
      },
    },
    colors: c.serie,
  };
}

const _DASH_CACHE_TTL = 60 * 1000;
const _DASH_LIMITE_TAREAS = 200;

/* Estado del dashboard */
let _dashProyId = null;
let _dashTimer = null;
let _dashMetricas = null;
let _dashDataBase = null;
let _dashProyectos = [];
const _dashCacheDatos = new Map();

function _dashEsc(txt = "") {
  return String(txt)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function _dashEsColumnaCompletada(nombreColumna = "") {
  const nombre = String(nombreColumna).toLowerCase();
  return (
    nombre.includes("complet") ||
    nombre.includes("listo") ||
    nombre.includes("done")
  );
}

function _dashEsColumnaEnProgreso(nombreColumna = "") {
  const nombre = String(nombreColumna).toLowerCase();
  return (
    nombre.includes("progreso") ||
    nombre.includes("progress") ||
    nombre.includes("doing")
  );
}

function _dashAFecha(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function _dashNombreColumna(base, columnaId) {
  if (!columnaId) return "Sin columna";
  return (
    base?.columnasPorId?.[columnaId] || `Col ${String(columnaId).slice(-6)}`
  );
}

function _dashNombreFase(base, faseId) {
  if (!faseId) return "Sin fase";
  return (
    base?.fasesPorId?.[faseId]?.nombre || `Fase ${String(faseId).slice(-6)}`
  );
}

function _dashNombreEtapa(base, etapaId) {
  if (!etapaId) return "Sin etapa";
  return (
    base?.etapasPorId?.[etapaId]?.nombre || `Etapa ${String(etapaId).slice(-6)}`
  );
}

function _dashFaseDesdeTarea(base, tarea) {
  if (tarea?.faseId) return tarea.faseId;
  const etapaId = tarea?.etapaId;
  if (!etapaId) return "";
  return base?.etapasPorId?.[etapaId]?.faseId || "";
}

function _dashVentanasSemanales(cantidad) {
  const semanas = Math.max(1, Number(cantidad) || 8);
  const hoy = new Date();
  const inicioSemanaActual = new Date(
    Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()),
  );
  const dia = inicioSemanaActual.getUTCDay();
  const ajuste = (dia + 6) % 7; // lunes = 0
  inicioSemanaActual.setUTCDate(inicioSemanaActual.getUTCDate() - ajuste);
  inicioSemanaActual.setUTCHours(0, 0, 0, 0);

  const ventanas = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const inicio = new Date(inicioSemanaActual);
    inicio.setUTCDate(inicio.getUTCDate() - i * 7);
    const fin = new Date(inicio);
    fin.setUTCDate(fin.getUTCDate() + 7);
    ventanas.push({
      inicio,
      fin,
      label: inicio.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
      }),
    });
  }
  return ventanas;
}

function _dashContarPorVentana(items, ventanas, selectorFecha) {
  const conteo = ventanas.map(() => 0);
  for (const item of items || []) {
    const fecha = _dashAFecha(selectorFecha(item));
    if (!fecha) continue;
    for (let i = 0; i < ventanas.length; i++) {
      const v = ventanas[i];
      if (fecha >= v.inicio && fecha < v.fin) {
        conteo[i] += 1;
        break;
      }
    }
  }
  return conteo;
}

function _dashTop(entradas, limite = 8) {
  return [...(entradas || [])].sort(([, a], [, b]) => b - a).slice(0, limite);
}

function _dashCombinarMapas(destino, fuente) {
  Object.entries(fuente || {}).forEach(([k, v]) => {
    destino[k] = v;
  });
}

function _dashDataVacia(esGlobal = false) {
  return {
    esGlobal,
    proyectoId: null,
    tareas: [],
    subtareasEtapa: [],
    columnasPorId: {},
    fasesPorId: {},
    etapasPorId: {},
    usuariosPorId: {},
    proyectosPorId: {},
  };
}

/* ── FUNCIÓN PRINCIPAL ── */
async function cargarDashboard() {
  if (!S) return;

  const fechaEl = document.getElementById("dashFecha");
  if (fechaEl) {
    fechaEl.textContent = new Date().toLocaleDateString("es-CO", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  const saludo = document.getElementById("dashSaludo");
  if (saludo) {
    const hora = new Date().getHours();
    const turno =
      hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
    saludo.textContent = `${turno}, ${S.usuario.nombre.split(" ")[0]}`;
  }

  const acciones = document.getElementById("dashAcciones");
  if (
    acciones &&
    (S.usuario.rol === "PROJECT_MANAGER" || S.usuario.rol === "ADMIN")
  ) {
    acciones.innerHTML =
      `<button class="btn btn-primary btn-sm" onclick="abrirModal('mProy')">` +
      `<i class="ph ph-plus"></i> Nuevo proyecto</button>`;
  } else if (acciones) {
    acciones.innerHTML = "";
  }

  await _cargarHighcharts();
  await Promise.all([_poblarSelectorDash(), _cargarProyectosRecientes()]);
  await _cargarMetricasDash(_dashProyId, false);

  clearInterval(_dashTimer);
  _dashTimer = setInterval(() => {
    if (
      document
        .getElementById("pantalla-dashboard")
        ?.classList.contains("activa")
    ) {
      _cargarMetricasDash(_dashProyId, true);
    }
  }, 60000);
}

async function refrescarDashboard() {
  _dashCacheDatos.clear();
  await Promise.all([_poblarSelectorDash(), _cargarProyectosRecientes()]);
  await _cargarMetricasDash(_dashProyId, true);
  toast("Dashboard actualizado");
}

async function _poblarSelectorDash() {
  const sel = document.getElementById("selDashProy");
  if (!sel) return;
  try {
    _dashProyectos = await api("GET", "/proyectos/");
    sel.innerHTML =
      '<option value="">— Todos los proyectos —</option>' +
      _dashProyectos
        .map((p) => `<option value="${p.id}">${_dashEsc(p.nombre)}</option>`)
        .join("");

    const seleccionValida =
      !_dashProyId || _dashProyectos.some((p) => p.id === _dashProyId);
    if (!seleccionValida) _dashProyId = null;
    sel.value = _dashProyId || "";
  } catch (_) {
    _dashProyectos = [];
    _dashProyId = null;
    sel.innerHTML = '<option value="">— Sin proyectos —</option>';
  }
}

async function actualizarDashboardProy(proyId) {
  _dashProyId = proyId || null;
  if (_dashProyId) proyActualId = _dashProyId;
  await _cargarMetricasDash(_dashProyId, false);
}

function onCambioFaseDashboard() {
  if (!_dashDataBase) return;
  _dashPoblarFasesEtapas(_dashDataBase);
  _renderDashboardFiltrado();
}

function onCambioFiltroDashboard() {
  _renderDashboardFiltrado();
}

function limpiarFiltrosDashboard() {
  const porDefecto = {
    selDashFase: "",
    selDashEtapa: "",
    selDashPrio: "",
    selDashTipo: "",
    selDashResp: "",
    selDashContexto: "todos",
    selDashSemanas: "8",
  };
  Object.entries(porDefecto).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  const chk = document.getElementById("chkDashIncluirSubEtapa");
  if (chk) chk.checked = true;
  if (_dashDataBase) _dashPoblarFasesEtapas(_dashDataBase);
  _renderDashboardFiltrado();
}

/* Helper: actualiza valor y subtítulo de una KPI card */
function _setKpi(id, valor, sub) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor ?? "—";
  const subId = id + "Sub";
  const subEl = document.getElementById(subId);
  if (subEl && sub !== undefined) subEl.textContent = sub;
}

async function _dashObtenerMapaUsuarios() {
  if (typeof _obtenerMapaUsuarios === "function") {
    try {
      return await _obtenerMapaUsuarios();
    } catch (_) {}
  }
  try {
    const lista = await api("GET", "/usuarios/activos");
    const mapa = {};
    (lista || []).forEach((u) => {
      mapa[u.id] = u;
    });
    return mapa;
  } catch (_) {
    return {};
  }
}

async function _dashListarTodasTareasProyecto(proyId) {
  const tareas = [];
  let pagina = 1;
  let totalPaginas = 1;

  while (pagina <= totalPaginas) {
    const res = await api(
      "GET",
      `/proyectos/${proyId}/tareas?pagina=${pagina}&limite=${_DASH_LIMITE_TAREAS}`,
    );
    const datos = Array.isArray(res?.datos)
      ? res.datos
      : Array.isArray(res)
        ? res
        : [];
    tareas.push(...datos);

    if (!res || typeof res !== "object" || !("totalPaginas" in res)) {
      break;
    }
    totalPaginas = Math.max(1, Number(res.totalPaginas) || 1);
    pagina += 1;
  }

  return tareas;
}

function _dashColumnasPorId(tableros = []) {
  const columnas = {};
  (tableros || []).forEach((tablero) => {
    (tablero.columnas || []).forEach((col) => {
      if (col?.id) columnas[col.id] = col.nombre || col.id;
    });
  });
  return columnas;
}

async function _dashConstruirDataProyecto(proyecto) {
  const proyId = typeof proyecto === "string" ? proyecto : proyecto?.id;
  if (!proyId) return _dashDataVacia(false);

  const base = _dashDataVacia(false);
  base.proyectoId = proyId;
  if (typeof proyecto === "object" && proyecto?.id) {
    base.proyectosPorId[proyecto.id] = proyecto;
  }

  const [tableros, estructura, subtareasEtapa, tareas] = await Promise.all([
    api("GET", `/proyectos/${proyId}/tableros`).catch(() => []),
    cargarEstructuraProyecto(proyId).catch(() => ({
      fases: [],
      fasesPorId: {},
      etapasPorFase: {},
      etapasPorId: {},
    })),
    api("GET", `/proyectos/${proyId}/subtareas-etapa`).catch(() => []),
    _dashListarTodasTareasProyecto(proyId).catch(() => []),
  ]);

  base.columnasPorId = _dashColumnasPorId(tableros);
  base.tareas = Array.isArray(tareas) ? tareas : [];
  base.subtareasEtapa = Array.isArray(subtareasEtapa) ? subtareasEtapa : [];

  Object.values(estructura?.fasesPorId || {}).forEach((fase) => {
    if (!fase?.id) return;
    base.fasesPorId[fase.id] = { ...fase, proyectoId: proyId };
  });
  Object.values(estructura?.etapasPorId || {}).forEach((etapa) => {
    if (!etapa?.id) return;
    base.etapasPorId[etapa.id] = { ...etapa, proyectoId: proyId };
  });

  return base;
}

async function _dashConstruirDataGlobal() {
  const base = _dashDataVacia(true);
  if (!_dashProyectos.length) return base;

  const lotes = await Promise.all(
    _dashProyectos.map((p) => _dashConstruirDataProyecto(p).catch(() => null)),
  );

  lotes.filter(Boolean).forEach((item) => {
    base.tareas.push(...(item.tareas || []));
    base.subtareasEtapa.push(...(item.subtareasEtapa || []));
    _dashCombinarMapas(base.columnasPorId, item.columnasPorId);
    _dashCombinarMapas(base.fasesPorId, item.fasesPorId);
    _dashCombinarMapas(base.etapasPorId, item.etapasPorId);
    _dashCombinarMapas(base.proyectosPorId, item.proyectosPorId);
  });

  return base;
}

async function _dashCargarBase(proyId, forzar = false) {
  const key = proyId || "__all__";
  const cache = _dashCacheDatos.get(key);
  if (!forzar && cache && Date.now() - cache.ts < _DASH_CACHE_TTL) {
    return cache.data;
  }

  const data = proyId
    ? await _dashConstruirDataProyecto(
        _dashProyectos.find((p) => p.id === proyId) || { id: proyId },
      )
    : await _dashConstruirDataGlobal();

  data.usuariosPorId = await _dashObtenerMapaUsuarios();
  _dashCacheDatos.set(key, { ts: Date.now(), data });
  return data;
}

function _dashPoblarFiltros(base) {
  _dashPoblarFasesEtapas(base);
  _dashPoblarResponsables(base);
}

function _dashPoblarFasesEtapas(base) {
  const selFase = document.getElementById("selDashFase");
  const selEtapa = document.getElementById("selDashEtapa");
  if (!selFase || !selEtapa) return;

  const faseActual = selFase.value || "";
  const etapaActual = selEtapa.value || "";

  const fases = Object.values(base?.fasesPorId || {}).sort((a, b) =>
    String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
      sensitivity: "base",
    }),
  );
  selFase.innerHTML =
    '<option value="">— Todas las fases —</option>' +
    fases
      .map((fase) => {
        const nombreProyecto = base?.proyectosPorId?.[fase.proyectoId]?.nombre;
        const sufijo =
          base?.esGlobal && nombreProyecto ? ` · ${nombreProyecto}` : "";
        return `<option value="${fase.id}">${_dashEsc((fase.nombre || "Fase") + sufijo)}</option>`;
      })
      .join("");
  selFase.value = fases.some((fase) => fase.id === faseActual)
    ? faseActual
    : "";

  const faseSeleccionada = selFase.value || "";
  const etapasTodas = Object.values(base?.etapasPorId || {});
  const etapas = etapasTodas
    .filter((etapa) => !faseSeleccionada || etapa.faseId === faseSeleccionada)
    .sort((a, b) =>
      String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
        sensitivity: "base",
      }),
    );
  selEtapa.innerHTML =
    '<option value="">— Todas las etapas —</option>' +
    etapas
      .map((etapa) => {
        const nombreProyecto = base?.proyectosPorId?.[etapa.proyectoId]?.nombre;
        const sufijo =
          base?.esGlobal && nombreProyecto ? ` · ${nombreProyecto}` : "";
        return `<option value="${etapa.id}">${_dashEsc((etapa.nombre || "Etapa") + sufijo)}</option>`;
      })
      .join("");
  selEtapa.value = etapas.some((etapa) => etapa.id === etapaActual)
    ? etapaActual
    : "";

  selFase.disabled = !fases.length;
  selEtapa.disabled = !etapasTodas.length;
}

function _dashPoblarResponsables(base) {
  const sel = document.getElementById("selDashResp");
  if (!sel) return;

  const actual = sel.value || "";
  const ids = new Set();
  (base?.tareas || []).forEach((t) =>
    (t.responsables || []).forEach((id) => ids.add(id)),
  );
  (base?.subtareasEtapa || []).forEach((s) =>
    (s.responsables || []).forEach((id) => ids.add(id)),
  );

  const mapa = base?.usuariosPorId || {};
  const opciones = [...ids]
    .map((id) => ({
      id,
      nombre: mapa[id]?.nombre || `Usuario ${String(id).slice(-6)}`,
    }))
    .sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
    );

  sel.innerHTML =
    '<option value="">— Todo el equipo —</option>' +
    opciones
      .map((o) => `<option value="${o.id}">${_dashEsc(o.nombre)}</option>`)
      .join("");
  sel.value = opciones.some((o) => o.id === actual) ? actual : "";
  sel.disabled = !opciones.length;
}

function _leerFiltrosDash() {
  return {
    faseId: document.getElementById("selDashFase")?.value || "",
    etapaId: document.getElementById("selDashEtapa")?.value || "",
    prioridad: document.getElementById("selDashPrio")?.value || "",
    tipo: document.getElementById("selDashTipo")?.value || "",
    responsableId: document.getElementById("selDashResp")?.value || "",
    contexto: document.getElementById("selDashContexto")?.value || "todos",
    semanas: Number(document.getElementById("selDashSemanas")?.value || 8),
    incluyeSubEtapa:
      document.getElementById("chkDashIncluirSubEtapa")?.checked !== false,
  };
}

async function _cargarMetricasDash(proyId, forzar = false) {
  if (!S) return;
  try {
    _dashDataBase = await _dashCargarBase(proyId, forzar);
    _dashPoblarFiltros(_dashDataBase);
    _renderDashboardFiltrado();
  } catch (e) {
    console.error("Dashboard error:", e.message);
    const cont = document.getElementById("dashAlertas");
    if (cont) {
      cont.innerHTML = `<div class="vacío">Error al cargar dashboard: ${_dashEsc(e.message)}</div>`;
    }
  }
}

function _dashFiltrarData(base, filtros) {
  const tareas = (base?.tareas || []).filter((t) => {
    const faseId = _dashFaseDesdeTarea(base, t);
    const etapaId = t.etapaId || "";
    const estructurada = !!(faseId || etapaId);

    if (filtros.faseId && faseId !== filtros.faseId) return false;
    if (filtros.etapaId && etapaId !== filtros.etapaId) return false;
    if (filtros.prioridad && t.prioridad !== filtros.prioridad) return false;
    if (filtros.tipo && t.tipo !== filtros.tipo) return false;
    if (
      filtros.responsableId &&
      !(t.responsables || []).includes(filtros.responsableId)
    ) {
      return false;
    }
    if (filtros.contexto === "estructura" && !estructurada) return false;
    if (filtros.contexto === "legadas" && estructurada) return false;
    return true;
  });

  const subtareasEtapa = (base?.subtareasEtapa || []).filter((s) => {
    if (filtros.contexto === "legadas") return false;
    const faseId = s.faseId || base?.etapasPorId?.[s.etapaId]?.faseId || "";
    const etapaId = s.etapaId || "";
    if (filtros.faseId && faseId !== filtros.faseId) return false;
    if (filtros.etapaId && etapaId !== filtros.etapaId) return false;
    if (
      filtros.responsableId &&
      !(s.responsables || []).includes(filtros.responsableId)
    ) {
      return false;
    }
    return true;
  });

  return { tareas, subtareasEtapa };
}

function _dashConstruirResumen(base, filtrado, filtros) {
  const ahora = new Date();
  const tareas = filtrado.tareas || [];
  const subtareasEtapa = filtros.incluyeSubEtapa
    ? filtrado.subtareasEtapa || []
    : [];

  const totalTareas = tareas.length;
  const totalSubEtapa = filtrado.subtareasEtapa.length;
  const totalTrabajo = totalTareas + subtareasEtapa.length;

  const completadasTareas = tareas.filter((t) =>
    _dashEsColumnaCompletada(_dashNombreColumna(base, t.columnaId)),
  ).length;
  const enProgresoTareas = tareas.filter((t) =>
    _dashEsColumnaEnProgreso(_dashNombreColumna(base, t.columnaId)),
  ).length;
  const completadasSubEtapa = subtareasEtapa.filter((s) => s.completada).length;
  const completadasTrabajo = completadasTareas + completadasSubEtapa;

  const vencidasTareas = tareas.filter((t) => t.estaVencida).length;
  const vencidasSub = subtareasEtapa.filter((s) => {
    if (s.completada) return false;
    const fecha = _dashAFecha(s.fechaVencimiento);
    return !!(fecha && fecha < ahora);
  }).length;
  const vencidas = vencidasTareas + vencidasSub;

  const estructuradas = tareas.filter(
    (t) => !!(_dashFaseDesdeTarea(base, t) || t.etapaId),
  ).length;
  const legadas = totalTareas - estructuradas;
  const coberturaEstructura = totalTareas
    ? Math.round((estructuradas / totalTareas) * 100)
    : 0;
  const porcentajeCompletado = totalTrabajo
    ? Math.round((completadasTrabajo / totalTrabajo) * 100)
    : 0;

  return {
    totalTrabajo,
    totalTareas,
    totalSubEtapa,
    enProgresoTareas,
    completadasTareas,
    completadasSubEtapa,
    vencidas,
    estructuradas,
    legadas,
    coberturaEstructura,
    porcentajeCompletado,
  };
}

function _dashPintarKpis(resumen, filtrado, filtros) {
  _setKpi(
    "stDashTrabajo",
    resumen.totalTrabajo,
    `${resumen.porcentajeCompletado}% completado`,
  );
  _setKpi(
    "stDashTareas",
    resumen.totalTareas,
    `${resumen.enProgresoTareas} en progreso`,
  );
  _setKpi(
    "stDashSubEtapas",
    resumen.totalSubEtapa,
    filtros.incluyeSubEtapa
      ? `${resumen.completadasSubEtapa} completadas`
      : "excluidas del consolidado",
  );
  _setKpi(
    "stDashVencidas",
    resumen.vencidas,
    resumen.vencidas > 0 ? "requieren atención" : "al día ✓",
  );
  _setKpi(
    "stDashCobertura",
    `${resumen.coberturaEstructura}%`,
    `${resumen.legadas} legadas / ${resumen.estructuradas} estructuradas`,
  );
}

function _dashRenderInsights(base, filtrado, resumen, filtros) {
  const cont = document.getElementById("dashAlertas");
  if (!cont) return;

  const alertas = [];

  if (resumen.legadas > 0) {
    alertas.push(
      `⚠️ Hay <strong>${resumen.legadas}</strong> tareas legadas sin fase/etapa. ` +
        `Conviene clasificarlas para mejorar trazabilidad.`,
    );
  } else if (resumen.totalTareas > 0) {
    alertas.push("✅ Todas las tareas visibles están alineadas a fase/etapa.");
  }

  if (filtros.incluyeSubEtapa) {
    const pendientesPorEtapa = {};
    (filtrado.subtareasEtapa || []).forEach((s) => {
      if (s.completada) return;
      const nombre = s.etapaNombre || _dashNombreEtapa(base, s.etapaId);
      pendientesPorEtapa[nombre] = (pendientesPorEtapa[nombre] || 0) + 1;
    });
    const [etapaTop, pendientes] = _dashTop(
      Object.entries(pendientesPorEtapa),
      1,
    )[0] || ["", 0];
    if (pendientes > 0) {
      alertas.push(
        `🧩 La etapa con mayor pendiente es <strong>${_dashEsc(etapaTop)}</strong> ` +
          `con <strong>${pendientes}</strong> subtareas abiertas.`,
      );
    }
  }

  const carga = {};
  const acumularCarga = (id) => {
    carga[id] = (carga[id] || 0) + 1;
  };

  (filtrado.tareas || []).forEach((t) => {
    if (!(t.responsables || []).length) {
      acumularCarga("__sin_responsable__");
      return;
    }
    (t.responsables || []).forEach((id) => acumularCarga(id));
  });

  if (filtros.incluyeSubEtapa) {
    (filtrado.subtareasEtapa || []).forEach((s) => {
      if (!(s.responsables || []).length) return;
      (s.responsables || []).forEach((id) => acumularCarga(id));
    });
  }

  const [responsableTop, cargaTop] = _dashTop(Object.entries(carga), 1)[0] || [
    "",
    0,
  ];
  if (cargaTop > 0) {
    const nombreResp =
      responsableTop === "__sin_responsable__"
        ? "Sin responsable"
        : base?.usuariosPorId?.[responsableTop]?.nombre ||
          `Usuario ${String(responsableTop).slice(-6)}`;
    alertas.push(
      `👥 Mayor carga actual: <strong>${_dashEsc(nombreResp)}</strong> con ` +
        `<strong>${cargaTop}</strong> asignaciones.`,
    );
  }

  if (!alertas.length) {
    cont.innerHTML =
      '<div class="vacío">Sin datos suficientes para generar insights.</div>';
    return;
  }

  cont.innerHTML = alertas
    .map(
      (msg) =>
        `<div style="padding:10px 12px;border:1px solid var(--b1);border-radius:10px;background:var(--s2);font-size:12px;color:var(--t2);margin-bottom:8px">${msg}</div>`,
    )
    .join("");
}

function _renderDashboardFiltrado() {
  if (!window.Highcharts || !_dashDataBase) return;
  const filtros = _leerFiltrosDash();
  const filtrado = _dashFiltrarData(_dashDataBase, filtros);
  const resumen = _dashConstruirResumen(_dashDataBase, filtrado, filtros);
  _dashMetricas = resumen;
  _dashPintarKpis(resumen, filtrado, filtros);
  _renderizarGraficos(_dashDataBase, filtrado, resumen, filtros);
  _dashRenderInsights(_dashDataBase, filtrado, resumen, filtros);
}

function _renderizarGraficos(base, filtrado, resumen, filtros) {
  if (!window.Highcharts) return;

  const c = _hcColores();
  const baseChart = _hcBase();

  const estadoMap = {};
  (filtrado.tareas || []).forEach((t) => {
    const nombre = _dashNombreColumna(base, t.columnaId);
    estadoMap[nombre] = (estadoMap[nombre] || 0) + 1;
  });
  if (filtros.incluyeSubEtapa) {
    const pendientes = (filtrado.subtareasEtapa || []).filter(
      (s) => !s.completada,
    ).length;
    const completadas = (filtrado.subtareasEtapa || []).filter(
      (s) => s.completada,
    ).length;
    if (pendientes > 0) estadoMap["Subtareas etapa · Pendientes"] = pendientes;
    if (completadas > 0)
      estadoMap["Subtareas etapa · Completadas"] = completadas;
  }
  const estadoEntradas = _dashTop(Object.entries(estadoMap), 12);
  const estadoCategorias = estadoEntradas.length
    ? estadoEntradas.map(([k]) => k)
    : ["Sin datos"];
  const estadoValores = estadoEntradas.length
    ? estadoEntradas.map(([, v]) => v)
    : [0];
  Highcharts.chart("chartDashEstado", {
    ...baseChart,
    chart: { ...baseChart.chart, type: "column" },
    xAxis: { ...baseChart.xAxis, categories: estadoCategorias },
    yAxis: { ...baseChart.yAxis, allowDecimals: false },
    legend: { enabled: false },
    plotOptions: {
      column: {
        borderRadius: 6,
        borderWidth: 0,
        colorByPoint: true,
        pointPadding: 0.08,
        groupPadding: 0.08,
      },
    },
    series: [{ name: "Items", data: estadoValores }],
  });

  const semanas = _dashVentanasSemanales(filtros.semanas);
  const categoriasSemana = semanas.map((s) => s.label);
  const serieTareas = _dashContarPorVentana(
    filtrado.tareas || [],
    semanas,
    (t) => t.creadoEn,
  );
  const serieSubtareas = _dashContarPorVentana(
    filtrado.subtareasEtapa || [],
    semanas,
    (s) => s.creadoEn,
  );
  const seriesVelocidad = [
    { name: "Tareas", data: serieTareas, color: "#6366f1" },
  ];
  if (filtros.incluyeSubEtapa) {
    seriesVelocidad.push({
      name: "Subtareas etapa",
      data: serieSubtareas,
      color: "#14b8a6",
    });
  }
  Highcharts.chart("chartDashVelocidad", {
    ...baseChart,
    chart: { ...baseChart.chart, type: "area" },
    xAxis: { ...baseChart.xAxis, categories: categoriasSemana },
    yAxis: { ...baseChart.yAxis, allowDecimals: false },
    plotOptions: {
      area: {
        fillOpacity: 0.18,
        lineWidth: 3,
        marker: { enabled: categoriasSemana.length <= 10, radius: 3 },
      },
    },
    series: seriesVelocidad,
  });

  const faseMap = {};
  (filtrado.tareas || []).forEach((t) => {
    const nombre = _dashNombreFase(base, _dashFaseDesdeTarea(base, t));
    faseMap[nombre] = (faseMap[nombre] || 0) + 1;
  });
  if (filtros.incluyeSubEtapa) {
    (filtrado.subtareasEtapa || []).forEach((s) => {
      const nombre = s.faseNombre || _dashNombreFase(base, s.faseId);
      faseMap[nombre] = (faseMap[nombre] || 0) + 1;
    });
  }
  const faseEntradas = _dashTop(Object.entries(faseMap), 10);
  const faseCategorias = faseEntradas.length
    ? faseEntradas.map(([k]) => k)
    : ["Sin datos"];
  const faseValores = faseEntradas.length
    ? faseEntradas.map(([, v]) => v)
    : [0];
  Highcharts.chart("chartDashFase", {
    ...baseChart,
    chart: { ...baseChart.chart, type: "bar" },
    xAxis: { ...baseChart.xAxis, categories: faseCategorias },
    yAxis: { ...baseChart.yAxis, allowDecimals: false },
    legend: { enabled: false },
    plotOptions: {
      bar: {
        borderRadius: 6,
        borderWidth: 0,
        pointPadding: 0.08,
        groupPadding: 0.08,
      },
    },
    colors: ["#6366f1"],
    series: [{ name: "Trabajo", data: faseValores }],
  });

  const etapaMap = {};
  (filtrado.tareas || []).forEach((t) => {
    const nombre = _dashNombreEtapa(base, t.etapaId);
    if (!etapaMap[nombre]) etapaMap[nombre] = { tareas: 0, subtareas: 0 };
    etapaMap[nombre].tareas += 1;
  });
  if (filtros.incluyeSubEtapa) {
    (filtrado.subtareasEtapa || []).forEach((s) => {
      const nombre = s.etapaNombre || _dashNombreEtapa(base, s.etapaId);
      if (!etapaMap[nombre]) etapaMap[nombre] = { tareas: 0, subtareas: 0 };
      etapaMap[nombre].subtareas += 1;
    });
  }
  const etapaEntradas = _dashTop(
    Object.entries(etapaMap).map(([k, v]) => [k, v.tareas + v.subtareas]),
    8,
  );
  const etapaCategorias = etapaEntradas.length
    ? etapaEntradas.map(([k]) => k)
    : ["Sin datos"];
  const etapaTareas = etapaCategorias.map(
    (nombre) => etapaMap[nombre]?.tareas || 0,
  );
  const etapaSubtareas = etapaCategorias.map(
    (nombre) => etapaMap[nombre]?.subtareas || 0,
  );
  const seriesEtapa = [{ name: "Tareas", data: etapaTareas, color: "#6366f1" }];
  if (filtros.incluyeSubEtapa) {
    seriesEtapa.push({
      name: "Subtareas etapa",
      data: etapaSubtareas,
      color: "#14b8a6",
    });
  }
  Highcharts.chart("chartDashEtapa", {
    ...baseChart,
    chart: { ...baseChart.chart, type: "bar" },
    xAxis: { ...baseChart.xAxis, categories: etapaCategorias },
    yAxis: {
      ...baseChart.yAxis,
      allowDecimals: false,
      stackLabels: { enabled: false },
    },
    plotOptions: {
      bar: {
        stacking: "normal",
        borderRadius: 6,
        borderWidth: 0,
        pointPadding: 0.08,
        groupPadding: 0.08,
      },
    },
    series: seriesEtapa,
  });

  const cargaMap = {};
  const acumular = (id, delta = 1) => {
    cargaMap[id] = (cargaMap[id] || 0) + delta;
  };
  (filtrado.tareas || []).forEach((t) => {
    if (!(t.responsables || []).length) {
      acumular("__sin_responsable__");
      return;
    }
    (t.responsables || []).forEach((id) => acumular(id));
  });
  if (filtros.incluyeSubEtapa) {
    (filtrado.subtareasEtapa || []).forEach((s) => {
      if (!(s.responsables || []).length) return;
      (s.responsables || []).forEach((id) => acumular(id));
    });
  }
  const cargaEntradas = _dashTop(Object.entries(cargaMap), 8);
  const cargaCategorias = cargaEntradas.length
    ? cargaEntradas.map(([id]) =>
        id === "__sin_responsable__"
          ? "Sin responsable"
          : base?.usuariosPorId?.[id]?.nombre ||
            `Usuario ${String(id).slice(-6)}`,
      )
    : ["Sin datos"];
  const cargaValores = cargaEntradas.length
    ? cargaEntradas.map(([, v]) => v)
    : [0];
  Highcharts.chart("chartDashResponsables", {
    ...baseChart,
    chart: { ...baseChart.chart, type: "bar" },
    xAxis: { ...baseChart.xAxis, categories: cargaCategorias },
    yAxis: { ...baseChart.yAxis, allowDecimals: false },
    legend: { enabled: false },
    plotOptions: {
      bar: {
        borderRadius: 6,
        borderWidth: 0,
        pointPadding: 0.08,
        groupPadding: 0.08,
      },
    },
    colors: ["#a855f7"],
    series: [{ name: "Asignaciones", data: cargaValores }],
  });

  const ordenPrio = ["BAJA", "MEDIA", "ALTA", "URGENTE"];
  const prioMap = {};
  (filtrado.tareas || []).forEach((t) => {
    const k = t.prioridad || "MEDIA";
    prioMap[k] = (prioMap[k] || 0) + 1;
  });
  const prioEntradas = ordenPrio
    .map((k) => [k, prioMap[k] || 0])
    .filter(([, v]) => v > 0);
  const prioColores = {
    BAJA: "#22c55e",
    MEDIA: "#f59e0b",
    ALTA: "#ef4444",
    URGENTE: "#a855f7",
  };
  const prioData = prioEntradas.length
    ? prioEntradas.map(([k, v]) => ({ name: k, y: v, color: prioColores[k] }))
    : [{ name: "Sin datos", y: 1, color: c.borde }];
  Highcharts.chart("chartDashPrioridad", {
    ...baseChart,
    chart: { ...baseChart.chart, type: "pie" },
    plotOptions: {
      pie: {
        innerSize: "64%",
        borderWidth: 0,
        dataLabels: {
          enabled: true,
          style: { color: c.txt, textOutline: "none", fontSize: "10px" },
        },
      },
    },
    series: [{ name: "Tareas", data: prioData }],
  });

  const ordenTipo = ["TASK", "BUG", "FEATURE", "IMPROVEMENT"];
  const tipoMap = {};
  (filtrado.tareas || []).forEach((t) => {
    const k = t.tipo || "TASK";
    tipoMap[k] = (tipoMap[k] || 0) + 1;
  });
  const tipoEntradas = ordenTipo
    .map((k) => [k, tipoMap[k] || 0])
    .filter(([, v]) => v > 0);
  const tipoCategorias = tipoEntradas.length
    ? tipoEntradas.map(([k]) => k)
    : ["Sin datos"];
  const tipoValores = tipoEntradas.length
    ? tipoEntradas.map(([, v]) => v)
    : [0];
  const tipoColores = {
    TASK: "#a1a1aa",
    BUG: "#ef4444",
    FEATURE: "#06b6d4",
    IMPROVEMENT: "#22c55e",
  };
  Highcharts.chart("chartDashTipo", {
    ...baseChart,
    chart: { ...baseChart.chart, type: "column" },
    xAxis: { ...baseChart.xAxis, categories: tipoCategorias },
    yAxis: { ...baseChart.yAxis, allowDecimals: false },
    legend: { enabled: false },
    plotOptions: {
      column: {
        borderRadius: 6,
        borderWidth: 0,
        colorByPoint: true,
        pointPadding: 0.1,
        groupPadding: 0.1,
      },
    },
    colors: tipoCategorias.map((k) => tipoColores[k] || "#6366f1"),
    series: [{ name: "Tareas", data: tipoValores }],
  });
}

async function _cargarProyectosRecientes() {
  const cont = document.getElementById("dashProyectos");
  if (!cont) return;
  try {
    const ps = await api("GET", "/proyectos/");
    const accionesProy = document.getElementById("dashAccionesProy");
    if (
      accionesProy &&
      (S.usuario.rol === "PROJECT_MANAGER" || S.usuario.rol === "ADMIN")
    ) {
      accionesProy.innerHTML =
        `<button class="btn btn-primary btn-sm" onclick="abrirModal('mProy')">` +
        `<i class="ph ph-plus"></i> Nuevo</button>`;
    }

    const iconoEstado = (e) =>
      ({
        PLANIFICADO: "ph-hourglass",
        EN_PROGRESO: "ph-play-circle",
        PAUSADO: "ph-pause-circle",
        COMPLETADO: "ph-check-circle",
        ARCHIVADO: "ph-archive",
      })[e] || "ph-folder";

    cont.innerHTML = ps.length
      ? ps
          .slice(0, 8)
          .map((p) => {
            const pct = Math.round(p.progreso || 0);
            const nombreJs = String(p.nombre || "").replace(/'/g, "\\'");
            return `
          <div class="proy-row">
            <div class="proy-ico">
              <i class="ph ${iconoEstado(p.estado)}"></i>
            </div>
            <div class="proy-info">
              <div class="proy-nombre">${_dashEsc(p.nombre)}</div>
              <div class="proy-meta">${_dashEsc(p.descripcion || "Sin descripción")} · fin ${fFecha(p.fechaFinEstimada)}</div>
              <div class="proy-prog-wrap">
                <div class="prog" style="flex:1;height:4px"><div class="prog-bar" style="width:${pct}%"></div></div>
                <span class="proy-pct">${pct}%</span>
              </div>
            </div>
            ${badgeEstado(p.estado)}
            <div class="flex" style="gap:5px">
              <button class="btn btn-outline btn-xs" onclick="irTablero('${p.id}','${nombreJs}')">
                <i class="ph ph-kanban"></i> Tablero
              </button>
              <button class="btn btn-outline btn-xs" onclick="abrirJerarquiaProyecto('${p.id}')">
                <i class="ph ph-tree-structure"></i> Estructura
              </button>
              ${
                S.usuario.rol !== "DEVELOPER"
                  ? `
                <button class="btn btn-ghost btn-xs" onclick="abrirInvitar('${p.id}')" title="Invitar miembro">
                  <i class="ph ph-user-plus"></i>
                </button>`
                  : ""
              }
            </div>
          </div>`;
          })
          .join("")
      : `<div class="vacío">
          <i class="ph ph-folder-open" style="font-size:36px;display:block;margin-bottom:10px;opacity:.25"></i>
          No tienes proyectos aún
         </div>`;
  } catch (e) {
    cont.innerHTML = `<div class="vacío">Error: ${_dashEsc(e.message)}</div>`;
  }
}

/* ══════════════════════════════════════════════════
   MENCIONES @usuario en comentarios
══════════════════════════════════════════════════ */

let _usuariosMencion = []; // cache de usuarios para autocomplete
let _tareaComentarioId = null;
let _paginaComentarios = 1;
const _LIMITE_COMENTARIOS = 15;

async function _cargarUsuariosMencion() {
  if (_usuariosMencion.length) return;
  try {
    const lista = await api("GET", "/usuarios/activos");
    _usuariosMencion = lista.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      token: u.nombre.toLowerCase().replace(/\s+/g, ""),
    }));
  } catch (_) {}
}

/* Input con autocomplete de menciones */
function iniciarInputMenciones(inputId, sugerenciasId) {
  const input = document.getElementById(inputId);
  const sug = document.getElementById(sugerenciasId);
  if (!input || !sug) return;

  let _idx = -1;

  input.addEventListener("input", async () => {
    const val = input.value;
    const pos = input.selectionStart;
    // Buscar @ antes del cursor
    const antes = val.slice(0, pos);
    const match = antes.match(/@([\w\.]*)$/);
    if (!match) {
      sug.classList.remove("visible");
      return;
    }

    await _cargarUsuariosMencion();
    const query = match[1].toLowerCase();
    const filtrados = _usuariosMencion
      .filter(
        (u) => u.token.includes(query) || u.email.toLowerCase().includes(query),
      )
      .slice(0, 6);

    if (!filtrados.length) {
      sug.classList.remove("visible");
      return;
    }

    sug.innerHTML = filtrados
      .map(
        (u, i) => `
      <div class="sug-item" data-i="${i}" data-nombre="${u.nombre}" onclick="_insertarMencion('${inputId}','${sugerenciasId}','${u.nombre}')">
        <div class="avatar avatar-sm">${inic(u.nombre)}</div>
        <div>
          <div style="font-size:12px;font-weight:500">${u.nombre}</div>
          <div class="txt3">${u.email}</div>
        </div>
      </div>`,
      )
      .join("");
    sug.classList.add("visible");
    _idx = -1;
  });

  input.addEventListener("keydown", (e) => {
    if (!sug.classList.contains("visible")) return;
    const items = sug.querySelectorAll(".sug-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      _idx = Math.min(_idx + 1, items.length - 1);
      _resaltarSug(items, _idx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      _idx = Math.max(_idx - 1, 0);
      _resaltarSug(items, _idx);
    } else if (e.key === "Enter" && _idx >= 0) {
      e.preventDefault();
      const nombre = items[_idx]?.dataset.nombre;
      if (nombre) _insertarMencion(inputId, sugerenciasId, nombre);
    } else if (e.key === "Escape") {
      sug.classList.remove("visible");
    }
  });

  document.addEventListener("click", (e) => {
    if (!sug.contains(e.target) && e.target !== input)
      sug.classList.remove("visible");
  });
}

function _resaltarSug(items, idx) {
  items.forEach((it, i) => it.classList.toggle("activo", i === idx));
}

function _insertarMencion(inputId, sugerenciasId, nombre) {
  const input = document.getElementById(inputId);
  const sug = document.getElementById(sugerenciasId);
  if (!input) return;
  const val = input.value;
  const pos = input.selectionStart;
  const antes = val.slice(0, pos);
  // Reemplazar @parcial por @nombre completo + espacio
  const nuevo = antes.replace(/@[\w\.]*$/, `@${nombre} `) + val.slice(pos);
  input.value = nuevo;
  input.focus();
  sug.classList.remove("visible");
}

/* ── PANEL DE COMENTARIOS ── */
async function abrirPanelComentarios(tareaId, tituloTarea) {
  _tareaComentarioId = tareaId;
  _paginaComentarios = 1;

  // Crear o reusar modal de comentarios
  let modal = document.getElementById("mComentarios");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "overlay";
    modal.id = "mComentarios";
    modal.innerHTML = `
      <div class="modal" style="width:580px;max-height:80vh;display:flex;flex-direction:column">
        <div class="flex-between" style="margin-bottom:16px">
          <div class="modal-t" style="margin-bottom:0" id="mComTitulo">Comentarios</div>
          <button class="btn btn-ghost btn-xs" onclick="cerrarModal('mComentarios')">✕</button>
        </div>
        <div id="listaComentarios" style="flex:1;overflow-y:auto;min-height:120px" class="vacío">Cargando...</div>
        <div id="pagComentarios" style="margin-top:4px"></div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--borde)">
          <div class="input-menciones-wrap">
            <textarea class="ftextarea" id="nuevoComentario"
              placeholder="Escribe un comentario... usa @nombre para mencionar"
              style="min-height:68px;resize:none"></textarea>
            <div class="sugerencias-menciones" id="sugComentario"></div>
          </div>
          <div class="flex-between" style="margin-top:8px">
            <span class="txt3" style="font-size:10px">@ para mencionar usuarios</span>
            <button class="btn btn-primary btn-sm" onclick="enviarComentario()">Enviar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) cerrarModal("mComentarios");
    });
  }

  document.getElementById("mComTitulo").textContent =
    `Comentarios · ${tituloTarea}`;
  abrirModal("mComentarios");
  await _cargarUsuariosMencion();
  iniciarInputMenciones("nuevoComentario", "sugComentario");
  await _cargarComentariosPaginados(tareaId, 1);
}

async function _cargarComentariosPaginados(tareaId, pagina) {
  const lista = document.getElementById("listaComentarios");
  const pagEl = document.getElementById("pagComentarios");
  if (!lista) return;
  lista.innerHTML = '<span class="spinner"></span>';
  try {
    const res = await api(
      "GET",
      `/tareas/${tareaId}/comentarios?pagina=${pagina}&limite=${_LIMITE_COMENTARIOS}`,
    );
    _paginaComentarios = pagina;
    const comentarios = res.datos || res; // compatibilidad si backend aún devuelve array

    if (!comentarios.length) {
      lista.innerHTML =
        '<div class="vacío">Sin comentarios aún. ¡Sé el primero!</div>';
    } else {
      const mapaU = await _obtenerMapaUsuarios();
      lista.innerHTML = comentarios
        .map((c) => {
          const u = mapaU[c.autorId];
          const nombre = u ? u.nombre : `ID:${c.autorId.slice(-6)}`;
          const av = `<div class="avatar avatar-sm">${inic(nombre)}</div>`;
          const html = c.contenidoHtml || c.contenido;
          return `<div class="comentario-item">
          <div class="comentario-header">
            ${av}
            <span class="comentario-autor">${nombre}</span>
            <span class="comentario-fecha">${fFecha(c.creadoEn)}</span>
          </div>
          <div class="comentario-cuerpo">${html}</div>
        </div>`;
        })
        .join("");
    }

    // Paginación
    if (res.totalPaginas > 1) {
      pagEl.innerHTML = _renderizarPaginacion(
        res.pagina,
        res.totalPaginas,
        (p) => _cargarComentariosPaginados(tareaId, p),
      );
    } else {
      pagEl.innerHTML = "";
    }
  } catch (e) {
    lista.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
  }
}

async function enviarComentario() {
  const input = document.getElementById("nuevoComentario");
  if (!input) return;
  const texto = input.value.trim();
  if (!texto || !_tareaComentarioId) return;
  const btn = document.querySelector("#mComentarios .btn-primary");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "...";
  }
  try {
    await api("POST", `/tareas/${_tareaComentarioId}/comentarios`, {
      contenido: texto,
    });
    input.value = "";
    await _cargarComentariosPaginados(_tareaComentarioId, _paginaComentarios);
    toast("Comentario enviado");
  } catch (e) {
    toast(e.message, "err");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Enviar";
    }
  }
}

/* ══════════════════════════════════════════════════
   PAGINACIÓN GENÉRICA (reutilizable)
══════════════════════════════════════════════════ */
function _renderizarPaginacion(paginaActual, totalPaginas, onCambio) {
  if (totalPaginas <= 1) return "";
  const btns = [];

  // Anterior
  btns.push(`<button class="pag-btn" ${paginaActual <= 1 ? "disabled" : ""}
    onclick="(${onCambio.toString()})(${paginaActual - 1})">‹</button>`);

  // Páginas cercanas
  const inicio = Math.max(1, paginaActual - 2);
  const fin = Math.min(totalPaginas, paginaActual + 2);
  if (inicio > 1)
    btns.push(
      `<button class="pag-btn" onclick="(${onCambio.toString()})(1)">1</button>`,
    );
  if (inicio > 2) btns.push(`<span class="pag-info">…</span>`);
  for (let i = inicio; i <= fin; i++) {
    btns.push(`<button class="pag-btn ${i === paginaActual ? "activo" : ""}"
      onclick="(${onCambio.toString()})(${i})">${i}</button>`);
  }
  if (fin < totalPaginas - 1) btns.push(`<span class="pag-info">…</span>`);
  if (fin < totalPaginas)
    btns.push(
      `<button class="pag-btn" onclick="(${onCambio.toString()})(${totalPaginas})">${totalPaginas}</button>`,
    );

  // Siguiente
  btns.push(`<button class="pag-btn" ${paginaActual >= totalPaginas ? "disabled" : ""}
    onclick="(${onCambio.toString()})(${paginaActual + 1})">›</button>`);

  return `<div class="paginacion">${btns.join("")}
    <span class="pag-info">Pág ${paginaActual} / ${totalPaginas}</span>
  </div>`;
}

/* Paginación para la vista de Tareas (tabla) */
let _paginaTareas = 1;
const _LIMITE_TAREAS = 20;
let _estructuraTareasProyecto = null;
let _subtareasEtapaProyecto = [];

function _escTxt(valor = "") {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function _poblarFiltrosEstructuraTareas(estructura) {
  const selFase = document.getElementById("fTareaFase");
  const selEtapa = document.getElementById("fTareaEtapa");
  if (!selFase || !selEtapa) return;

  const fases = Array.isArray(estructura?.fases) ? estructura.fases : [];
  const faseActual = selFase.value || "";
  const etapaActual = selEtapa.value || "";

  selFase.innerHTML =
    '<option value="">— Fase —</option>' +
    fases
      .map(
        (fase) => `<option value="${fase.id}">${_escTxt(fase.nombre)}</option>`,
      )
      .join("");
  selFase.value = fases.some((fase) => fase.id === faseActual)
    ? faseActual
    : "";

  const etapas = selFase.value
    ? estructura?.etapasPorFase?.[selFase.value] || []
    : [];
  selEtapa.innerHTML =
    '<option value="">— Etapa —</option>' +
    etapas
      .map(
        (etapa) =>
          `<option value="${etapa.id}">${_escTxt(etapa.nombre)}</option>`,
      )
      .join("");
  selEtapa.value = etapas.some((etapa) => etapa.id === etapaActual)
    ? etapaActual
    : "";
}

function _htmlContextoTarea(tarea) {
  const { fase, etapa } = resolverContextoEstructura(
    _estructuraTareasProyecto,
    tarea.faseId,
    tarea.etapaId,
  );
  const badges = [];
  if (fase)
    badges.push(`<span class="badge ba">${_escTxt(fase.nombre)}</span>`);
  if (etapa)
    badges.push(`<span class="badge bi">${_escTxt(etapa.nombre)}</span>`);
  return badges.length
    ? badges.join(" ")
    : '<span class="txt3">Sin fase/etapa</span>';
}

function _htmlResponsablesIds(responsables = []) {
  const resps = (responsables || [])
    .map((id) => {
      const m = miembrosActuales.find((miembro) => miembro.id === id);
      return `<div class="avatar avatar-sm" title="${_escTxt(m?.nombre || id)}">${inic(m?.nombre || "?")}</div>`;
    })
    .join("");
  return `<div class="avatar-group">${resps || '<span class="txt3">—</span>'}</div>`;
}

function _contextoDesdeSubtareaEtapa(subtarea) {
  const { fase, etapa } = resolverContextoEstructura(
    _estructuraTareasProyecto,
    subtarea.faseId,
    subtarea.etapaId,
  );
  const faseNombre = subtarea.faseNombre || fase?.nombre;
  const etapaNombre = subtarea.etapaNombre || etapa?.nombre;
  const badges = [];
  if (faseNombre)
    badges.push(`<span class="badge ba">${_escTxt(faseNombre)}</span>`);
  if (etapaNombre)
    badges.push(`<span class="badge bi">${_escTxt(etapaNombre)}</span>`);
  return badges.length
    ? badges.join(" ")
    : '<span class="txt3">Sin fase/etapa</span>';
}

function _filtrarSubtareasEtapaProyecto(faseId, etapaId) {
  return (_subtareasEtapaProyecto || []).filter((sub) => {
    if (faseId && sub.faseId !== faseId) return false;
    if (etapaId && sub.etapaId !== etapaId) return false;
    return true;
  });
}

function _renderFilasSubtareasEtapa(subtareasEtapa) {
  if (!subtareasEtapa.length) return "";

  const encabezado = `<tr><td colspan="7" class="txt3" style="font-size:11px;padding-top:14px">Subtareas de etapa (${subtareasEtapa.length})</td></tr>`;
  const filas = subtareasEtapa
    .map((s) => {
      const estado = s.completada
        ? '<span class="badge bg">Completada</span>'
        : '<span class="badge ba">Pendiente</span>';
      return `<tr>
        <td style="color:var(--txt);font-weight:500">
          <span class="txt3" style="font-size:11px">↳</span> ${_escTxt(s.titulo)}
        </td>
        <td><span class="badge bm">subtarea etapa</span></td>
        <td><span class="txt3">—</span></td>
        <td>${_contextoDesdeSubtareaEtapa(s)}</td>
        <td>${_htmlResponsablesIds(s.responsables || [])}</td>
        <td>${estado}</td>
        <td>
          <div class="flex" style="gap:4px">
            <button class="btn btn-outline btn-xs" onclick="toggleSubtareaEtapaDesdeTareas('${s.id}')">
              ${s.completada ? "Reabrir" : "Completar"}
            </button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
  return encabezado + filas;
}

async function toggleSubtareaEtapaDesdeTareas(subtareaId) {
  try {
    await api("POST", `/subtareas/${subtareaId}/toggle`);
    await cargarTareasPaginadas(proyActualId, _paginaTareas || 1);
    toast("Subtarea actualizada");
  } catch (e) {
    toast(e.message, "err");
  }
}

async function onCambioFiltroFaseTareas() {
  if (!_estructuraTareasProyecto) return;
  _poblarFiltrosEstructuraTareas(_estructuraTareasProyecto);
  if (proyActualId) await cargarTareasPaginadas(proyActualId, 1);
}

async function onCambioFiltroEtapaTareas() {
  if (proyActualId) await cargarTareasPaginadas(proyActualId, 1);
}

async function cargarTareasPaginadas(proyId, pagina) {
  if (!proyId) {
    proyActualId = null;
    _estructuraTareasProyecto = null;
    _subtareasEtapaProyecto = [];
    const tbVacio = document.getElementById("tbTareas");
    const pagVacio = document.getElementById("pagTareas");
    const selFase = document.getElementById("fTareaFase");
    const selEtapa = document.getElementById("fTareaEtapa");
    if (selFase) selFase.innerHTML = '<option value="">— Fase —</option>';
    if (selEtapa) selEtapa.innerHTML = '<option value="">— Etapa —</option>';
    if (tbVacio) {
      tbVacio.innerHTML =
        '<tr><td colspan="7" class="vacío">Selecciona un proyecto para ver las tareas</td></tr>';
    }
    if (pagVacio) pagVacio.innerHTML = "";
    return;
  }
  proyActualId = proyId;
  _paginaTareas = pagina || 1;

  const tb = document.getElementById("tbTareas");
  const pagEl = document.getElementById("pagTareas");
  if (tb)
    tb.innerHTML =
      '<tr><td colspan="7" class="vacío"><span class="spinner"></span></td></tr>';

  try {
    const [tableros, todos, estructura, subtareasEtapaProyecto] =
      await Promise.all([
        api("GET", `/proyectos/${proyId}/tableros`).catch(() => []),
        api("GET", "/usuarios/activos").catch(() => []),
        cargarEstructuraProyecto(proyId).catch(() => ({
          fases: [],
          fasesPorId: {},
          etapasPorFase: {},
          etapasPorId: {},
        })),
        api("GET", `/proyectos/${proyId}/subtareas-etapa`).catch(() => []),
      ]);

    colsActuales = tableros[0]?.columnas || [];
    miembrosActuales = todos
      .filter((u) => u.rol === "DEVELOPER")
      .map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol }));
    _estructuraTareasProyecto = estructura;
    _subtareasEtapaProyecto = Array.isArray(subtareasEtapaProyecto)
      ? subtareasEtapaProyecto
      : [];
    _poblarFiltrosEstructuraTareas(estructura);

    const faseId = document.getElementById("fTareaFase")?.value || "";
    const etapaId = document.getElementById("fTareaEtapa")?.value || "";
    const subtareasEtapaFiltradas = _filtrarSubtareasEtapaProyecto(
      faseId,
      etapaId,
    );
    const params = new URLSearchParams({
      pagina: String(_paginaTareas),
      limite: String(_LIMITE_TAREAS),
    });
    if (faseId) params.set("fase_id", faseId);
    if (etapaId) params.set("etapa_id", etapaId);

    const res = await api(
      "GET",
      `/proyectos/${proyId}/tareas?${params.toString()}`,
    );
    const ts = res.datos || res;

    if (!ts.length && !subtareasEtapaFiltradas.length) {
      tb.innerHTML =
        '<tr><td colspan="7" class="vacío">Sin tareas ni subtareas de etapa para el filtro seleccionado</td></tr>';
      if (pagEl) pagEl.innerHTML = "";
      return;
    }

    const filasTareas = ts
      .map((t) => {
        return `<tr>
        <td style="color:var(--txt);font-weight:500;cursor:pointer" onclick="abrirPanelComentarios('${t.id}','${t.titulo.replace(/'/g, "\\'")}')">
          ${t.titulo}
        </td>
        <td>${badgeTipo(t.tipo)}</td>
        <td>${badgePrio(t.prioridad)}</td>
        <td>${_htmlContextoTarea(t)}</td>
        <td>${_htmlResponsablesIds(t.responsables || [])}</td>
        <td>${t.estaVencida ? '<span class="badge br">Vencida</span>' : '<span class="badge bg">Activa</span>'}</td>
        <td><div class="flex" style="gap:4px">
          <button class="btn btn-outline btn-xs" onclick="abrirPanelComentarios('${t.id}','${t.titulo.replace(/'/g, "\\'")}')">💬</button>
          <button class="btn btn-outline btn-xs" title="Subtareas y jerarquía" onclick="abrirPanelSubtareas('${t.id}','${t.titulo.replace(/'/g, "\\'")}')"><i class="ph ph-tree-structure"></i></button>
          <button class="btn btn-outline btn-xs" onclick="abrirEditarTarea('${t.id}')"><i class="ph ph-pencil-simple"></i></button>
          <button class="btn btn-outline btn-xs" onclick="abrirAsignar('${t.id}')">Asignar</button>
          <button class="btn btn-outline btn-xs" onclick="clonarTarea('${t.id}')">Clonar</button>
          <button class="btn btn-red btn-xs" onclick="eliminarTarea('${t.id}')">✕</button>
        </div></td>
      </tr>`;
      })
      .join("");
    const filasSubtareasEtapa = _renderFilasSubtareasEtapa(
      subtareasEtapaFiltradas,
    );
    tb.innerHTML = filasTareas + filasSubtareasEtapa;

    // Paginación de tareas
    if (pagEl && res.totalPaginas > 1) {
      pagEl.innerHTML = _renderizarPaginacion(
        res.pagina,
        res.totalPaginas,
        (p) => cargarTareasPaginadas(proyId, p),
      );
    } else if (pagEl) {
      pagEl.innerHTML = "";
    }
  } catch (e) {
    if (tb)
      tb.innerHTML = `<tr><td colspan="7" class="vacío">Error: ${e.message}</td></tr>`;
  }
}
