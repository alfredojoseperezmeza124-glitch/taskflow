/* ═══════════════════════════════════════════════════
   TaskFlow — vistas.js
   Lógica de cada pantalla: proyectos, tareas, usuarios,
   reportes, historial, notificaciones, perfil
════════════════════════════════════════════════════ */

/* ══════════ DASHBOARD ══════════ */
/* cargarDashboard movido a dashboard.js */

/* ══════════ PROYECTOS ══════════ */
const _REGLAS_DECORATOR_DEFAULTS = {
  auditoriaEnriquecidaActiva: true,
  notificacionAutomaticaActiva: true,
  validacionSlaActiva: true,
  maxHorasPorTarea: 80,
  notificarBugUrgenteAlPm: true,
  validarHorasAntesDeMoverEnProgreso: true,
};

function _toggleSet(id, activo) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("on", !!activo);
}

function _toggleGet(id) {
  return !!document.getElementById(id)?.classList.contains("on");
}

let _jerarquiaProyectoId = null;
let _jerarquiaProyectoData = null;
let _jerarquiaNodoPorId = {};
let _jpModalFaseProyectoId = null;
let _jpModalEtapaFaseId = null;
let _jpModalSubtareaEtapaId = null;
let _jpModalEditarTipo = null;
let _jpModalEditarNodoId = null;
let _jpModalEliminarTipo = null;
let _jpModalEliminarNodoId = null;

function _puedeEditarEstructuraProyecto() {
  return ["PROJECT_MANAGER", "ADMIN"].includes(S?.usuario?.rol);
}

function _puedeGestionarSubtareasEtapa() {
  return ["DEVELOPER", "PROJECT_MANAGER", "ADMIN"].includes(S?.usuario?.rol);
}

