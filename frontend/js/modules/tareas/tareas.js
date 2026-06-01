/* ═══════════════════════════════════════════════════
   TaskFlow — modules/tareas/tareas.js
   Lógica del módulo Tareas (pantalla, creación, edición, responsables, etc.).
   Usa TareasAdapter para normalizar los datos.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.tareasAdapter;
  const payload = window.TF.modules.tareasPayload;
  const state = window.TF.state;

  let _estructuraEditarTarea = null;

  function _aDatetimeLocalInput(isoFecha) {
    if (!isoFecha) return "";
    const d = new Date(isoFecha);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function _refrescarVistaTrasCambioTarea() {
    const proyId = state.get("proyectoActualId");
    if (!proyId) return;
    const activa = document.querySelector(".pantalla.activa")?.id;
    if (activa === "pantalla-tareas" && typeof window.cargarTareasPaginadas === "function") {
      const pagina = typeof window._paginaTareas !== "undefined" ? window._paginaTareas : 1;
      await window.cargarTareasPaginadas(proyId, pagina);
      return;
    }
    if (activa === "pantalla-tablero" && typeof window.cargarTablero === "function") {
      await window.cargarTablero(proyId);
      return;
    }

    const tareasRefresh = typeof window.cargarTareasPaginadas === "function"
      ? window.cargarTareasPaginadas(proyId, typeof window._paginaTareas !== "undefined" ? window._paginaTareas : 1).catch(() => {})
      : Promise.resolve();
    const tableroRefresh = typeof window.cargarTablero === "function"
      ? window.cargarTablero(proyId).catch(() => {})
      : Promise.resolve();
    await Promise.all([tareasRefresh, tableroRefresh]);
  }

  function _opcionesFaseParaModal(fases = []) {
    return (
      '<option value="">Sin fase</option>' +
      fases.map((fase) => `<option value="${fase.id}">${fase.nombre}</option>`).join("")
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
    const proyId = state.get("proyectoActualId");
    if (!selFase || !selEtapa || !proyId) return;

    const fasePrev = selFase.value || "";
    const etapaPrev = selEtapa.value || "";
    const estructura = await window.cargarEstructuraProyecto(proyId);
    const fases = Array.isArray(estructura?.fases) ? estructura.fases : [];

    selFase.innerHTML = _opcionesFaseParaModal(fases);
    const faseActual = fases.some((fase) => fase.id === fasePrev) ? fasePrev : "";
    selFase.value = faseActual;
    _renderEtapasModalTarea(estructura, faseActual, etapaPrev);
  }

  async function onCambioFaseTarea() {
    const proyId = state.get("proyectoActualId");
    if (!proyId) return;
    try {
      const estructura = await window.cargarEstructuraProyecto(proyId);
      const faseId = document.getElementById("tFase")?.value || "";
      _renderEtapasModalTarea(estructura, faseId);
    } catch (e) {
      document.getElementById("tError").textContent = e.message;
    }
  }

  async function abrirModalTarea() {
    let proySeleccionado = state.get("proyectoActualId") || document.getElementById("selTareasProy")?.value || document.getElementById("selPT")?.value || "";
    if (proySeleccionado) state.set("proyectoActualId", proySeleccionado);
    const proyId = state.get("proyectoActualId");
    if (!proyId) {
      if (window.toast) window.toast("Primero selecciona un proyecto", "err");
      return;
    }
    const colsAct = window.colsActuales || [];
    document.getElementById("tCol").innerHTML = colsAct
      .map((c) => `<option value="${c.id}">${c.nombre}</option>`)
      .join("");
    document.getElementById("tError").textContent = "";
    document.getElementById("tTit").value = "";
    document.getElementById("tDesc").value = "";
    const selFase = document.getElementById("tFase");
    const selEtapa = document.getElementById("tEtapa");
    if (selFase) selFase.innerHTML = '<option value="">Cargando fases...</option>';
    if (selEtapa) selEtapa.innerHTML = '<option value="">Sin etapa</option>';
    if (window.abrirModal) window.abrirModal("mTarea");

    const cargaEstructura = _cargarEstructuraModalTarea().catch((e) => {
      document.getElementById("tError").textContent = e.message;
    });

    try {
      if (window._getUsuariosActivos) {
        window.miembrosActuales = await window._getUsuariosActivos();
      }
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
      const raw = await window.api("GET", `/tareas/${tareaId}`);
      const tarea = adapter.adaptTarea(raw);
      const proyId = tarea.proyectoId || state.get("proyectoActualId");
      if (proyId) state.set("proyectoActualId", proyId);
      const currentProyId = state.get("proyectoActualId");
      if (!currentProyId) throw new Error("No se pudo determinar el proyecto de la tarea");

      const [tableros, devs, estructura] = await Promise.all([
        window.api("GET", `/proyectos/${currentProyId}/tableros`).catch(() => []),
        window._getUsuariosActivos ? window._getUsuariosActivos().catch(() => []) : Promise.resolve([]),
        window.cargarEstructuraProyecto(currentProyId).catch(() => ({
          fases: [],
          fasesPorId: {},
          etapasPorFase: {},
          etapasPorId: {},
        })),
      ]);

      window.colsActuales = tableros[0]?.columnas || window.colsActuales || [];
      window.miembrosActuales = devs;
      _estructuraEditarTarea = estructura;

      document.getElementById("edTareaId").value = tarea.id;
      document.getElementById("edTit").value = tarea.titulo || "";
      document.getElementById("edDesc").value = tarea.descripcion || "";
      document.getElementById("edTipo").value = tarea.tipo || "TASK";
      document.getElementById("edPrio").value = tarea.prioridad || "MEDIA";
      document.getElementById("edFV").value = _aDatetimeLocalInput(tarea.fechaVencimiento);

      const selCol = document.getElementById("edCol");
      const colsAct = window.colsActuales || [];
      selCol.innerHTML = colsAct
        .map((c) => `<option value="${c.id}">${c.nombre}</option>`)
        .join("");
      selCol.value = colsAct.some((c) => c.id === tarea.columnaId)
        ? tarea.columnaId
        : colsAct[0]?.id || "";
      document.getElementById("edColOriginal").value = tarea.columnaId || "";

      const fases = Array.isArray(estructura?.fases) ? estructura.fases : [];
      let faseInicial = tarea.faseId || "";
      let etapaInicial = tarea.etapaId || "";
      if (window.resolverContextoEstructura) {
        const contexto = window.resolverContextoEstructura(estructura, tarea.faseId, tarea.etapaId);
        faseInicial = tarea.faseId || contexto.fase?.id || "";
        etapaInicial = tarea.etapaId || contexto.etapa?.id || "";
      }
      const selFase = document.getElementById("edFase");
      selFase.innerHTML = _opcionesFaseParaModal(fases);
      selFase.value = fases.some((f) => f.id === faseInicial) ? faseInicial : "";
      _renderEtapasModalEditarTarea(selFase.value, etapaInicial);

      renderRespLista("edRespLista", tarea.responsables || []);
      if (window.abrirModal) window.abrirModal("mEditarTarea");
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
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

    const data = payload.actualizarTarea({
      titulo,
      descripcion: descripcion || null,
      tipo: document.getElementById("edTipo").value,
      prioridad: document.getElementById("edPrio").value,
      fechaVencimiento: document.getElementById("edFV").value || null,
      faseId,
      etapaId,
      responsables: getSeleccionados("edRespLista"),
    });

    try {
      await window.api("PUT", `/tareas/${tareaId}`, data);
      if (colNuevo && colNuevo !== colOriginal) {
        await window.api("POST", `/tareas/${tareaId}/mover`, {
          columnaIdDestino: colNuevo,
        });
      }
      if (window.cerrarModal) window.cerrarModal("mEditarTarea");
      if (window.toast) window.toast("Tarea actualizada");
      await _refrescarVistaTrasCambioTarea();
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
    }
  }

  function renderRespLista(contenedorId, seleccionados) {
    const c = document.getElementById(contenedorId);
    const devs = window.miembrosActuales || [];
    if (!devs.length) {
      c.innerHTML = '<span class="txt3">Sin developers disponibles</span>';
      return;
    }
    c.innerHTML = devs
      .map(
        (m) => `
      <div class="resp-chip ${seleccionados.includes(m.id) ? "sel" : ""}"
        onclick="window.toggleResp(this,'${m.id}','${contenedorId}')" data-id="${m.id}">
        <div class="avatar avatar-sm">${window.inic ? window.inic(m.nombre) : ""}</div>
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
    const proyId = state.get("proyectoActualId");
    try {
      const data = payload.crearTarea({
        titulo: document.getElementById("tTit").value,
        descripcion: document.getElementById("tDesc").value || null,
        tipo: document.getElementById("tTipo").value,
        prioridad: document.getElementById("tPrio").value,
        columnaId: colId,
        proyectoId: proyId,
        faseId,
        etapaId,
        fechaVencimiento: document.getElementById("tFV").value || null,
        responsables: getSeleccionados("respLista"),
        etiquetas: [],
      });
      await window.api("POST", "/tareas", data);
      if (window.cerrarModal) window.cerrarModal("mTarea");
      if (window.toast) window.toast("Tarea creada");
      await _refrescarVistaTrasCambioTarea();
    } catch (e) {
      document.getElementById("tError").textContent = e.message;
    }
  }

  async function abrirAsignar(tareaId) {
    document.getElementById("asignarTareaId").value = tareaId;
    const proyId = state.get("proyectoActualId");
    if (!proyId) {
      if (window.toast) window.toast("Primero carga un proyecto", "err");
      return;
    }
    document.getElementById("asignarLista").innerHTML = '<span class="spinner"></span>';
    if (window.abrirModal) window.abrirModal("mAsignar");
    try {
      const [devs, raw] = await Promise.all([
        window._getUsuariosActivos ? window._getUsuariosActivos() : Promise.resolve([]),
        window.api("GET", `/tareas/${tareaId}`),
      ]);
      const tarea = adapter.adaptTarea(raw);
      window.miembrosActuales = devs;
      renderRespLista("asignarLista", tarea.responsables || []);
    } catch (e) {
      if (window.cerrarModal) window.cerrarModal("mAsignar");
      if (window.toast) window.toast(e.message, "err");
    }
  }

  async function guardarAsignacion() {
    const tareaId = document.getElementById("asignarTareaId").value;
    const sel = getSeleccionados("asignarLista");
    try {
      await window.api("PUT", `/tareas/${tareaId}/responsables`, { responsables: sel });
      if (window.cerrarModal) window.cerrarModal("mAsignar");
      if (window.toast) window.toast("Responsables asignados");
      await _refrescarVistaTrasCambioTarea();
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  async function clonarTarea(id) {
    try {
      await window.api("POST", `/tareas/${id}/clonar`);
      if (window.toast) window.toast("Tarea clonada");
      await _refrescarVistaTrasCambioTarea();
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
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
    if (window.abrirModal) window.abrirModal("mEliminarTarea");
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
      await window.api("DELETE", `/tareas/${tareaId}`);
      if (window.cerrarModal) window.cerrarModal("mEliminarTarea");
      if (window.toast) window.toast("Tarea eliminada");
      await _refrescarVistaTrasCambioTarea();
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
    }
  }

  // Exponer a global
  window.onCambioFaseTarea = onCambioFaseTarea;
  window.abrirModalTarea = abrirModalTarea;
  window.abrirModalTareaCol = abrirModalTareaCol;
  window.onCambioFaseEditarTarea = onCambioFaseEditarTarea;
  window.abrirEditarTarea = abrirEditarTarea;
  window.guardarEdicionTarea = guardarEdicionTarea;
  window.toggleResp = toggleResp;
  window.crearTarea = crearTarea;
  window.abrirAsignar = abrirAsignar;
  window.guardarAsignacion = guardarAsignacion;
  window.clonarTarea = clonarTarea;
  window.eliminarTarea = eliminarTarea;
  window.confirmarEliminarTarea = confirmarEliminarTarea;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("tareas", {
    name: "tareas",
    htmlPath: "js/modules/tareas/tareas.html",
    cssPath: null,
    adapter: adapter,
    payload: payload,
    init: function () {
      const proyId = state.get("proyectoActualId");
      if (proyId && window.cargarTareasPaginadas) {
        window.cargarTareasPaginadas(proyId, 1);
      }
    },
  });
})();
