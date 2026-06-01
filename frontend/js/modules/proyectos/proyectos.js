/* ═══════════════════════════════════════════════════
   TaskFlow — modules/proyectos/proyectos.js
   Lógica del módulo Proyectos (pantalla y estructura jerárquica).
   Usa ProyectosAdapter para normalizar los datos.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.proyectosAdapter;
  const payload = window.TF.modules.proyectosPayload;
  const state = window.TF.state;

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
    const usuario = state.get("usuario");
    return ["PROJECT_MANAGER", "ADMIN"].includes(usuario?.rol);
  }

  function _puedeGestionarSubtareasEtapa() {
    const usuario = state.get("usuario");
    return ["DEVELOPER", "PROJECT_MANAGER", "ADMIN"].includes(usuario?.rol);
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
      const raw = await window.api("GET", `/proyectos/${proyectoId}/jerarquia`);
      const jerarquia = adapter.adaptNodoJerarquia(raw);
      if (window.invalidarCacheEstructuraProyecto) {
        window.invalidarCacheEstructuraProyecto(proyectoId);
      }
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
      if (window.toast) window.toast("Selecciona un proyecto primero", "err");
      return;
    }
    await _jpCargarJerarquia(proyectoId);
  }

  async function abrirJerarquiaProyecto(proyectoId) {
    if (!proyectoId) return;
    if (window.mostrarPantalla) window.mostrarPantalla("proyectos");
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
      if (window.toast) window.toast("No tienes permisos para crear fases", "err");
      return;
    }
    const proyId = proyectoId || document.getElementById("selJerarquiaProy")?.value || _jerarquiaProyectoId;
    if (!proyId) {
      if (window.toast) window.toast("Selecciona un proyecto primero", "err");
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
    if (window.abrirModal) window.abrirModal("mJerarquiaFase");
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
      const data = payload.crearFase({ nombre, descripcion });
      await window.api("POST", `/proyectos/${proyectoId}/fases`, data);
      if (window.invalidarCacheEstructuraProyecto) {
        window.invalidarCacheEstructuraProyecto(proyectoId);
      }
      if (window.cerrarModal) window.cerrarModal("mJerarquiaFase");
      if (window.toast) window.toast("Fase creada");
      await _jpCargarJerarquia(proyectoId, true);
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
    }
  }

  function abrirModalCrearEtapaJerarquia(faseId) {
    if (!_puedeEditarEstructuraProyecto()) {
      if (window.toast) window.toast("No tienes permisos para crear etapas", "err");
      return;
    }
    if (!faseId) {
      if (window.toast) window.toast("Fase no válida", "err");
      return;
    }
    _jpModalEtapaFaseId = faseId;
    const fase = _jerarquiaNodoPorId[faseId] || {};
    document.getElementById("jeFaseId").value = faseId;
    document.getElementById("jeFaseLabel").textContent = fase.titulo || faseId;
    document.getElementById("jeNombre").value = "";
    document.getElementById("jeDesc").value = "";
    document.getElementById("jeError").textContent = "";
    if (window.abrirModal) window.abrirModal("mJerarquiaEtapa");
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
      const data = payload.crearEtapa({ nombre, descripcion });
      await window.api("POST", `/proyectos/fases/${faseId}/etapas`, data);
      if (proyectoId && window.invalidarCacheEstructuraProyecto) {
        window.invalidarCacheEstructuraProyecto(proyectoId);
      }
      if (window.cerrarModal) window.cerrarModal("mJerarquiaEtapa");
      if (window.toast) window.toast("Etapa creada");
      await _jpCargarJerarquia(proyectoId, true);
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
    }
  }

  function abrirModalCrearSubtareaEtapaJerarquia(etapaId) {
    if (!_puedeGestionarSubtareasEtapa()) {
      if (window.toast) window.toast("No tienes permisos para crear subtareas", "err");
      return;
    }
    if (!etapaId) {
      if (window.toast) window.toast("Etapa no válida", "err");
      return;
    }
    _jpModalSubtareaEtapaId = etapaId;
    const etapa = _jerarquiaNodoPorId[etapaId] || {};
    document.getElementById("jsEtapaId").value = etapaId;
    document.getElementById("jsEtapaLabel").textContent = etapa.titulo || etapaId;
    document.getElementById("jsTitulo").value = "";
    document.getElementById("jsDesc").value = "";
    document.getElementById("jsError").textContent = "";
    if (window.abrirModal) window.abrirModal("mJerarquiaSubtareaEtapa");
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
      await window.api("POST", `/etapas/${etapaId}/subtareas`, {
        titulo,
        descripcion: descripcion || null,
      });
      if (window.cerrarModal) window.cerrarModal("mJerarquiaSubtareaEtapa");
      if (window.toast) window.toast("Subtarea creada en etapa");
      await _jpCargarJerarquia(proyectoId, true);
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
    }
  }

  function abrirModalEditarNodoJerarquia(tipo, nodoId) {
    if (!_puedeEditarEstructuraProyecto()) {
      if (window.toast) window.toast("No tienes permisos para editar esta estructura", "err");
      return;
    }
    const tipoNormalizado = String(tipo || "").toLowerCase() === "fase" ? "fase" : "etapa";
    const nodo = _jerarquiaNodoPorId[nodoId];
    if (!nodo) {
      if (window.toast) window.toast("Elemento de jerarquía no encontrado", "err");
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

    if (window.abrirModal) window.abrirModal("mJerarquiaEditarNodo");
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
      if (window.cerrarModal) window.cerrarModal("mJerarquiaEditarNodo");
      return;
    }

    const proyectoId = _jerarquiaProyectoId || document.getElementById("selJerarquiaProy")?.value || "";
    const endpoint = tipo === "fase" ? `/proyectos/fases/${nodoId}` : `/proyectos/etapas/${nodoId}`;
    const okMsg = tipo === "fase" ? "Fase actualizada" : "Etapa actualizada";
    try {
      await window.api("PUT", endpoint, { nombre });
      if (proyectoId && window.invalidarCacheEstructuraProyecto) {
        window.invalidarCacheEstructuraProyecto(proyectoId);
      }
      if (window.cerrarModal) window.cerrarModal("mJerarquiaEditarNodo");
      if (window.toast) window.toast(okMsg);
      await _jpCargarJerarquia(proyectoId, true);
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
    }
  }

  function abrirModalEliminarNodoJerarquia(tipo, nodoId) {
    if (!_puedeEditarEstructuraProyecto()) {
      if (window.toast) window.toast("No tienes permisos para eliminar esta estructura", "err");
      return;
    }
    const tipoNormalizado = String(tipo || "").toLowerCase() === "fase" ? "fase" : "etapa";
    const nodo = _jerarquiaNodoPorId[nodoId];
    if (!nodo) {
      if (window.toast) window.toast("Elemento de jerarquía no encontrado", "err");
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
    if (window.abrirModal) window.abrirModal("mJerarquiaEliminarNodo");
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
      await window.api("DELETE", endpoint);
      if (proyectoId && window.invalidarCacheEstructuraProyecto) {
        window.invalidarCacheEstructuraProyecto(proyectoId);
      }
      if (window.cerrarModal) window.cerrarModal("mJerarquiaEliminarNodo");
      if (window.toast) window.toast(okMsg);
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
      if (window.toast) window.toast("Selecciona un proyecto primero", "err");
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
        await window.api("POST", `/subtareas/${id}/toggle`);
        return await _jpCargarJerarquia(proyectoId, true);
      }

      if (tipo === "eliminar-subtarea") {
        if (!confirm("¿Eliminar esta subtarea?")) return;
        await window.api("DELETE", `/subtareas/${id}`);
        if (window.toast) window.toast("Subtarea eliminada");
        return await _jpCargarJerarquia(proyectoId, true);
      }
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
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

    const proyActId = state.get("proyectoActualId");
    const porDefecto = proyActId && proyectos.some((p) => p.id === proyActId)
      ? proyActId
      : proyectos[0].id;

    sel.value = porDefecto;
    _jerarquiaProyectoId = porDefecto;
    return porDefecto;
  }

  async function cargarProyectos() {
    if (!state.get("sesionActiva")) return;
    const acciones = document.getElementById("proyAcciones");
    const usuario = state.get("usuario") || {};
    if (usuario.rol === "PROJECT_MANAGER" || usuario.rol === "ADMIN") {
      if (acciones) {
        acciones.innerHTML = `<button class="btn btn-primary btn-sm" onclick="window.abrirModal('mProy')"><i class="ph ph-plus"></i> Nuevo proyecto</button>`;
      }
    } else if (acciones) {
      acciones.innerHTML = "";
    }
    const lista = document.getElementById("listaProyectos");
    if (lista) lista.innerHTML = "Cargando...";
    try {
      const res = await window.api("GET", "/proyectos/");
      const ps = adapter.adapt(res);
      if (!ps.length) {
        document.getElementById("listaProyectos").innerHTML = '<div class="vacío">No hay proyectos</div>';
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
              ${window.badgeEstado ? window.badgeEstado(p.estado) : `<span class="badge">${p.estado}</span>`}
            </div>
            <div class="prow-desc">${p.descripcion || "Sin descripción"}</div>
            <div class="prow-meta">
              <span><i class="ph ph-calendar-blank"></i> Fin: ${window.fFecha ? window.fFecha(p.fechaFinEstimada) : p.fechaFinEstimada}</span>
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
              usuario.rol !== "DEVELOPER"
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
      if (window.toast) window.toast(e.message, "err");
      _jpSetError(e.message || "No se pudieron cargar proyectos");
    }
  }

  async function crearProyecto() {
    document.getElementById("pError").textContent = "";
    try {
      const data = payload.crearProyecto({
        nombre: document.getElementById("pNom").value,
        descripcion: document.getElementById("pDesc").value,
        fechaInicio: document.getElementById("pFI").value,
        fechaFinEstimada: document.getElementById("pFF").value,
      });
      await window.api("POST", "/proyectos/", data);
      if (window.cerrarModal) window.cerrarModal("mProy");
      if (window.toast) window.toast("Proyecto creado");
      cargarProyectos();
    } catch (e) {
      document.getElementById("pError").textContent = e.message;
    }
  }

  async function archivarProyecto(id) {
    if (!confirm("¿Archivar este proyecto?")) return;
    try {
      await window.api("POST", `/proyectos/${id}/archivar`);
      if (window.toast) window.toast("Proyecto archivado");
      cargarProyectos();
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  async function clonarProyecto(id) {
    try {
      await window.api("POST", `/proyectos/${id}/clonar`);
      if (window.toast) window.toast("Proyecto clonado");
      cargarProyectos();
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  async function abrirReglasDecorador(proyId) {
    const errorEl = document.getElementById("rdError");
    if (errorEl) errorEl.textContent = "";
    try {
      const res = await window.api("GET", `/proyectos/${proyId}`);
      const proyecto = adapter.adaptProyecto(res);
      const reglas = {
        ..._REGLAS_DECORATOR_DEFAULTS,
        ...(proyecto.reglasDecoradores || {}),
      };

      document.getElementById("rdProyectoId").value = proyId;
      document.getElementById("rdProyectoTitulo").textContent = proyecto.nombre || proyId;
      document.getElementById("rdMaxHoras").value = Number(
        reglas.maxHorasPorTarea ?? _REGLAS_DECORATOR_DEFAULTS.maxHorasPorTarea,
      );
      _toggleSet("rdAudit", reglas.auditoriaEnriquecidaActiva);
      _toggleSet("rdNotif", reglas.notificacionAutomaticaActiva);
      _toggleSet("rdSla", reglas.validacionSlaActiva);
      _toggleSet("rdBugUrgente", reglas.notificarBugUrgenteAlPm);
      _toggleSet("rdMoverEnProgreso", reglas.validarHorasAntesDeMoverEnProgreso);
      if (window.abrirModal) window.abrirModal("mReglasDecorator");
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
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
      if (errorEl) {
        errorEl.textContent = "El máximo de horas debe ser un número >= 0";
      }
      return;
    }

    try {
      const data = payload.actualizarReglas({
        auditoriaEnriquecidaActiva: _toggleGet("rdAudit"),
        notificacionAutomaticaActiva: _toggleGet("rdNotif"),
        validacionSlaActiva: _toggleGet("rdSla"),
        maxHorasPorTarea: maxHoras,
        notificarBugUrgenteAlPm: _toggleGet("rdBugUrgente"),
        validarHorasAntesDeMoverEnProgreso: _toggleGet("rdMoverEnProgreso"),
      });
      await window.api("PUT", `/proyectos/${proyId}`, data);
      if (window.cerrarModal) window.cerrarModal("mReglasDecorator");
      if (window.toast) window.toast("Reglas actualizadas");
      if (document.querySelector(".pantalla.activa")?.id === "pantalla-proyectos") {
        cargarProyectos();
      }
    } catch (e) {
      if (errorEl) errorEl.textContent = e.message;
    }
  }

  // Exponer a global
  window.seleccionarProyectoJerarquia = seleccionarProyectoJerarquia;
  window.refrescarJerarquiaProyecto = refrescarJerarquiaProyecto;
  window.abrirJerarquiaProyecto = abrirJerarquiaProyecto;
  window.confirmarCrearFaseJerarquia = confirmarCrearFaseJerarquia;
  window.confirmarCrearEtapaJerarquia = confirmarCrearEtapaJerarquia;
  window.confirmarCrearSubtareaEtapaJerarquia = confirmarCrearSubtareaEtapaJerarquia;
  window.confirmarEditarNodoJerarquia = confirmarEditarNodoJerarquia;
  window.confirmarEliminarNodoJerarquia = confirmarEliminarNodoJerarquia;
  window.crearFaseJerarquia = crearFaseJerarquia;
  window.jpAccion = jpAccion;
  window.cargarProyectos = cargarProyectos;
  window.crearProyecto = crearProyecto;
  window.archivarProyecto = archivarProyecto;
  window.clonarProyecto = clonarProyecto;
  window.abrirReglasDecorador = abrirReglasDecorador;
  window.guardarReglasDecorador = guardarReglasDecorador;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("proyectos", {
    name: "proyectos",
    htmlPath: "js/modules/proyectos/proyectos.html",
    cssPath: null,
    adapter: adapter,
    payload: payload,
    init: cargarProyectos,
  });
})();