function _jpEsc(txt) {
  return String(txt || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function _jpIconoCategoria(categoria) {
  const mapa = {
    PROYECTO: "ph-folder-open",
    FASE: "ph-flag-banner",
    ETAPA: "ph-signpost",
    SUBTAREA: "ph-check-square-offset",
  };
  return mapa[categoria] || "ph-tree-structure";
}

function _jpColorBadge(categoria) {
  const mapa = {
    PROYECTO: "bb",
    FASE: "ba",
    ETAPA: "bi",
    SUBTAREA: "bg",
  };
  return mapa[categoria] || "bm";
}

function _jpSetError(msg = "") {
  const err = document.getElementById("proyJerarquiaError");
  if (err) err.textContent = msg;
}

function _jpRenderStats(nodo) {
  const el = document.getElementById("proyJerarquiaStats");
  if (!el) return;
  if (!nodo) {
    el.textContent = "—";
    return;
  }
  const progreso = Number(nodo.progreso || 0).toFixed(1);
  const horas = Number(nodo.horasEstimadas || 0).toFixed(1);
  const responsables = (nodo.responsables || []).length;
  el.innerHTML = `
    <span class="badge bb">Progreso ${progreso}%</span>
    <span class="badge bi">Horas ${horas}h</span>
    <span class="badge ba">Responsables ${responsables}</span>
  `;
}

function _jpContarNodos(nodo) {
  if (!nodo) return 0;
  const hijos = Array.isArray(nodo.hijos) ? nodo.hijos : [];
  return 1 + hijos.reduce((acc, h) => acc + _jpContarNodos(h), 0);
}

function _jpIndexarNodos(nodo) {
  if (!nodo || typeof nodo !== "object") return;
  if (nodo.id) _jerarquiaNodoPorId[nodo.id] = nodo;
  (nodo.hijos || []).forEach((h) => _jpIndexarNodos(h));
}

function _jpRenderNodo(nodo, nivel = 0) {
  if (!nodo || typeof nodo !== "object") return "";
  const categoria = String(nodo.categoria || "NODO").toUpperCase();
  const hijos = Array.isArray(nodo.hijos) ? nodo.hijos : [];
  const icono = _jpIconoCategoria(categoria);
  const progreso = Number(nodo.progreso || 0).toFixed(1);
  const horas = Number(nodo.horasEstimadas || 0).toFixed(1);
  const responsables = (nodo.responsables || []).length;
  const badge = _jpColorBadge(categoria);
  const titulo = _jpEsc(nodo.titulo || categoria);
  const idCorto = _jpEsc(String(nodo.id || "").slice(-8));

  const acciones = [];
  if (categoria === "PROYECTO" && _puedeEditarEstructuraProyecto()) {
    acciones.push(
      `<button class="btn btn-outline btn-xs" onclick="jpAccion('crear-fase','${nodo.id}')"><i class="ph ph-plus"></i> Fase</button>`,
    );
  }
  if (categoria === "FASE") {
    if (_puedeEditarEstructuraProyecto()) {
      acciones.push(
        `<button class="btn btn-outline btn-xs" onclick="jpAccion('crear-etapa','${nodo.id}')"><i class="ph ph-plus"></i> Etapa</button>`,
      );
      acciones.push(
        `<button class="btn btn-ghost btn-xs" onclick="jpAccion('editar-fase','${nodo.id}')"><i class="ph ph-pencil-simple"></i></button>`,
      );
      acciones.push(
        `<button class="btn btn-red btn-xs" onclick="jpAccion('eliminar-fase','${nodo.id}')"><i class="ph ph-trash"></i></button>`,
      );
    }
  }
  if (categoria === "ETAPA") {
    if (_puedeGestionarSubtareasEtapa()) {
      acciones.push(
        `<button class="btn btn-outline btn-xs" onclick="jpAccion('crear-subtarea','${nodo.id}')"><i class="ph ph-plus"></i> Subtarea</button>`,
      );
    }
    if (_puedeEditarEstructuraProyecto()) {
      acciones.push(
        `<button class="btn btn-ghost btn-xs" onclick="jpAccion('editar-etapa','${nodo.id}')"><i class="ph ph-pencil-simple"></i></button>`,
      );
      acciones.push(
        `<button class="btn btn-red btn-xs" onclick="jpAccion('eliminar-etapa','${nodo.id}')"><i class="ph ph-trash"></i></button>`,
      );
    }
  }
  if (categoria === "SUBTAREA" && _puedeGestionarSubtareasEtapa()) {
    acciones.push(
      `<button class="btn btn-outline btn-xs" onclick="jpAccion('toggle-subtarea','${nodo.id}')"><i class="ph ph-check"></i></button>`,
    );
    acciones.push(
      `<button class="btn btn-red btn-xs" onclick="jpAccion('eliminar-subtarea','${nodo.id}')"><i class="ph ph-trash"></i></button>`,
    );
  }

  return `
    <div class="jp-node" style="margin-left:${nivel * 14}px">
      <div class="jp-node-head">
        <div class="jp-node-main">
          <i class="ph ${icono} jp-node-ico"></i>
          <div class="jp-node-body">
            <div class="jp-node-title">${titulo}</div>
            <div class="jp-node-meta">ID ${idCorto}</div>
          </div>
        </div>
        <div class="jp-node-badges">
          <span class="badge ${badge}">${categoria}</span>
          <span class="badge bi">${horas}h</span>
          <span class="badge bb">${progreso}%</span>
          <span class="badge ba">${responsables}</span>
        </div>
      </div>
      ${
        acciones.length
          ? `<div class="jp-node-actions">${acciones.join("")}</div>`
          : ""
      }
      ${
        hijos.length
          ? `<div class="jp-node-children">${hijos.map((h) => _jpRenderNodo(h, nivel + 1)).join("")}</div>`
          : ""
      }
    </div>
  `;
}

async function _jpCargarJerarquia(proyectoId, silencioso = false) {
  const arbol = document.getElementById("proyJerarquiaArbol");
  if (!arbol) return;

  _jpSetError("");
  if (!proyectoId) {
    _jerarquiaProyectoId = null;
    _jerarquiaProyectoData = null;
    _jerarquiaNodoPorId = {};
    _jpRenderStats(null);
    arbol.innerHTML =
      '<div class="vacío">Selecciona un proyecto para visualizar fases, etapas y subtareas.</div>';
    return;
  }

  if (!silencioso) {
    arbol.innerHTML = '<div class="vacío"><span class="spinner"></span></div>';
  }

  try {
    const jerarquia = await api("GET", `/proyectos/${proyectoId}/jerarquia`);
    invalidarCacheEstructuraProyecto(proyectoId);
    _jerarquiaProyectoId = proyectoId;
    _jerarquiaProyectoData = jerarquia;
    _jerarquiaNodoPorId = {};
    _jpIndexarNodos(jerarquia);
    _jpRenderStats(jerarquia);
    const totalNodos = _jpContarNodos(jerarquia);
    arbol.innerHTML = `
      <div class="txt3" style="font-size:11px;margin-bottom:10px">
        Nodos totales: <strong style="color:var(--t1)">${totalNodos}</strong>
      </div>
      ${_jpRenderNodo(jerarquia, 0)}
    `;
  } catch (e) {
    _jpSetError(e.message || "No se pudo cargar la jerarquía");
    _jpRenderStats(null);
    arbol.innerHTML = `<div class="vacío">No se pudo cargar la jerarquía del proyecto.</div>`;
  }
}

async function seleccionarProyectoJerarquia(proyectoId) {
  await _jpCargarJerarquia(proyectoId);
}

async function refrescarJerarquiaProyecto() {
  const sel = document.getElementById("selJerarquiaProy");
  const proyectoId = sel?.value || _jerarquiaProyectoId;
  if (!proyectoId) {
    toast("Selecciona un proyecto primero", "err");
    return;
  }
  await _jpCargarJerarquia(proyectoId);
}

async function abrirJerarquiaProyecto(proyectoId) {
  if (!proyectoId) return;
  mostrarPantalla("proyectos");
  setTimeout(async () => {
    const sel = document.getElementById("selJerarquiaProy");
    if (sel) sel.value = proyectoId;
    await _jpCargarJerarquia(proyectoId);
    document
      .getElementById("proyJerarquiaCard")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

function abrirModalCrearFaseJerarquia(proyectoId = null) {
  if (!_puedeEditarEstructuraProyecto()) {
    toast("No tienes permisos para crear fases", "err");
    return;
  }
  const proyId =
    proyectoId ||
    document.getElementById("selJerarquiaProy")?.value ||
    _jerarquiaProyectoId;
  if (!proyId) {
    toast("Selecciona un proyecto primero", "err");
    return;
  }
  _jpModalFaseProyectoId = proyId;
  const proyecto = (_jerarquiaProyectoData && _jerarquiaProyectoData.id === proyId)
    ? _jerarquiaProyectoData
    : _jerarquiaNodoPorId[proyId];
  document.getElementById("jfProyectoId").value = proyId;
  document.getElementById("jfProyectoLabel").textContent = proyecto?.titulo || proyId;
  document.getElementById("jfNombre").value = "";
  document.getElementById("jfDesc").value = "";
  document.getElementById("jfError").textContent = "";
  abrirModal("mJerarquiaFase");
  setTimeout(() => document.getElementById("jfNombre")?.focus(), 60);
}

async function confirmarCrearFaseJerarquia() {
  const proyectoId = document.getElementById("jfProyectoId").value || _jpModalFaseProyectoId;
  const nombre = document.getElementById("jfNombre").value.trim();
  const descripcion = document.getElementById("jfDesc").value.trim();
  const errEl = document.getElementById("jfError");
  if (errEl) errEl.textContent = "";
  if (!proyectoId) {
    if (errEl) errEl.textContent = "Proyecto no seleccionado";
    return;
  }
  if (!nombre) {
    if (errEl) errEl.textContent = "El nombre de la fase es obligatorio";
    return;
  }
  try {
    await api("POST", `/proyectos/${proyectoId}/fases`, {
      nombre,
      descripcion: descripcion || null,
    });
    invalidarCacheEstructuraProyecto(proyectoId);
    cerrarModal("mJerarquiaFase");
    toast("Fase creada");
    await _jpCargarJerarquia(proyectoId, true);
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}

function abrirModalCrearEtapaJerarquia(faseId) {
  if (!_puedeEditarEstructuraProyecto()) {
    toast("No tienes permisos para crear etapas", "err");
    return;
  }
  if (!faseId) {
    toast("Fase no válida", "err");
    return;
  }
  _jpModalEtapaFaseId = faseId;
  const fase = _jerarquiaNodoPorId[faseId] || {};
  document.getElementById("jeFaseId").value = faseId;
  document.getElementById("jeFaseLabel").textContent = fase.titulo || faseId;
  document.getElementById("jeNombre").value = "";
  document.getElementById("jeDesc").value = "";
  document.getElementById("jeError").textContent = "";
  abrirModal("mJerarquiaEtapa");
  setTimeout(() => document.getElementById("jeNombre")?.focus(), 60);
}

async function confirmarCrearEtapaJerarquia() {
  const faseId = document.getElementById("jeFaseId").value || _jpModalEtapaFaseId;
  const nombre = document.getElementById("jeNombre").value.trim();
  const descripcion = document.getElementById("jeDesc").value.trim();
  const errEl = document.getElementById("jeError");
  if (errEl) errEl.textContent = "";
  if (!faseId) {
    if (errEl) errEl.textContent = "Fase no seleccionada";
    return;
  }
  if (!nombre) {
    if (errEl) errEl.textContent = "El nombre de la etapa es obligatorio";
    return;
  }
  const proyectoId = _jerarquiaProyectoId || document.getElementById("selJerarquiaProy")?.value || "";
  try {
    await api("POST", `/proyectos/fases/${faseId}/etapas`, {
      nombre,
      descripcion: descripcion || null,
    });
    if (proyectoId) invalidarCacheEstructuraProyecto(proyectoId);
    cerrarModal("mJerarquiaEtapa");
    toast("Etapa creada");
    await _jpCargarJerarquia(proyectoId, true);
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}

function abrirModalCrearSubtareaEtapaJerarquia(etapaId) {
  if (!_puedeGestionarSubtareasEtapa()) {
    toast("No tienes permisos para crear subtareas", "err");
    return;
  }
  if (!etapaId) {
    toast("Etapa no válida", "err");
    return;
  }
  _jpModalSubtareaEtapaId = etapaId;
  const etapa = _jerarquiaNodoPorId[etapaId] || {};
  document.getElementById("jsEtapaId").value = etapaId;
  document.getElementById("jsEtapaLabel").textContent = etapa.titulo || etapaId;
  document.getElementById("jsTitulo").value = "";
  document.getElementById("jsDesc").value = "";
  document.getElementById("jsError").textContent = "";
  abrirModal("mJerarquiaSubtareaEtapa");
  setTimeout(() => document.getElementById("jsTitulo")?.focus(), 60);
}

async function confirmarCrearSubtareaEtapaJerarquia() {
  const etapaId = document.getElementById("jsEtapaId").value || _jpModalSubtareaEtapaId;
  const titulo = document.getElementById("jsTitulo").value.trim();
  const descripcion = document.getElementById("jsDesc").value.trim();
  const errEl = document.getElementById("jsError");
  if (errEl) errEl.textContent = "";
  if (!etapaId) {
    if (errEl) errEl.textContent = "Etapa no seleccionada";
    return;
  }
  if (!titulo) {
    if (errEl) errEl.textContent = "El título de la subtarea es obligatorio";
    return;
  }
  const proyectoId = _jerarquiaProyectoId || document.getElementById("selJerarquiaProy")?.value || "";
  try {
    await api("POST", `/etapas/${etapaId}/subtareas`, {
      titulo,
      descripcion: descripcion || null,
    });
    cerrarModal("mJerarquiaSubtareaEtapa");
    toast("Subtarea creada en etapa");
    await _jpCargarJerarquia(proyectoId, true);
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}

function abrirModalEditarNodoJerarquia(tipo, nodoId) {
  if (!_puedeEditarEstructuraProyecto()) {
    toast("No tienes permisos para editar esta estructura", "err");
    return;
  }
  const tipoNormalizado = String(tipo || "").toLowerCase() === "fase" ? "fase" : "etapa";
  const nodo = _jerarquiaNodoPorId[nodoId];
  if (!nodo) {
    toast("Elemento de jerarquía no encontrado", "err");
    return;
  }

  const nombreActual = String(nodo.titulo || "").trim();
  const titulo = tipoNormalizado === "fase" ? "Editar fase" : "Editar etapa";
  const label = tipoNormalizado === "fase" ? "Nombre de la fase" : "Nombre de la etapa";

  _jpModalEditarTipo = tipoNormalizado;
  _jpModalEditarNodoId = nodoId;
  document.getElementById("jEditTipo").value = tipoNormalizado;
  document.getElementById("jEditId").value = nodoId;
  document.getElementById("jEditNombreOriginal").value = nombreActual;
  document.getElementById("jEditTitulo").innerHTML =
    `<i class="ph ph-pencil-simple" style="color: var(--a)"></i> ${titulo}`;
  document.getElementById("jEditNombreLabel").textContent = label;
  document.getElementById("jEditNombre").value = nombreActual;
  document.getElementById("jEditError").textContent = "";

  abrirModal("mJerarquiaEditarNodo");
  setTimeout(() => document.getElementById("jEditNombre")?.focus(), 60);
}

async function confirmarEditarNodoJerarquia() {
  const tipo = document.getElementById("jEditTipo").value || _jpModalEditarTipo;
  const nodoId = document.getElementById("jEditId").value || _jpModalEditarNodoId;
  const original = document.getElementById("jEditNombreOriginal").value.trim();
  const nombre = document.getElementById("jEditNombre").value.trim();
  const errEl = document.getElementById("jEditError");
  if (errEl) errEl.textContent = "";

  if (!tipo || !nodoId) {
    if (errEl) errEl.textContent = "No se pudo identificar el elemento a editar";
    return;
  }
  if (!nombre) {
    if (errEl) errEl.textContent = "El nombre es obligatorio";
    return;
  }
  if (nombre === original) {
    cerrarModal("mJerarquiaEditarNodo");
    return;
  }

  const proyectoId = _jerarquiaProyectoId || document.getElementById("selJerarquiaProy")?.value || "";
  const endpoint = tipo === "fase" ? `/proyectos/fases/${nodoId}` : `/proyectos/etapas/${nodoId}`;
  const okMsg = tipo === "fase" ? "Fase actualizada" : "Etapa actualizada";
  try {
    await api("PUT", endpoint, { nombre });
    if (proyectoId) invalidarCacheEstructuraProyecto(proyectoId);
    cerrarModal("mJerarquiaEditarNodo");
    toast(okMsg);
    await _jpCargarJerarquia(proyectoId, true);
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}

function abrirModalEliminarNodoJerarquia(tipo, nodoId) {
  if (!_puedeEditarEstructuraProyecto()) {
    toast("No tienes permisos para eliminar esta estructura", "err");
    return;
  }
  const tipoNormalizado = String(tipo || "").toLowerCase() === "fase" ? "fase" : "etapa";
  const nodo = _jerarquiaNodoPorId[nodoId];
  if (!nodo) {
    toast("Elemento de jerarquía no encontrado", "err");
    return;
  }

  const nombre = String(nodo.titulo || "").trim() || nodoId;
  const titulo = tipoNormalizado === "fase" ? "Eliminar fase" : "Eliminar etapa";
  const mensaje = tipoNormalizado === "fase"
    ? `¿Eliminar la fase "${nombre}"? También se eliminarán sus etapas y subtareas.`
    : `¿Eliminar la etapa "${nombre}"? También se eliminarán sus subtareas.`;

  _jpModalEliminarTipo = tipoNormalizado;
  _jpModalEliminarNodoId = nodoId;
  document.getElementById("jDelTipo").value = tipoNormalizado;
  document.getElementById("jDelId").value = nodoId;
  document.getElementById("jDelTitulo").innerHTML =
    `<i class="ph ph-warning" style="color: #ef4444"></i> ${titulo}`;
  document.getElementById("jDelMensaje").textContent = mensaje;
  document.getElementById("jDelError").textContent = "";
  abrirModal("mJerarquiaEliminarNodo");
}

async function confirmarEliminarNodoJerarquia() {
  const tipo = document.getElementById("jDelTipo").value || _jpModalEliminarTipo;
  const nodoId = document.getElementById("jDelId").value || _jpModalEliminarNodoId;
  const errEl = document.getElementById("jDelError");
  if (errEl) errEl.textContent = "";

  if (!tipo || !nodoId) {
    if (errEl) errEl.textContent = "No se pudo identificar el elemento a eliminar";
    return;
  }

  const proyectoId = _jerarquiaProyectoId || document.getElementById("selJerarquiaProy")?.value || "";
  const endpoint = tipo === "fase" ? `/proyectos/fases/${nodoId}` : `/proyectos/etapas/${nodoId}`;
  const okMsg = tipo === "fase" ? "Fase eliminada" : "Etapa eliminada";
  try {
    await api("DELETE", endpoint);
    if (proyectoId) invalidarCacheEstructuraProyecto(proyectoId);
    cerrarModal("mJerarquiaEliminarNodo");
    toast(okMsg);
    await _jpCargarJerarquia(proyectoId, true);
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}

async function crearFaseJerarquia() {
  abrirModalCrearFaseJerarquia();
}

async function jpAccion(tipo, id) {
  const proyectoId = _jerarquiaProyectoId;
  if (!proyectoId) {
    toast("Selecciona un proyecto primero", "err");
    return;
  }

  try {
    if (tipo === "crear-fase") {
      return await crearFaseJerarquia();
    }

    if (tipo === "crear-etapa") {
      abrirModalCrearEtapaJerarquia(id);
      return;
    }

    if (tipo === "editar-fase") {
      abrirModalEditarNodoJerarquia("fase", id);
      return;
    }

    if (tipo === "eliminar-fase") {
      abrirModalEliminarNodoJerarquia("fase", id);
      return;
    }

    if (tipo === "editar-etapa") {
      abrirModalEditarNodoJerarquia("etapa", id);
      return;
    }

    if (tipo === "eliminar-etapa") {
      abrirModalEliminarNodoJerarquia("etapa", id);
      return;
    }

    if (tipo === "crear-subtarea") {
      abrirModalCrearSubtareaEtapaJerarquia(id);
      return;
    }

    if (tipo === "toggle-subtarea") {
      await api("POST", `/subtareas/${id}/toggle`);
      return await _jpCargarJerarquia(proyectoId, true);
    }

    if (tipo === "eliminar-subtarea") {
      if (!confirm("¿Eliminar esta subtarea?")) return;
      await api("DELETE", `/subtareas/${id}`);
      toast("Subtarea eliminada");
      return await _jpCargarJerarquia(proyectoId, true);
    }
  } catch (e) {
    toast(e.message, "err");
  }
}

function _jpSincronizarSelectorYPermisos(proyectos) {
  const sel = document.getElementById("selJerarquiaProy");
  const btnNuevaFase = document.getElementById("btnNuevaFaseJerarquia");
  if (!sel) return null;

  const opciones =
    '<option value="">— Selecciona un proyecto —</option>' +
    proyectos.map((p) => `<option value="${p.id}">${_jpEsc(p.nombre)}</option>`).join("");
  sel.innerHTML = opciones;

  if (btnNuevaFase) {
    btnNuevaFase.style.display = _puedeEditarEstructuraProyecto() ? "" : "none";
  }

  if (!proyectos.length) {
    sel.value = "";
    return "";
  }

  const existeSeleccion = proyectos.some((p) => p.id === _jerarquiaProyectoId);
  if (existeSeleccion) {
    sel.value = _jerarquiaProyectoId;
    return _jerarquiaProyectoId;
  }

  const porDefecto = proyActualId && proyectos.some((p) => p.id === proyActualId)
    ? proyActualId
    : proyectos[0].id;

  sel.value = porDefecto;
  _jerarquiaProyectoId = porDefecto;
  return porDefecto;
}

(function _jpInyectarEstilos() {
  if (document.getElementById("jpStyles")) return;
  const style = document.createElement("style");
  style.id = "jpStyles";
  style.textContent = `
    #proyJerarquiaArbol .jp-node{padding:8px;border:1px solid var(--b1);border-radius:8px;background:var(--s2);margin-bottom:8px}
    #proyJerarquiaArbol .jp-node-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
    #proyJerarquiaArbol .jp-node-main{display:flex;gap:8px;align-items:flex-start;min-width:0;flex:1}
    #proyJerarquiaArbol .jp-node-ico{font-size:15px;color:var(--a2);margin-top:1px}
    #proyJerarquiaArbol .jp-node-body{min-width:0;flex:1}
    #proyJerarquiaArbol .jp-node-title{font-size:12px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #proyJerarquiaArbol .jp-node-meta{font-size:10px;font-family:var(--mono);color:var(--t3)}
    #proyJerarquiaArbol .jp-node-badges{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
    #proyJerarquiaArbol .jp-node-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    #proyJerarquiaArbol .jp-node-children{margin-top:8px}
  `;
  document.head.appendChild(style);
})();

async function cargarProyectos() {
  if (!S) return;
  const acciones = document.getElementById("proyAcciones");
  if (S.usuario.rol === "PROJECT_MANAGER" || S.usuario.rol === "ADMIN") {
    acciones.innerHTML = `<button class="btn btn-primary btn-sm" onclick="abrirModal('mProy')"><i class="ph ph-plus"></i> Nuevo proyecto</button>`;
  } else if (acciones) {
    acciones.innerHTML = "";
  }
  const lista = document.getElementById("listaProyectos");
  if (lista) lista.innerHTML = "Cargando...";
  try {
    const ps = await api("GET", "/proyectos/");
    if (!ps.length) {
      document.getElementById("listaProyectos").innerHTML =
        '<div class="vacío">No hay proyectos</div>';
      _jpSincronizarSelectorYPermisos([]);
      await _jpCargarJerarquia("");
      return;
    }
    document.getElementById("listaProyectos").innerHTML = ps
      .map((p) => {
        const reglas = {
          ..._REGLAS_DECORATOR_DEFAULTS,
          ...(p.reglasDecoradores || {}),
        };
        const activos = [
          reglas.auditoriaEnriquecidaActiva ? "Auditoría" : null,
          reglas.notificacionAutomaticaActiva ? "Notificación" : null,
          reglas.validacionSlaActiva ? "SLA" : null,
        ].filter(Boolean);

        return `
      <div class="prow">
        <div class="prow-main">
          <div class="prow-top">
            <div class="prow-name">${p.nombre}</div>
            ${badgeEstado(p.estado)}
          </div>
          <div class="prow-desc">${p.descripcion || "Sin descripción"}</div>
          <div class="prow-meta">
            <span><i class="ph ph-calendar-blank"></i> Fin: ${fFecha(p.fechaFinEstimada)}</span>
            <span><i class="ph ph-gauge"></i> Progreso: ${Number(p.progreso || 0).toFixed(1)}%</span>
            <span>
              <i class="ph ph-stack"></i>
              ${
                activos.length
                  ? `<span class="badge bb" title="${activos.join(", ")}">Reglas ${activos.length}</span>`
                  : '<span class="badge bi">Reglas 0</span>'
              }
            </span>
          </div>
          <div class="prow-prog">
            <div class="prog"><div class="prog-bar" style="width:${p.progreso}%"></div></div>
          </div>
        </div>
        <div class="prow-actions">
          <button class="btn btn-outline btn-xs" onclick="irTablero('${p.id}','${p.nombre}')"><i class='ph ph-kanban'></i> Tablero</button>
          <button class="btn btn-outline btn-xs" onclick="abrirJerarquiaProyecto('${p.id}')"><i class='ph ph-tree-structure'></i> Estructura</button>
          ${
            S.usuario.rol !== "DEVELOPER"
              ? `
            <button class="btn btn-outline btn-xs" onclick="abrirInvitar('${p.id}')"><i class='ph ph-user-plus'></i> Invitar</button>
            <button class="btn btn-outline btn-xs" onclick="abrirReglasDecorador('${p.id}')"><i class='ph ph-sliders-horizontal'></i> Reglas</button>
            <button class="btn btn-outline btn-xs" onclick="clonarProyecto('${p.id}')"><i class='ph ph-copy'></i> Clonar</button>
            ${!p.estaArchivado ? `<button class="btn btn-ghost btn-xs" onclick="archivarProyecto('${p.id}')">Archivar</button>` : ""}
          `
              : ""
          }
        </div>
      </div>`;
      })
      .join("");

    const proySeleccionado = _jpSincronizarSelectorYPermisos(ps);
    await _jpCargarJerarquia(proySeleccionado);
  } catch (e) {
    toast(e.message, "err");
    _jpSetError(e.message || "No se pudieron cargar proyectos");
  }
}

async function crearProyecto() {
  document.getElementById("pError").textContent = "";
  try {
    await api("POST", "/proyectos/", {
      nombre: document.getElementById("pNom").value,
      descripcion: document.getElementById("pDesc").value || null,
      fechaInicio: document.getElementById("pFI").value,
      fechaFinEstimada: document.getElementById("pFF").value,
    });
    cerrarModal("mProy");
    toast("Proyecto creado");
    cargarProyectos();
  } catch (e) {
    document.getElementById("pError").textContent = e.message;
  }
}

async function archivarProyecto(id) {
  if (!confirm("¿Archivar este proyecto?")) return;
  try {
    await api("POST", `/proyectos/${id}/archivar`);
    toast("Proyecto archivado");
    cargarProyectos();
  } catch (e) {
    toast(e.message, "err");
  }
}

async function clonarProyecto(id) {
  try {
    await api("POST", `/proyectos/${id}/clonar`);
    toast("Proyecto clonado");
    cargarProyectos();
  } catch (e) {
    toast(e.message, "err");
  }
}

async function abrirReglasDecorador(proyId) {
  const errorEl = document.getElementById("rdError");
  if (errorEl) errorEl.textContent = "";
  try {
    const proyecto = await api("GET", `/proyectos/${proyId}`);
    const reglas = {
      ..._REGLAS_DECORATOR_DEFAULTS,
      ...(proyecto.reglasDecoradores || {}),
    };

    document.getElementById("rdProyectoId").value = proyId;
    document.getElementById("rdProyectoTitulo").textContent =
      proyecto.nombre || proyId;
    document.getElementById("rdMaxHoras").value = Number(
      reglas.maxHorasPorTarea ?? _REGLAS_DECORATOR_DEFAULTS.maxHorasPorTarea,
    );
    _toggleSet("rdAudit", reglas.auditoriaEnriquecidaActiva);
    _toggleSet("rdNotif", reglas.notificacionAutomaticaActiva);
    _toggleSet("rdSla", reglas.validacionSlaActiva);
    _toggleSet("rdBugUrgente", reglas.notificarBugUrgenteAlPm);
    _toggleSet("rdMoverEnProgreso", reglas.validarHorasAntesDeMoverEnProgreso);
    abrirModal("mReglasDecorator");
  } catch (e) {
    toast(e.message, "err");
  }
}

async function guardarReglasDecorador() {
  const proyId = document.getElementById("rdProyectoId").value;
  const errorEl = document.getElementById("rdError");
  if (errorEl) errorEl.textContent = "";
  if (!proyId) {
    if (errorEl) errorEl.textContent = "Proyecto no seleccionado";
    return;
  }

  const maxHoras = Number(document.getElementById("rdMaxHoras").value);
  if (!Number.isFinite(maxHoras) || maxHoras < 0) {
    if (errorEl)
      errorEl.textContent = "El máximo de horas debe ser un número >= 0";
    return;
  }

  try {
    await api("PUT", `/proyectos/${proyId}`, {
      reglasDecoradores: {
        auditoriaEnriquecidaActiva: _toggleGet("rdAudit"),
        notificacionAutomaticaActiva: _toggleGet("rdNotif"),
        validacionSlaActiva: _toggleGet("rdSla"),
        maxHorasPorTarea: maxHoras,
        notificarBugUrgenteAlPm: _toggleGet("rdBugUrgente"),
        validarHorasAntesDeMoverEnProgreso: _toggleGet("rdMoverEnProgreso"),
      },
    });
    cerrarModal("mReglasDecorator");
    toast("Reglas actualizadas");
    if (
      document.querySelector(".pantalla.activa")?.id === "pantalla-proyectos"
    ) {
      cargarProyectos();
    }
  } catch (e) {
    if (errorEl) errorEl.textContent = e.message;
  }
}

function abrirInvitar(proyId) {
  document.getElementById("invitarPrId").value = proyId;
  document.getElementById("invEmail").value = "";
  document.getElementById("invError").textContent = "";
  abrirModal("mInvitar");
}

async function invitarMiembro() {
  document.getElementById("invError").textContent = "";
  const proyId = document.getElementById("invitarPrId").value;
  try {
    const r = await api("POST", `/proyectos/${proyId}/invitar`, {
      email: document.getElementById("invEmail").value,
      rolEnProyecto: "DEVELOPER",
    });
    cerrarModal("mInvitar");
    toast(r.mensaje);
  } catch (e) {
    document.getElementById("invError").textContent = e.message;
  }
}

/* ── Caché de usuarios activos con TTL de 5 minutos ── */
let _cacheUsuariosActivos = null;
let _cacheTsUsuariosActivos = 0;
const _TTL_USUARIOS = 5 * 60 * 1000; // 5 minutos

async function _getUsuariosActivos(forzar = false) {
  const ahora = Date.now();
  if (
    !forzar &&
    _cacheUsuariosActivos &&
    ahora - _cacheTsUsuariosActivos < _TTL_USUARIOS
  ) {
    return _cacheUsuariosActivos;
  }
  const todos = await api("GET", "/usuarios/activos");
  _cacheUsuariosActivos = todos
    .filter((u) => u.rol === "DEVELOPER")
    .map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol }));
  _cacheTsUsuariosActivos = ahora;
  return _cacheUsuariosActivos;
}

/* Invalidar caché al crear/desactivar usuario */
function _invalidarCacheUsuarios() {
  _cacheUsuariosActivos = null;
  _cacheTsUsuariosActivos = 0;
}
/* ══════════ TAREAS ══════════ */
let _estructuraEditarTarea = null;

function _aDatetimeLocalInput(isoFecha) {
  if (!isoFecha) return "";
  const d = new Date(isoFecha);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function _refrescarVistaTrasCambioTarea() {
  if (!proyActualId) return;
  const activa = document.querySelector(".pantalla.activa")?.id;
  if (activa === "pantalla-tareas" && typeof cargarTareasPaginadas === "function") {
    const pagina = typeof _paginaTareas !== "undefined" ? _paginaTareas : 1;
    await cargarTareasPaginadas(proyActualId, pagina);
    return;
  }
  if (activa === "pantalla-tablero" && typeof cargarTablero === "function") {
    await cargarTablero(proyActualId);
    return;
  }

  const tareasRefresh = typeof cargarTareasPaginadas === "function"
    ? cargarTareasPaginadas(
      proyActualId,
      typeof _paginaTareas !== "undefined" ? _paginaTareas : 1,
    ).catch(() => {})
    : Promise.resolve();
  const tableroRefresh = typeof cargarTablero === "function"
    ? cargarTablero(proyActualId).catch(() => {})
    : Promise.resolve();
  await Promise.all([tareasRefresh, tableroRefresh]);
}

function _opcionesFaseParaModal(fases = []) {
  return (
    '<option value="">Sin fase</option>' +
    fases
      .map((fase) => `<option value="${fase.id}">${fase.nombre}</option>`)
      .join("")
  );
}

function _renderEtapasModalTarea(estructura, faseId, etapaSeleccionada = "") {
  const selEtapa = document.getElementById("tEtapa");
  if (!selEtapa) return;
  const etapas = faseId ? estructura?.etapasPorFase?.[faseId] || [] : [];
  selEtapa.innerHTML =
    '<option value="">Sin etapa</option>' +
    etapas.map((etapa) => `<option value="${etapa.id}">${etapa.nombre}</option>`).join("");
  if (etapaSeleccionada && etapas.some((e) => e.id === etapaSeleccionada)) {
    selEtapa.value = etapaSeleccionada;
  } else {
    selEtapa.value = "";
  }
}

async function _cargarEstructuraModalTarea() {
  const selFase = document.getElementById("tFase");
  const selEtapa = document.getElementById("tEtapa");
  if (!selFase || !selEtapa || !proyActualId) return;

  const fasePrev = selFase.value || "";
  const etapaPrev = selEtapa.value || "";
  const estructura = await cargarEstructuraProyecto(proyActualId);
  const fases = Array.isArray(estructura?.fases) ? estructura.fases : [];

  selFase.innerHTML = _opcionesFaseParaModal(fases);
  const faseActual = fases.some((fase) => fase.id === fasePrev) ? fasePrev : "";
  selFase.value = faseActual;
  _renderEtapasModalTarea(estructura, faseActual, etapaPrev);
}

async function onCambioFaseTarea() {
  if (!proyActualId) return;
  try {
    const estructura = await cargarEstructuraProyecto(proyActualId);
    const faseId = document.getElementById("tFase")?.value || "";
    _renderEtapasModalTarea(estructura, faseId);
  } catch (e) {
    document.getElementById("tError").textContent = e.message;
  }
}

async function abrirModalTarea() {
  const proySeleccionado =
    proyActualId ||
    document.getElementById("selTareasProy")?.value ||
    document.getElementById("selPT")?.value ||
    "";
  if (proySeleccionado) proyActualId = proySeleccionado;
  if (!proyActualId) {
    toast("Primero selecciona un proyecto", "err");
    return;
  }
  // Abrir el modal INMEDIATAMENTE sin esperar la API
  document.getElementById("tCol").innerHTML = colsActuales
    .map((c) => `<option value="${c.id}">${c.nombre}</option>`)
    .join("");
  document.getElementById("tError").textContent = "";
  document.getElementById("tTit").value = "";
  document.getElementById("tDesc").value = "";
  const selFase = document.getElementById("tFase");
  const selEtapa = document.getElementById("tEtapa");
  if (selFase) selFase.innerHTML = '<option value="">Cargando fases...</option>';
  if (selEtapa) selEtapa.innerHTML = '<option value="">Sin etapa</option>';
  abrirModal("mTarea");

  const cargaEstructura = _cargarEstructuraModalTarea().catch((e) => {
    document.getElementById("tError").textContent = e.message;
  });

  // Cargar responsables en segundo plano (el modal ya está visible)
  try {
    miembrosActuales = await _getUsuariosActivos();
    renderRespLista("respLista", []);
  } catch (_) {
    renderRespLista("respLista", []);
  }
  await cargaEstructura;
}

function abrirModalTareaCol(colId) {
  abrirModalTarea();
  setTimeout(() => {
    const s = document.getElementById("tCol");
    if (s) s.value = colId;
  }, 50);
}

function _renderEtapasModalEditarTarea(faseId, etapaSeleccionada = "") {
  const selEtapa = document.getElementById("edEtapa");
  if (!selEtapa) return;
  const etapas = faseId ? _estructuraEditarTarea?.etapasPorFase?.[faseId] || [] : [];
  selEtapa.innerHTML =
    '<option value="">Sin etapa</option>' +
    etapas.map((etapa) => `<option value="${etapa.id}">${etapa.nombre}</option>`).join("");
  if (etapaSeleccionada && etapas.some((e) => e.id === etapaSeleccionada)) {
    selEtapa.value = etapaSeleccionada;
  } else {
    selEtapa.value = "";
  }
}

function onCambioFaseEditarTarea() {
  const faseId = document.getElementById("edFase")?.value || "";
  _renderEtapasModalEditarTarea(faseId, "");
}

async function abrirEditarTarea(tareaId) {
  const errEl = document.getElementById("edError");
  if (errEl) errEl.textContent = "";
  try {
    const tarea = await api("GET", `/tareas/${tareaId}`);
    proyActualId = tarea.proyectoId || proyActualId;
    if (!proyActualId) throw new Error("No se pudo determinar el proyecto de la tarea");

    const [tableros, devs, estructura] = await Promise.all([
      api("GET", `/proyectos/${proyActualId}/tableros`).catch(() => []),
      _getUsuariosActivos().catch(() => []),
      cargarEstructuraProyecto(proyActualId).catch(() => ({
        fases: [],
        fasesPorId: {},
        etapasPorFase: {},
        etapasPorId: {},
      })),
    ]);

    colsActuales = tableros[0]?.columnas || colsActuales || [];
    miembrosActuales = devs;
    _estructuraEditarTarea = estructura;

    document.getElementById("edTareaId").value = tarea.id;
    document.getElementById("edTit").value = tarea.titulo || "";
    document.getElementById("edDesc").value = tarea.descripcion || "";
    document.getElementById("edTipo").value = tarea.tipo || "TASK";
    document.getElementById("edPrio").value = tarea.prioridad || "MEDIA";
    document.getElementById("edFV").value = _aDatetimeLocalInput(tarea.fechaVencimiento);

    const selCol = document.getElementById("edCol");
    selCol.innerHTML = colsActuales
      .map((c) => `<option value="${c.id}">${c.nombre}</option>`)
      .join("");
    selCol.value = colsActuales.some((c) => c.id === tarea.columnaId)
      ? tarea.columnaId
      : colsActuales[0]?.id || "";
    document.getElementById("edColOriginal").value = tarea.columnaId || "";

    const fases = Array.isArray(estructura?.fases) ? estructura.fases : [];
    const contexto = resolverContextoEstructura(estructura, tarea.faseId, tarea.etapaId);
    const faseInicial = tarea.faseId || contexto.fase?.id || "";
    const etapaInicial = tarea.etapaId || contexto.etapa?.id || "";
    const selFase = document.getElementById("edFase");
    selFase.innerHTML = _opcionesFaseParaModal(fases);
    selFase.value = fases.some((f) => f.id === faseInicial) ? faseInicial : "";
    _renderEtapasModalEditarTarea(selFase.value, etapaInicial);

    renderRespLista("edRespLista", tarea.responsables || []);
    abrirModal("mEditarTarea");
  } catch (e) {
    toast(e.message, "err");
  }
}

async function guardarEdicionTarea() {
  const errEl = document.getElementById("edError");
  if (errEl) errEl.textContent = "";

  const tareaId = document.getElementById("edTareaId").value;
  const titulo = document.getElementById("edTit").value.trim();
  const descripcion = document.getElementById("edDesc").value.trim();
  const colNuevo = document.getElementById("edCol").value;
  const colOriginal = document.getElementById("edColOriginal").value;
  const faseId = document.getElementById("edFase")?.value || null;
  const etapaId = document.getElementById("edEtapa")?.value || null;

  if (!tareaId) {
    if (errEl) errEl.textContent = "Tarea no seleccionada";
    return;
  }
  if (!titulo) {
    if (errEl) errEl.textContent = "El título es obligatorio";
    return;
  }

  const payload = {
    titulo,
    descripcion: descripcion || null,
    tipo: document.getElementById("edTipo").value,
    prioridad: document.getElementById("edPrio").value,
    fechaVencimiento: document.getElementById("edFV").value || null,
    faseId,
    etapaId,
    responsables: getSeleccionados("edRespLista"),
  };

  try {
    await api("PUT", `/tareas/${tareaId}`, payload);
    if (colNuevo && colNuevo !== colOriginal) {
      await api("POST", `/tareas/${tareaId}/mover`, {
        columnaIdDestino: colNuevo,
      });
    }
    cerrarModal("mEditarTarea");
    toast("Tarea actualizada");
    await _refrescarVistaTrasCambioTarea();
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}

function renderRespLista(contenedorId, seleccionados) {
  const c = document.getElementById(contenedorId);
  if (!miembrosActuales.length) {
    c.innerHTML = '<span class="txt3">Sin developers disponibles</span>';
    return;
  }
  c.innerHTML = miembrosActuales
    .map(
      (m) => `
    <div class="resp-chip ${seleccionados.includes(m.id) ? "sel" : ""}"
      onclick="toggleResp(this,'${m.id}','${contenedorId}')" data-id="${m.id}">
      <div class="avatar avatar-sm">${inic(m.nombre)}</div>
      ${m.nombre}
    </div>`,
    )
    .join("");
}

function toggleResp(el) {
  el.classList.toggle("sel");
}

function getSeleccionados(contenedorId) {
  return [...document.querySelectorAll(`#${contenedorId} .resp-chip.sel`)].map(
    (c) => c.dataset.id,
  );
}

async function crearTarea() {
  document.getElementById("tError").textContent = "";
  const colId = document.getElementById("tCol").value;
  const faseId = document.getElementById("tFase")?.value || null;
  const etapaId = document.getElementById("tEtapa")?.value || null;
  if (!colId) {
    document.getElementById("tError").textContent = "Selecciona una columna";
    return;
  }
  try {
    await api("POST", "/tareas", {
      titulo: document.getElementById("tTit").value,
      descripcion: document.getElementById("tDesc").value || null,
      tipo: document.getElementById("tTipo").value,
      prioridad: document.getElementById("tPrio").value,
      columnaId: colId,
      proyectoId: proyActualId,
      faseId,
      etapaId,
      fechaVencimiento: document.getElementById("tFV").value || null,
      responsables: getSeleccionados("respLista"),
      etiquetas: [],
    });
    cerrarModal("mTarea");
    toast("Tarea creada");
    await _refrescarVistaTrasCambioTarea();
  } catch (e) {
    document.getElementById("tError").textContent = e.message;
  }
}

/* cargarTareas reemplazada por cargarTareasPaginadas en dashboard.js */

async function abrirAsignar(tareaId) {
  document.getElementById("asignarTareaId").value = tareaId;
  if (!proyActualId) {
    toast("Primero carga un proyecto", "err");
    return;
  }
  // Abrir modal inmediatamente con skeleton
  document.getElementById("asignarLista").innerHTML =
    '<span class="spinner"></span>';
  abrirModal("mAsignar");
  // Cargar usuarios y tarea en paralelo
  try {
    const [devs, tarea] = await Promise.all([
      _getUsuariosActivos(),
      api("GET", `/tareas/${tareaId}`),
    ]);
    miembrosActuales = devs;
    renderRespLista("asignarLista", tarea.responsables || []);
  } catch (e) {
    cerrarModal("mAsignar");
    toast(e.message, "err");
  }
}

async function guardarAsignacion() {
  const tareaId = document.getElementById("asignarTareaId").value;
  const sel = getSeleccionados("asignarLista");
  try {
    await api("PUT", `/tareas/${tareaId}/responsables`, { responsables: sel });
    cerrarModal("mAsignar");
    toast("Responsables asignados");
    await _refrescarVistaTrasCambioTarea();
  } catch (e) {
    toast(e.message, "err");
  }
}

async function clonarTarea(id) {
  try {
    await api("POST", `/tareas/${id}/clonar`);
    toast("Tarea clonada");
    await _refrescarVistaTrasCambioTarea();
  } catch (e) {
    toast(e.message, "err");
  }
}

function eliminarTarea(id, titulo = "") {
  const tareaId = String(id || "").trim();
  if (!tareaId) return;

  document.getElementById("delTareaId").value = tareaId;
  document.getElementById("delTareaError").textContent = "";
  document.getElementById("delTareaMsg").textContent = titulo
    ? `¿Seguro que deseas eliminar la tarea "${titulo}"?`
    : "¿Seguro que deseas eliminar esta tarea?";
  abrirModal("mEliminarTarea");
}

async function confirmarEliminarTarea() {
  const tareaId = document.getElementById("delTareaId").value;
  const errEl = document.getElementById("delTareaError");
  if (errEl) errEl.textContent = "";
  if (!tareaId) {
    if (errEl) errEl.textContent = "Tarea no seleccionada";
    return;
  }
  try {
    await api("DELETE", `/tareas/${tareaId}`);
    cerrarModal("mEliminarTarea");
    toast("Tarea eliminada");
    await _refrescarVistaTrasCambioTarea();
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}

/* ══════════ USUARIOS ══════════ */
async function cargarUsuarios() {
  if (S?.usuario?.rol !== "ADMIN") {
    document.getElementById("tbUsuarios").innerHTML =
      '<tr><td colspan="6" class="vacío">Acceso restringido a Administradores</td></tr>';
    return;
  }
  try {
    const us = await api("GET", "/usuarios/");
    document.getElementById("tbUsuarios").innerHTML = us
      .map(
        (u) => `<tr>
      <td><div class="flex" style="gap:8px">
        <div class="avatar avatar-sm">${inic(u.nombre)}</div>${u.nombre}
      </div></td>
      <td class="txt2">${u.email}</td>
      <td>${badgeRol(u.rol)}</td>
      <td class="txt3">${fFecha(u.ultimoAcceso)}</td>
      <td><span class="badge ${u.estaActivo ? "bg" : "br"}">${u.estaActivo ? "Activo" : "Inactivo"}</span></td>
      <td>${
        u.estaActivo && u.id !== S.usuario.id
          ? `<button class="btn btn-red btn-xs" onclick="desactivarUsuario('${u.id}')">Desactivar</button>`
          : ""
      }</td>
    </tr>`,
      )
      .join("");
  } catch (e) {
    toast(e.message, "err");
  }
}

async function desactivarUsuario(id) {
  if (!confirm("¿Desactivar este usuario?")) return;
  try {
    await api("PUT", `/usuarios/${id}/desactivar`);
    toast("Usuario desactivado");
    cargarUsuarios();
  } catch (e) {
    toast(e.message, "err");
  }
}

/* ══════════ REPORTES ══════════ */
async function cargarReporte(proyId) {
  if (!proyId) {
    ["rTotal", "rVenc", "rProg"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    });
    const dist = document.getElementById("rDist");
    if (dist)
      dist.innerHTML = '<div class="vacío">Selecciona un proyecto</div>';
    return;
  }
  const elems = ["rTotal", "rVenc", "rProg", "rDist"];
  elems.forEach((id) => {
    const el = document.getElementById(id);
    if (el && id !== "rDist") el.textContent = "—";
    if (el && id === "rDist")
      el.innerHTML = '<div class="vacío">Cargando...</div>';
  });
  try {
    const m = await api("GET", `/proyectos/${proyId}/metricas`);
    document.getElementById("rTotal").textContent = m.totalTareas ?? "0";
    document.getElementById("rVenc").textContent = m.tareasVencidas ?? "0";
    document.getElementById("rProg").textContent = `${m.progreso ?? 0}%`;
    const dist = Object.entries(m.tareasPorEstado || {});
    const maxD = Math.max(...dist.map(([, v]) => v), 1);
    document.getElementById("rDist").innerHTML = dist.length
      ? dist
          .map(([col, cant]) => {
            const pctD = Math.round((cant / maxD) * 100);
            return `
          <div class="metrica-row">
            <span class="metrica-label">${col}</span>
            <div class="metrica-bar-track">
              <div class="metrica-bar-fill" style="width:${pctD}%"></div>
            </div>
            <span class="metrica-cant">${cant}</span>
          </div>`;
          })
          .join("")
      : '<div class="vacío">Sin tareas aún</div>';
    // Recargar panel activo si corresponde
    const panelEquipo = document.getElementById("rpanel-equipo");
    if (panelEquipo?.classList.contains("activo"))
      cargarEstadisticasEquipo(proyId);
    const panelSprint = document.getElementById("rpanel-sprint");
    if (panelSprint?.classList.contains("activo")) {
      document.getElementById("contenidoSprint").innerHTML =
        '<div class="vacío">Ingresa el nombre del sprint y haz clic en Generar</div>';
    }
  } catch (e) {
    toast("Error cargando métricas: " + e.message, "err");
    document.getElementById("rDist").innerHTML =
      `<div class="vacío">Error: ${e.message}</div>`;
  }
}

async function exportarReporteBridge(tipo, formato) {
  const proyId = document.getElementById("selReporteProy")?.value;
  if (!proyId) {
    toast("Selecciona un proyecto primero", "err");
    return;
  }
  try {
    const ruta = `/proyectos/${proyId}/exportar?tipo=${encodeURIComponent(tipo)}&formato=${encodeURIComponent(formato)}`;
    const resp = await fetch(`${API}${ruta}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${S?.token_acceso || ""}`,
      },
    });
    if (!resp.ok) {
      let detalle = "Error al exportar reporte";
      try {
        const d = await resp.json();
        detalle = d.detail || detalle;
      } catch {}
      throw new Error(detalle);
    }
    const blob = await resp.blob();
    const cd = resp.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="([^"]+)"/i);
    const nombre = m?.[1] || `${tipo}.${formato}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Reporte exportado correctamente");
  } catch (e) {
    toast(e.message, "err");
  }
}

function exportarReporteBridgeDesdeUI() {
  const tipo = document.getElementById("expTipo")?.value || "tareas";
  const formato = document.getElementById("expFormato")?.value || "json";
  exportarReporteBridge(tipo, formato);
}

/* ══════════ HISTORIAL ══════════ */
let historialUltimoCambio = null;

function cambiarTabHist(nombre, btn) {
  // Limitar a los tabs/panels dentro del historial para no afectar los de reportes
  const pantalla = document.getElementById("pantalla-historial");
  if (!pantalla) return;
  pantalla
    .querySelectorAll(".htab")
    .forEach((t) => t.classList.remove("activo"));
  pantalla
    .querySelectorAll(".hpanel")
    .forEach((p) => p.classList.remove("activo"));
  btn.classList.add("activo");
  pantalla.querySelector(`#hpanel-${nombre}`)?.classList.add("activo");
  if (nombre === "completadas") cargarTareasCompletadas();
}

// Cache de usuarios para resolución de nombres
let _cacheUsuarios = null;
async function _obtenerMapaUsuarios() {
  if (_cacheUsuarios) return _cacheUsuarios;
  try {
    // /usuarios/activos es accesible por todos los roles (no solo ADMIN)
    const lista = await api("GET", "/usuarios/activos");
    _cacheUsuarios = {};
    lista.forEach((u) => {
      _cacheUsuarios[u.id] = u;
    });
  } catch (_) {
    _cacheUsuarios = {};
  }
  return _cacheUsuarios;
}
function _nombreUsuario(mapaU, usuarioId) {
  const u = mapaU[usuarioId];
  return u ? u.nombre : `ID:${usuarioId.slice(-6)}`;
}

async function cargarHistorial(proyId) {
  if (!proyId) {
    const el = document.getElementById("listaHist");
    if (el) el.innerHTML = '<div class="vacío">Selecciona un proyecto</div>';
    return;
  }
  document.getElementById("listaHist").innerHTML =
    '<span class="spinner"></span>';
  try {
    const res = await api("GET", `/proyectos/${proyId}/auditoria?limite=100`);
    // Soportar tanto array plano como respuesta paginada
    const rs = Array.isArray(res) ? res : res.datos || [];
    const mapaU = await _obtenerMapaUsuarios();

    if (!rs.length) {
      document.getElementById("listaHist").innerHTML =
        '<div class="vacío">Sin registros de auditoría</div>';
      return;
    }
    document.getElementById("listaHist").innerHTML = `<div class="timeline">${rs
      .filter((r) => r && r.usuarioId)
      .map((r, i) => {
        const nombre = _nombreUsuario(mapaU, r.usuarioId);
        const u = mapaU[r.usuarioId];
        const av = u
          ? `<div class="avatar avatar-sm" style="display:inline-flex;vertical-align:middle;margin-right:4px">${inic(u.nombre)}</div>`
          : "";
        return `
        <div class="tl-item ${i === 0 ? "reciente" : ""}">
          <div class="tl-accion"><strong>${r.accion || "—"}</strong> en ${r.tipoEntidad || "—"}</div>
          <div class="tl-meta">${av}${nombre} · ${fFecha(r.marca)}</div>
        </div>`;
      })
      .join("")}</div>`;
  } catch (e) {
    document.getElementById("listaHist").innerHTML =
      `<div class="vacío">Error: ${e.message}</div>`;
  }
}

async function cargarHistorialTarea() {
  const raw = document.getElementById("histTareaId").value.trim();
  if (!raw) {
    toast("Ingresa un ID de tarea", "err");
    return;
  }
  document.getElementById("listaHistTarea").innerHTML =
    '<span class="spinner"></span>';
  document.getElementById("undoZona").style.display = "none";
  try {
    let tareaId = raw;
    if (proyActualId && raw.length <= 6) {
      const tareas = await api("GET", `/proyectos/${proyActualId}/tareas`);
      const encontrada = tareas.find((t) => t.id.endsWith(raw));
      if (encontrada) tareaId = encontrada.id;
    }
    const rs = await api("GET", `/tareas/${tareaId}/historial`);
    if (!rs.length) {
      document.getElementById("listaHistTarea").innerHTML =
        '<div class="vacío">Sin historial para esta tarea</div>';
      return;
    }
    historialUltimoCambio = rs[0];
    const mapaU2 = await _obtenerMapaUsuarios();
    document.getElementById("listaHistTarea").innerHTML =
      `<div class="timeline">${rs
        .map((r, i) => {
          const nombre = _nombreUsuario(mapaU2, r.usuarioId);
          const u2 = mapaU2[r.usuarioId];
          const av = u2
            ? `<div class="avatar avatar-sm" style="display:inline-flex;vertical-align:middle;margin-right:4px">${inic(u2.nombre)}</div>`
            : "";
          return `
        <div class="tl-item ${i === 0 ? "reciente" : ""}">
          <div class="tl-accion"><strong>${r.accion}</strong> en ${r.tipoEntidad}</div>
          <div class="tl-meta">${av}${nombre} · ${fFecha(r.marca)}</div>
        </div>`;
        })
        .join("")}</div>`;
    if (historialUltimoCambio) {
      document.getElementById("undoZona").style.display = "";
      document.getElementById("undoDetalle").textContent =
        historialUltimoCambio.valorAnterior
          ? `Revertir: ${historialUltimoCambio.accion} (${fFecha(historialUltimoCambio.marca)})`
          : "No hay cambio anterior para revertir";
    }
  } catch (e) {
    document.getElementById("listaHistTarea").innerHTML =
      `<div class="vacío">Error: ${e.message}</div>`;
  }
}

async function deshacerUltimoCambio() {
  if (!historialUltimoCambio?.valorAnterior) {
    toast("No hay cambio anterior que deshacer", "err");
    return;
  }
  const { entidadId, valorAnterior, accion } = historialUltimoCambio;
  if (
    !confirm(
      `¿Deshacer "${accion}"? Se revertirán los cambios al estado anterior.`,
    )
  )
    return;
  try {
    await api("PUT", `/tareas/${entidadId}`, valorAnterior);
    toast("Cambio revertido");
    historialUltimoCambio = null;
    document.getElementById("undoZona").style.display = "none";
    cargarHistorialTarea();
  } catch (e) {
    toast(e.message, "err");
  }
}

async function buscarTareas() {
  if (!proyActualId) {
    toast("Primero selecciona un proyecto", "err");
    return;
  }
  const params = new URLSearchParams();
  const texto = document.getElementById("fTexto").value.trim();
  const prioridad = document.getElementById("fPrioridad").value;
  const tipo = document.getElementById("fTipo").value;
  if (texto) params.append("texto", texto);
  if (prioridad) params.append("prioridad", prioridad);
  if (tipo) params.append("tipo", tipo);
  const tb = document.getElementById("tbBusqueda");
  tb.innerHTML =
    '<tr><td colspan="5" class="vacío"><span class="spinner"></span></td></tr>';
  try {
    const ts = await api("GET", `/proyectos/${proyActualId}/tareas?${params}`);
    if (!ts.length) {
      tb.innerHTML =
        '<tr><td colspan="5" class="vacío">Sin resultados</td></tr>';
      return;
    }
    tb.innerHTML = ts
      .map(
        (t) => `<tr>
      <td style="color:var(--txt);font-weight:500">${t.titulo}</td>
      <td>${badgeTipo(t.tipo)}</td>
      <td>${badgePrio(t.prioridad)}</td>
      <td class="txt3">${colsActuales.find((c) => c.id === t.columnaId)?.nombre || t.columnaId.slice(-6)}</td>
      <td>${t.estaVencida ? '<span class="badge br">Vencida</span>' : '<span class="badge bg">Activa</span>'}</td>
    </tr>`,
      )
      .join("");
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="5" class="vacío">Error: ${e.message}</td></tr>`;
  }
}

function limpiarFiltros() {
  ["fTexto", "fPrioridad", "fTipo"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  document.getElementById("tbBusqueda").innerHTML =
    '<tr><td colspan="5" class="vacío">Aplica un filtro para buscar</td></tr>';
}

async function cargarTareasCompletadas() {
  if (!proyActualId) {
    document.getElementById("listaCompletadas").innerHTML =
      '<div class="vacío">Selecciona un proyecto primero</div>';
    return;
  }
  document.getElementById("listaCompletadas").innerHTML =
    '<span class="spinner"></span>';
  try {
    const tableros = await api("GET", `/proyectos/${proyActualId}/tableros`);
    const columnas = tableros[0]?.columnas || [];
    const colCompletado = columnas.find((c) =>
      c.nombre.toLowerCase().includes("complet"),
    );
    if (!colCompletado) {
      document.getElementById("listaCompletadas").innerHTML =
        '<div class="vacío">No se encontró columna de completadas</div>';
      return;
    }
    const tareas = await api("GET", `/columnas/${colCompletado.id}/tareas`);
    const mias = tareas.filter((t) => t.responsables.includes(S.usuario.id));
    if (!mias.length) {
      document.getElementById("listaCompletadas").innerHTML =
        '<div class="vacío">No tienes tareas completadas asignadas</div>';
      return;
    }
    document.getElementById("listaCompletadas").innerHTML = mias
      .map(
        (t) => `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 0;border-bottom:1px solid rgba(63,63,70,.35)">
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--verde)">✓ ${t.titulo}</div>
          <div class="txt3">${badgeTipo(t.tipo)} · ${t.horasRegistradas}h · ${fFecha(t.creadoEn)}</div>
        </div>
        ${badgePrio(t.prioridad)}
      </div>`,
      )
      .join("");
  } catch (e) {
    document.getElementById("listaCompletadas").innerHTML =
      `<div class="vacío">Error: ${e.message}</div>`;
  }
}

/* ══════════ NOTIFICACIONES ══════════ */
async function cargarNotificaciones() {
  if (!S) return;
  const esAdmin = S.usuario.rol === "ADMIN";
  const panelAdmin = document.getElementById("panelAdminNotif");
  const panelMio = document.getElementById("panelMisNotif");
  const btnMarcar = document.getElementById("btnMarcarLeidas");

  // Admin solo ve la tabla global; el resto ve sus propias notificaciones
  const panelEnvio = document.getElementById("panelEnvioExterno");
  const esAdminOPM =
    esAdmin || (S && S.usuario && S.usuario.rol === "PROJECT_MANAGER");

  if (panelAdmin) panelAdmin.style.display = esAdmin ? "" : "none";
  if (panelMio) panelMio.style.display = esAdmin ? "none" : "";
  if (btnMarcar) btnMarcar.style.display = esAdmin ? "none" : "";
  if (panelEnvio) panelEnvio.style.display = esAdminOPM ? "" : "none";

  // Cargar usuarios para el selector del panel de envío
  if (esAdminOPM) _notifCargarDestinatarios();

  if (!esAdmin) {
    // Vista normal: mis notificaciones + preferencias
    try {
      const ns = await api("GET", "/notificaciones/");
      const noLeidas = ns.filter((n) => !n.leida).length;
      actualizarBadgeNotif(noLeidas);
      const iconoNotif = (tipo) =>
        ({
          TAREA_ASIGNADA: "📋",
          COMENTARIO_EN_TAREA: "💬",
          MENCION_EN_COMENTARIO: "@",
          ESTADO_TAREA_CAMBIADO: "→",
          TAREA_VENCIDA: "⚠",
          MIEMBRO_INVITADO: "👥",
        })[tipo] || "🔔";

      document.getElementById("listaNotifc").innerHTML = ns.length
        ? ns
            .map((n) => {
              const tieneLink = n.tareaId && n.tituloTarea;
              const accion = tieneLink
                ? `<div style="display:flex;gap:6px;margin-left:auto;align-items:center">
                   <button class="btn btn-outline btn-xs"
                     onclick="irATarea('${n.tareaId}','${(n.tituloTarea || "").replace(/'/g, "\\'")}')"
                     title="Abrir tarea">Ver tarea</button>
                   ${!n.leida ? `<button class="btn btn-ghost btn-xs" onclick="marcarLeida('${n.id}')">✓</button>` : ""}
                 </div>`
                : !n.leida
                  ? `<button class="btn btn-ghost btn-xs" style="margin-left:auto" onclick="marcarLeida('${n.id}')">Leída</button>`
                  : "";
              return `
            <div class="notif-item ${n.leida ? "" : "notif-unread"}">
              <div class="notif-ico" style="${n.leida ? "opacity:.45" : ""}">${iconoNotif(n.tipo)}</div>
              <div style="flex:1;min-width:0">
                <div class="notif-txt" style="${n.leida ? "opacity:.55" : ""}">${n.mensaje}</div>
                ${n.tituloTarea ? `<div class="txt3" style="margin-top:2px">📌 ${n.tituloTarea}</div>` : ""}
                <div class="notif-ts">${fFecha(n.creadoEn)}</div>
              </div>
              ${accion}
            </div>`;
            })
            .join("")
        : '<div class="vacío">Sin notificaciones</div>';

      const prefs = await api("GET", "/notificaciones/preferencias");
      document.getElementById("prefsNotif").innerHTML = `<div>${[
        ["pn1", "notificacionAsignacion", "Asignación de tareas"],
        ["pn2", "notificacionVencimiento", "Alertas de vencimiento"],
        ["pn3", "notificacionComentario", "Comentarios en mis tareas"],
        ["pn4", "notificacionCambioEstado", "Cambios de estado"],
      ]
        .map(
          ([id, campo, label]) => `
        <div class="flex-between" style="padding:12px 0;border-bottom:1px solid rgba(63,63,70,.35)">
          <span class="txt2">${label}</span>
          <div class="toggle ${prefs[campo] ? "on" : ""}" id="${id}" onclick="this.classList.toggle('on')"></div>
        </div>`,
        )
        .join("")}</div>`;
    } catch (e) {
      toast(e.message, "err");
    }
  }
}

/* Navegar desde una notificación directamente al panel de comentarios de la tarea */
async function irATarea(tareaId, tituloTarea) {
  if (!tareaId) return;

  // Marcar notificación como leída si hay alguna sin leer de esta tarea
  // (el backend lo maneja, aquí solo navegamos)

  // Buscar a qué proyecto pertenece la tarea para poder seleccionarla
  try {
    const tarea = await api("GET", `/tareas/${tareaId}`);
    if (tarea.proyectoId) {
      // Sincronizar el proyecto activo
      proyActualId = tarea.proyectoId;
      // Navegar a tareas y cargar el proyecto correcto
      mostrarPantalla("tareas");
      await cargarSelectores();
      const sel = document.getElementById("selTareasProy");
      if (sel) sel.value = tarea.proyectoId;
      await cargarTareasPaginadas(tarea.proyectoId, 1);
      // Pequeña pausa para que el DOM actualice, luego abrir comentarios
      setTimeout(() => {
        abrirPanelComentarios(tareaId, tituloTarea || tarea.titulo);
      }, 300);
    }
  } catch (e) {
    // Si falla la navegación, al menos abrir los comentarios directamente
    toast("Abriendo comentarios...", "ok");
    abrirPanelComentarios(tareaId, tituloTarea);
  }
}

async function marcarLeida(id) {
  try {
    await api("PUT", `/notificaciones/${id}/leer`);
    cargarNotificaciones();
  } catch (e) {
    toast(e.message, "err");
  }
}

async function marcarTodasLeidas() {
  try {
    const r = await api("PUT", "/notificaciones/leer-todas");
    toast(r.mensaje);
    cargarNotificaciones();
  } catch (e) {
    toast(e.message, "err");
  }
}

async function guardarPrefs() {
  const on = (id) => document.getElementById(id)?.classList.contains("on");
  try {
    await api("PUT", "/notificaciones/preferencias", {
      notificacionAsignacion: on("pn1"),
      notificacionVencimiento: on("pn2"),
      notificacionComentario: on("pn3"),
      notificacionCambioEstado: on("pn4"),
    });
    toast("Preferencias guardadas");
  } catch (e) {
    toast(e.message, "err");
  }
}

/* ══════════ PERFIL ══════════ */
async function cargarPerfil() {
  if (!S) return;
  const u = S.usuario;
  // Formulario
  document.getElementById("perNombre").value = u.nombre || "";
  document.getElementById("perDesc").value = u.descripcion || "";
  document.getElementById("perAvatarUrl").value = u.avatarUri || "";
  // Sidebar info
  document.getElementById("perNombreDisplay").textContent = u.nombre || "—";
  document.getElementById("perRolDisplay").textContent = u.rol || "—";
  document.getElementById("perEmailDisplay").textContent = u.email || "—";
  // Seguridad
  const elES = document.getElementById("perEmailSeg");
  if (elES) elES.textContent = u.email || "—";
  const elRS = document.getElementById("perRolSeg");
  if (elRS) elRS.textContent = u.rol || "—";
  aplicarAvatarPerfil(u.avatarUri, u.nombre);
  // Stats: proyectos y último acceso
  try {
    const ps = await api("GET", "/proyectos/");
    const elP = document.getElementById("perStProyectos");
    if (elP) elP.textContent = ps.length;
    // Tareas del usuario
    let totalT = 0;
    await Promise.all(
      ps.map(async (p) => {
        try {
          const res = await api("GET", `/proyectos/${p.id}/tareas?limite=200`);
          const ts = Array.isArray(res) ? res : res.datos || [];
          totalT += ts.filter((t) =>
            (t.responsables || []).includes(u.id),
          ).length;
        } catch (_) {}
      }),
    );
    const elT = document.getElementById("perStTareas");
    if (elT) elT.textContent = totalT;
    const elA = document.getElementById("perStAcceso");
    if (elA)
      elA.textContent = u.ultimoAcceso
        ? new Date(u.ultimoAcceso).toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
          })
        : "—";
  } catch (_) {}
}

function aplicarAvatarPerfil(url, nombre) {
  const img = document.getElementById("perAvatarImg");
  const inicEl = document.getElementById("perAvatarInic");
  if (url) {
    img.src = url;
    img.style.display = "";
    img.onerror = () => {
      img.style.display = "none";
      inicEl.style.display = "";
    };
    inicEl.style.display = "none";
  } else {
    img.style.display = "none";
    inicEl.style.display = "";
    inicEl.textContent = inic(nombre);
  }
}

function previsualizarAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("perAvatarUrl").value = e.target.result;
    aplicarAvatarPerfil(e.target.result, S?.usuario?.nombre || "");
  };
  reader.readAsDataURL(file);
}

function previsualizarAvatarUrl(url) {
  aplicarAvatarPerfil(url || null, S?.usuario?.nombre || "");
}

async function guardarPerfil() {
  document.getElementById("perError").textContent = "";
  const avatarUri =
    document.getElementById("perAvatarUrl").value.trim() || null;
  try {
    const r = await api("PUT", "/usuarios/perfil", {
      nombre: document.getElementById("perNombre").value,
      descripcion: document.getElementById("perDesc").value || null,
      avatarUri,
    });
    S.usuario = { ...S.usuario, ...r };
    localStorage.setItem("tf_s", JSON.stringify(S));
    actualizarUI();
    cargarPerfil();
    toast("Perfil actualizado");
  } catch (e) {
    document.getElementById("perError").textContent = e.message;
  }
}

/* ══════════ NOTIFICACIONES ADMIN — tabla global ══════════ */
async function cargarTodasNotificaciones() {
  const panel = document.getElementById("panelAdminNotif");
  const tb = document.getElementById("tbTodasNotif");
  if (!panel || !tb) return;

  if (S?.usuario?.rol !== "ADMIN") {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "";
  tb.innerHTML =
    '<tr><td colspan="5" class="vacío"><span class="spinner"></span></td></tr>';

  try {
    // Mapa de usuarios para nombres
    const usuarios = await api("GET", "/usuarios/");
    const mapaUsuarios = {};
    usuarios.forEach((u) => {
      mapaUsuarios[u.id] = u;
    });

    // Obtener auditoría de todos los proyectos
    // La ruta ahora puede devolver { datos: [...] } por la paginación
    const proyectos = await api("GET", "/proyectos/");
    const auditoriaRaw = await Promise.all(
      proyectos.map((p) =>
        api("GET", `/proyectos/${p.id}/auditoria?limite=100`)
          .then((res) => {
            // Soportar tanto array plano como respuesta paginada
            return Array.isArray(res) ? res : res.datos || [];
          })
          .catch(() => []),
      ),
    );
    const auditoria = auditoriaRaw
      .flat()
      .filter((r) => r && r.usuarioId) // descartar entradas inválidas
      .sort((a, b) => new Date(b.marca) - new Date(a.marca))
      .slice(0, 80);

    if (!auditoria.length) {
      tb.innerHTML =
        '<tr><td colspan="5" class="vacío">No hay registros de actividad aún</td></tr>';
      return;
    }

    const iconos = {
      CREADA: "✚",
      ACTUALIZADA: "✎",
      MOVIDA: "→",
      ELIMINADA: "✕",
    };
    tb.innerHTML = auditoria
      .map((r) => {
        const u = mapaUsuarios[r.usuarioId];
        const nombreUsuario = u
          ? u.nombre
          : `ID:${(r.usuarioId || "").slice(-6)}`;
        const icono = iconos[r.accion] || "•";
        return `<tr>
        <td style="color:var(--txt);font-weight:500">${icono} ${r.accion || "—"} en ${r.tipoEntidad || "—"}</td>
        <td>${badgeRol(u?.rol || "DEVELOPER")}</td>
        <td>
          <div class="flex" style="gap:6px">
            <div class="avatar avatar-sm">${inic(nombreUsuario)}</div>
            ${nombreUsuario}
          </div>
        </td>
        <td><span class="badge bg">Enviada</span></td>
        <td class="txt3">${fFecha(r.marca)}</td>
      </tr>`;
      })
      .join("");
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="5" class="vacío">Error: ${e.message}</td></tr>`;
  }
}

/* ══════════ REPORTES — tabs por rol ══════════ */
function cambiarTabReporte(nombre, btn) {
  document
    .querySelectorAll("#tabsReporte .htab")
    .forEach((t) => t.classList.remove("activo"));
  document
    .querySelectorAll('[id^="rpanel-"]')
    .forEach((p) => p.classList.remove("activo"));
  btn.classList.add("activo");
  document.getElementById(`rpanel-${nombre}`)?.classList.add("activo");
  const proyId = document.getElementById("selReporteProy")?.value;

  if (nombre === "equipo") {
    if (!proyId) {
      const c = document.getElementById("statsEquipo");
      if (c)
        c.innerHTML =
          '<div class="vacío"><i class="ph ph-folder" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px"></i>Selecciona un proyecto para ver las estadísticas del equipo</div>';
    } else {
      cargarEstadisticasEquipo(proyId);
    }
  }

  if (nombre === "sprint") {
    const c = document.getElementById("contenidoSprint");
    if (!proyId) {
      if (c)
        c.innerHTML =
          '<div class="vacío"><i class="ph ph-lightning" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px"></i>Selecciona un proyecto primero</div>';
    } else {
      if (c)
        c.innerHTML =
          '<div class="vacío">Ingresa el nombre del sprint y haz clic en Generar</div>';
    }
  }

  if (nombre === "metricas" && proyId) cargarReporte(proyId);
  if (nombre === "auditoria_global") cargarAuditoriaGlobal();
}

function inicializarTabsReporte() {
  if (!S) return;
  const rol = S.usuario.rol;
  const esAdmin = rol === "ADMIN";
  const esPMoAdmin = rol === "ADMIN" || rol === "PROJECT_MANAGER";

  // Tabs exclusivos de Admin
  ["tabAuditGlobal", "tabRetencion"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = esAdmin ? "" : "none";
  });

  // Tabs de sprint y equipo: PM y Admin
  // DEV: se queda solo en el tab de Métricas (visible para todos)
  // Los tabs de sprint y equipo existen en el HTML, solo los ocultamos para DEV
  const tabSprint = document.querySelector("#tabsReporte .htab:nth-child(2)");
  const tabEquipo = document.querySelector("#tabsReporte .htab:nth-child(3)");
  if (tabSprint) tabSprint.style.display = esPMoAdmin ? "" : "none";
  if (tabEquipo) tabEquipo.style.display = esPMoAdmin ? "" : "none";
}

async function generarReporteSprint() {
  const proyId = document.getElementById("selReporteProy")?.value;
  if (!proyId) {
    toast("Selecciona un proyecto primero", "err");
    return;
  }
  const sprint =
    document.getElementById("sprintNombre").value.trim() || "Sprint actual";
  const contenedor = document.getElementById("contenidoSprint");
  contenedor.innerHTML = '<span class="spinner"></span>';
  try {
    const metricas = await api("GET", `/proyectos/${proyId}/metricas`);
    const proyecto = await api("GET", `/proyectos/${proyId}`);
    const pct = Math.round(metricas.progreso || 0);
    const completadas = metricas.tareasCompletadas || 0;
    const total = metricas.totalTareas || 0;
    const vencidas = metricas.tareasVencidas || 0;
    const estadoEntradas = Object.entries(metricas.tareasPorEstado || {});
    const prioEntradas = Object.entries(metricas.tareasPorPrioridad || {});
    const prioColores = {
      BAJA: "var(--green)",
      MEDIA: "var(--amber)",
      ALTA: "var(--red)",
      URGENTE: "var(--purple)",
    };
    const maxCant = Math.max(...estadoEntradas.map(([, v]) => v), 1);

    contenedor.innerHTML = `
      <div class="sprint-reporte">
        <div class="sprint-header">
          <div>
            <div class="sprint-titulo"><i class="ph ph-lightning" style="color:var(--amber)"></i> ${sprint}</div>
            <div class="sprint-sub">${proyecto.nombre} · Generado ${fFecha(new Date().toISOString())}</div>
          </div>
          <div class="sprint-progreso-circ">
            <svg viewBox="0 0 60 60" width="60" height="60">
              <circle cx="30" cy="30" r="24" fill="none" stroke="var(--b1)" stroke-width="5"/>
              <circle cx="30" cy="30" r="24" fill="none" stroke="var(--a)" stroke-width="5"
                stroke-dasharray="${2 * Math.PI * 24}" stroke-dashoffset="${2 * Math.PI * 24 * (1 - pct / 100)}"
                stroke-linecap="round" transform="rotate(-90 30 30)"/>
            </svg>
            <span class="sprint-pct-txt">${pct}%</span>
          </div>
        </div>

        <div class="sprint-kpis">
          <div class="sprint-kpi">
            <i class="ph ph-check-square" style="color:var(--a)"></i>
            <div class="sprint-kpi-v">${total}</div>
            <div class="sprint-kpi-l">Total tareas</div>
          </div>
          <div class="sprint-kpi">
            <i class="ph ph-check-circle" style="color:var(--green)"></i>
            <div class="sprint-kpi-v">${completadas}</div>
            <div class="sprint-kpi-l">Completadas</div>
          </div>
          <div class="sprint-kpi">
            <i class="ph ph-warning-circle" style="color:var(--red)"></i>
            <div class="sprint-kpi-v" style="color:${vencidas > 0 ? "var(--red)" : "var(--green)"}">${vencidas}</div>
            <div class="sprint-kpi-l">Vencidas</div>
          </div>
          <div class="sprint-kpi">
            <i class="ph ph-percent" style="color:var(--amber)"></i>
            <div class="sprint-kpi-v">${pct}%</div>
            <div class="sprint-kpi-l">Progreso</div>
          </div>
        </div>

        <div class="sprint-dos-col">
          <div>
            <div class="sprint-section-t"><i class="ph ph-kanban"></i> Por columna</div>
            ${
              estadoEntradas
                .map(
                  ([col, cant]) => `
              <div class="sprint-bar-row">
                <span class="sprint-bar-label">${col}</span>
                <div class="sprint-bar-track">
                  <div class="sprint-bar-fill" style="width:${Math.round((cant / maxCant) * 100)}%"></div>
                </div>
                <span class="sprint-bar-val">${cant}</span>
              </div>`,
                )
                .join("") || '<div class="vacío">Sin datos</div>'
            }
          </div>
          <div>
            <div class="sprint-section-t"><i class="ph ph-chart-bar-horizontal"></i> Por prioridad</div>
            ${
              prioEntradas
                .map(
                  ([prio, cant]) => `
              <div class="sprint-bar-row">
                <span class="sprint-bar-label">${prio}</span>
                <div class="sprint-bar-track">
                  <div class="sprint-bar-fill" style="width:${Math.round((cant / total) * 100)}%;background:${prioColores[prio] || "var(--a)"}"></div>
                </div>
                <span class="sprint-bar-val">${cant}</span>
              </div>`,
                )
                .join("") || '<div class="vacío">Sin datos</div>'
            }
          </div>
        </div>
      </div>`;
  } catch (e) {
    contenedor.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
  }
}

async function cargarEstadisticasEquipo(proyId) {
  const contenedor = document.getElementById("statsEquipo");
  if (!proyId) {
    contenedor.innerHTML = '<div class="vacío">Selecciona un proyecto</div>';
    return;
  }
  contenedor.innerHTML = '<span class="spinner"></span>';
  try {
    const [metricas, miembros] = await Promise.all([
      api("GET", `/proyectos/${proyId}/metricas`),
      api("GET", `/proyectos/${proyId}/miembros`),
    ]);
    const tareasPorUser = metricas.tareasPorUsuario || {};
    if (!miembros.length) {
      contenedor.innerHTML = '<div class="vacío">Sin miembros</div>';
      return;
    }
    contenedor.innerHTML = `
      <div class="tabla-wrap">
        <table>
          <thead><tr><th>Miembro</th><th>Rol</th><th>Tareas asignadas</th><th>Carga</th></tr></thead>
          <tbody>${miembros
            .map((m) => {
              const cantidad = tareasPorUser[m.id] || 0;
              const max = Math.max(...Object.values(tareasPorUser), 1);
              const pct = Math.round((cantidad / max) * 100);
              return `<tr>
              <td>
                <div class="flex" style="gap:8px">
                  <div class="avatar avatar-sm">${inic(m.nombre)}</div>${m.nombre}
                </div>
              </td>
              <td>${badgeRol(m.rol)}</td>
              <td><span class="badge bi">${cantidad}</span></td>
              <td style="min-width:120px">
                <div class="prog" style="height:6px">
                  <div class="prog-bar" style="width:${pct}%"></div>
                </div>
              </td>
            </tr>`;
            })
            .join("")}</tbody>
        </table>
      </div>`;
  } catch (e) {
    contenedor.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
  }
}

/* exportarReporte eliminado */

async function cargarAuditoriaGlobal() {
  const contenedor = document.getElementById("listaAuditoriaGlobal");
  if (!contenedor) return;
  contenedor.innerHTML = '<span class="spinner"></span>';
  try {
    const proyectos = await api("GET", "/proyectos/");
    const mapaUAudit = await _obtenerMapaUsuarios();

    const auditoriaRaw = await Promise.all(
      proyectos.map((p) =>
        api("GET", `/proyectos/${p.id}/auditoria?limite=100`)
          .then((res) => (Array.isArray(res) ? res : res.datos || []))
          .catch(() => []),
      ),
    );
    const todaAuditoria = auditoriaRaw
      .flat()
      .filter((r) => r && r.usuarioId)
      .sort((a, b) => new Date(b.marca) - new Date(a.marca));

    if (!todaAuditoria.length) {
      contenedor.innerHTML =
        '<div class="vacío">Sin registros de auditoría global</div>';
      return;
    }
    contenedor.innerHTML = `<div class="timeline">${todaAuditoria
      .slice(0, 80)
      .map((r, i) => {
        const uAudit = mapaUAudit[r.usuarioId];
        const nombreAudit = uAudit
          ? uAudit.nombre
          : `ID:${(r.usuarioId || "").slice(-6)}`;
        const avAudit = uAudit
          ? `<div class="avatar avatar-sm" style="display:inline-flex;vertical-align:middle;margin-right:4px">${inic(uAudit.nombre)}</div>`
          : "";
        return `
        <div class="tl-item ${i === 0 ? "reciente" : ""}">
          <div class="tl-accion"><strong>${r.accion || "—"}</strong> en ${r.tipoEntidad || "—"}</div>
          <div class="tl-meta">${avAudit}${nombreAudit} · ${fFecha(r.marca)}</div>
        </div>`;
      })
      .join("")}</div>`;
  } catch (e) {
    contenedor.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
  }
}

/* guardarPoliticaRetencion eliminado */

/* ══════════ POLÍTICA DE RETENCIÓN ══════════ */
function aplicarPoliticaRetencion() {
  const dias = document.getElementById("diasRetencion")?.value;
  const nivel = document.getElementById("nivelRetencion")?.value;
  const msg = document.getElementById("retencionMensaje");
  if (!dias || parseInt(dias) < 7) {
    if (msg) msg.textContent = "✕ El mínimo es 7 días";
    return;
  }
  localStorage.setItem("tf_retencion", JSON.stringify({ dias, nivel }));
  if (msg)
    msg.textContent = `✓ Política aplicada: conservar ${dias} días (nivel: ${nivel})`;
  toast("Política de retención guardada");
}

/* ═══════════════════════════════════════════════════
   REGISTRO DE USUARIO
════════════════════════════════════════════════════ */
function seleccionarRol(el) {
  document
    .querySelectorAll(".registro-rol-opt")
    .forEach((o) => o.classList.remove("activo"));
  el.classList.add("activo");
  const hidden = document.getElementById("rRol");
  if (hidden) hidden.value = el.dataset.val;
}

function toggleVerPassReg() {
  const campo = document.getElementById("rPass");
  const icono = document.getElementById("iconoVerPassReg");
  if (!campo) return;
  if (campo.type === "password") {
    campo.type = "text";
    if (icono) icono.className = "ph ph-eye-slash";
  } else {
    campo.type = "password";
    if (icono) icono.className = "ph ph-eye";
  }
}

async function crearUsuario() {
  const errEl = document.getElementById("rError");
  if (errEl) errEl.textContent = "";
  const nombre = document.getElementById("rNombre")?.value?.trim();
  const email = document.getElementById("rEmail")?.value?.trim();
  const pass = document.getElementById("rPass")?.value?.trim();
  const rol = document.getElementById("rRol")?.value || "DEVELOPER";
  if (!nombre || !email || !pass) {
    if (errEl) errEl.textContent = "Todos los campos son obligatorios";
    return;
  }
  const btn = document.querySelector("#pantalla-registro .btn-primary");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creando...';
  }
  try {
    await api("POST", "/usuarios/registro", {
      nombre,
      email,
      contrasena: pass,
      rol,
    });
    // Limpiar formulario
    ["rNombre", "rEmail", "rPass"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    // Resetear selector de rol a Developer
    document
      .querySelectorAll(".registro-rol-opt")
      .forEach((o) => o.classList.remove("activo"));
    const dev = document.querySelector(
      '.registro-rol-opt[data-val="DEVELOPER"]',
    );
    if (dev) dev.classList.add("activo");
    const hidden = document.getElementById("rRol");
    if (hidden) hidden.value = "DEVELOPER";
    _invalidarCacheUsuarios();
    toast("Usuario creado correctamente");
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-user-plus"></i> Crear usuario';
    }
  }
}

/* === NOTIFICACIONES EXTERNAS === */

const _CANAL_INFO = {
  email: { fabrica: "Canal Email", adapter: "Canal Email", api: "Email API" },
  whatsapp: {
    fabrica: "Canal WhatsApp",
    adapter: "Canal WhatsApp",
    api: "WhatsApp API",
  },
  sms: { fabrica: "Canal SMS", adapter: "Canal SMS", api: "SMS API" },
};

function seleccionarCanalNotif(el) {
  document
    .querySelectorAll(".notif-canal")
    .forEach((c) => c.classList.remove("activo"));
  el.classList.add("activo");
  const canal = el.dataset.canal;
  const info = _CANAL_INFO[canal] || {};
  const set = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };
  set("flujoCanal", canal);
  set("flujoFabrica", info.fabrica || "");
  set("flujoAdapter", info.adapter || "");
  set("flujoApi", info.api || "");
}

/* ══════════════════════════════════════════════════
   NOTIFICACIONES EXTERNAS — Panel inline
══════════════════════════════════════════════════ */

const _NOTIF_FLOW = {
  email: { fabrica: "Canal Email", adapter: "Canal Email", api: "Email API" },
  whatsapp: {
    fabrica: "Canal WhatsApp",
    adapter: "Canal WhatsApp",
    api: "WhatsApp API",
  },
  sms: { fabrica: "Canal SMS", adapter: "Canal SMS", api: "SMS API" },
};

function notifSelCanal(el) {
  document
    .querySelectorAll(".ncanal-opt")
    .forEach((c) => c.classList.remove("activo"));
  el.classList.add("activo");
  const canal = el.dataset.canal;
  const flow = _NOTIF_FLOW[canal] || {};

  // Actualizar flujo visual
  const set = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };
  set("nflujoCanal", canal);
  set("nflujoFabrica", flow.fabrica || "");
  set("nflujoAdapter", flow.adapter || "");
  set("nflujoApi", flow.api || "");

  // Mostrar campo de telefono para WhatsApp y SMS
  const telWrap = document.getElementById("nTelWrap");
  const telLabel = document.getElementById("nTelLabel");
  const asuntoFg =
    document.getElementById("nAsunto") &&
    document.getElementById("nAsunto").closest(".fg");
  if (telWrap) {
    const necesitaTel = canal === "whatsapp" || canal === "sms";
    telWrap.style.display = necesitaTel ? "" : "none";
    if (telLabel)
      telLabel.textContent =
        canal === "whatsapp" ? "Numero de WhatsApp" : "Numero de SMS";
  }
  // Ocultar asunto cuando no es email
  if (asuntoFg) asuntoFg.style.display = canal === "email" ? "" : "none";
}

async function _notifCargarDestinatarios() {
  const sel = document.getElementById("nDestinatario");
  if (!sel || sel.options.length > 1) return;
  try {
    const us = await api("GET", "/usuarios/activos");
    sel.innerHTML =
      '<option value="">— Selecciona destinatario —</option>' +
      us
        .map(
          (u) =>
            '<option value="' +
            u.id +
            '">' +
            u.nombre +
            " · " +
            u.rol +
            " (" +
            u.email +
            ")</option>",
        )
        .join("");
  } catch (_) {}
}

async function notifEnviar() {
  // Leer canal seleccionado
  const canalEl = document.querySelector(".ncanal-opt.activo");
  const canal = canalEl ? canalEl.dataset.canal : "email";

  // Leer destinatario
  const userId = document.getElementById("nDestinatario")?.value || "";

  // Leer mensaje
  const msgEl = document.getElementById("nMensaje");
  const mensaje = msgEl ? msgEl.value.trim() : "";

  // Leer asunto (solo email)
  const asuntoEl = document.getElementById("nAsunto");
  const asunto = asuntoEl ? asuntoEl.value.trim() : "Notificacion TaskFlow";

  // Leer teléfono (WhatsApp / SMS)
  const telEl = document.getElementById("nTelefono");
  const telefonoRaw = telEl ? telEl.value.trim() : "";
  const codPais = document.getElementById("nCodPais")?.value || "+57";

  function normalizarTelefono(raw, codigo) {
    const limpio = (raw || "").replace(/[^\d+]/g, "");
    if (!limpio) return "";
    if (limpio.startsWith("+")) return "+" + limpio.slice(1).replace(/\D/g, "");
    const soloDigitos = limpio.replace(/\D/g, "");
    const prefijo = (codigo || "+57").replace(/[^\d+]/g, "");
    return `${prefijo}${soloDigitos}`;
  }
  const telefono = normalizarTelefono(telefonoRaw, codPais);

  const resEl = document.getElementById("nResultado");
  const errEl = document.getElementById("nError");
  const btn = document.getElementById("btnEnviarNotif");

  // Limpiar mensajes anteriores
  if (errEl) errEl.textContent = "";
  if (resEl) resEl.textContent = "";

  // Validaciones
  if (!userId) {
    if (errEl) errEl.textContent = "Selecciona un destinatario";
    return;
  }
  if (!mensaje) {
    if (errEl) errEl.textContent = "Escribe un mensaje";
    return;
  }
  // Para WhatsApp y SMS exigir número
  if ((canal === "whatsapp" || canal === "sms") && !telefono) {
    if (errEl)
      errEl.textContent = `Ingresa el número de teléfono para ${canal.toUpperCase()} (incluye código de país, ej: +573001234567)`;
    return;
  }

  // Deshabilitar botón mientras envía
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Enviando...';
  }
  if (resEl) resEl.innerHTML = '<span class="spinner"></span> Procesando...';

  try {
    // Construir body — siempre enviar contacto para WhatsApp/SMS
    const cuerpo = {
      canal,
      usuarioId: userId,
      mensaje,
      asunto: asunto || "Notificacion TaskFlow",
    };
    if (canal === "whatsapp" || canal === "sms") {
      cuerpo.contacto = telefono; // CORRECCIÓN: siempre incluir el número
    }

    const r = await api("POST", "/notificaciones/enviar-externo", cuerpo);

    const ok = r.enviada;
    const estado = (r.estado || "").toLowerCase();
    const entregado = estado === "delivered";
    const aceptado = [
      "accepted",
      "queued",
      "sending",
      "sent",
      "delivered",
    ].includes(estado);
    const etiqueta = entregado
      ? "Entregado"
      : aceptado
        ? "Aceptado por Twilio"
        : "No enviado";
    const ico = ok
      ? '<i class="ph ph-check-circle" style="color:var(--green)"></i>'
      : '<i class="ph ph-x-circle" style="color:var(--red)"></i>';

    if (resEl) {
      const estadoTxt = r.estado ? ` · estado: ${r.estado}` : "";
      const sidTxt = r.sid ? ` · SID: ${r.sid}` : "";
      const errTxt =
        r.codigo_error || r.mensaje_error
          ? ` · error_code: ${r.codigo_error || "-"} · ${r.mensaje_error || ""}`
          : "";
      resEl.innerHTML =
        `${ico} <strong>${etiqueta}</strong> por ${r.canal || canal}` +
        `${estadoTxt}${sidTxt}` +
        (r.contacto_usado ? ` → ${r.contacto_usado}` : "") +
        ` · ${r.detalle || ""}${errTxt}`;
    }

    toast(
      aceptado
        ? `Notificación aceptada por ${canal}`
        : `No se pudo enviar: ${r.detalle || "error"}`,
      aceptado ? "ok" : "err",
    );

    // Limpiar mensaje si se envió correctamente
    if (msgEl && ok) msgEl.value = "";
    if (telEl && ok && (canal === "whatsapp" || canal === "sms")) {
      telEl.value = telefono;
    }
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
    if (resEl)
      resEl.innerHTML = `<i class="ph ph-x-circle" style="color:var(--red)"></i> Error: ${e.message}`;
    toast(e.message, "err");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="ph ph-paper-plane-tilt"></i> Enviar notificación';
    }
  }
}

async function notifProbarTodos() {
  const userId = document.getElementById("nDestinatario")?.value || "";
  const telEl = document.getElementById("nTelefono");
  const telefonoRaw = telEl ? telEl.value.trim() : "";
  const codPais = document.getElementById("nCodPais")?.value || "+57";
  const resEl = document.getElementById("nResultado");
  const errEl = document.getElementById("nError");
  const btn = document.getElementById("btnProbarCanales");

  function normalizarTelefono(raw, codigo) {
    const limpio = (raw || "").replace(/[^\d+]/g, "");
    if (!limpio) return "";
    if (limpio.startsWith("+")) return "+" + limpio.slice(1).replace(/\D/g, "");
    const soloDigitos = limpio.replace(/\D/g, "");
    const prefijo = (codigo || "+57").replace(/[^\d+]/g, "");
    return `${prefijo}${soloDigitos}`;
  }
  const telefono = normalizarTelefono(telefonoRaw, codPais);

  if (errEl) errEl.textContent = "";
  if (resEl) resEl.textContent = "";
  if (!userId) {
    if (errEl) errEl.textContent = "Selecciona un destinatario";
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Probando...';
  }
  if (resEl)
    resEl.innerHTML = '<span class="spinner"></span> Probando canales...';

  try {
    const cuerpo = { usuarioId: userId };
    if (telefono) {
      cuerpo.contactoWhatsapp = telefono;
      cuerpo.contactoSms = telefono;
    }
    const r = await api("POST", "/notificaciones/probar-canales", cuerpo);
    const resultados = r.resultados || {};
    const orden = ["email", "whatsapp", "sms"];
    const html = orden
      .filter((c) => resultados[c])
      .map((c) => {
        const x = resultados[c] || {};
        const estado = (x.estado || "").toLowerCase();
        const aceptado = [
          "accepted",
          "queued",
          "sending",
          "sent",
          "delivered",
        ].includes(estado);
        return `${aceptado ? "✅" : "❌"} ${c.toUpperCase()}: ${x.detalle || "sin detalle"}${x.contacto_usado ? ` · ${x.contacto_usado}` : ""}`;
      })
      .join(" · ");
    if (resEl) resEl.textContent = html || "Sin resultados";
    toast("Prueba de canales completada");
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
    if (resEl) resEl.textContent = `Error: ${e.message}`;
    toast(e.message, "err");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-broadcast"></i> Probar todos';
    }
  }
}
