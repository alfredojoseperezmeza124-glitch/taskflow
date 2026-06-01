/* ═══════════════════════════════════════════════════
   TaskFlow — modules/tablero/tablero.js
   Lógica del tablero Kanban (Drag & drop, columnas y tarjetas).
   Usa TableroAdapter para normalizar los datos.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.tableroAdapter;
  const payload = window.TF.modules.tableroPayload;
  const state = window.TF.state;

  let dragTareaId = null;
  let dragColOrigenId = null;
  let placeholder = null;
  let _estructuraTableroProyecto = null;
  let _subtareasEtapaKanban = [];

  function _escTablero(valor = "") {
    return String(valor)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function _contextoSubtareaEtapaKanban(subtarea) {
    if (!window.resolverContextoEstructura) {
      return { faseNombre: subtarea.faseNombre || "", etapaNombre: subtarea.etapaNombre || "" };
    }
    const { fase, etapa } = window.resolverContextoEstructura(
      _estructuraTableroProyecto,
      subtarea.faseId,
      subtarea.etapaId,
    );
    const faseNombre = subtarea.faseNombre || fase?.nombre || "";
    const etapaNombre = subtarea.etapaNombre || etapa?.nombre || "";
    return { faseNombre, etapaNombre };
  }

  function _tarjetaSubtareaEtapaKanban(subtarea) {
    const { faseNombre, etapaNombre } = _contextoSubtareaEtapaKanban(subtarea);
    const estado = subtarea.completada
      ? '<span class="badge bg">Completada</span>'
      : '<span class="badge ba">Pendiente</span>';
    const resps = (subtarea.responsables || [])
      .slice(0, 3)
      .map((id) => {
        const miembro = (window.miembrosActuales || []).find((m) => m.id === id);
        return `<div class="avatar avatar-sm" title="${_escTablero(miembro?.nombre || id)}">${window.inic ? window.inic(miembro?.nombre || "?") : ""}</div>`;
      })
      .join("");

    return `<div class="k-card">
      <div class="k-card-tags">
        <span class="badge bm">subtarea etapa</span>
        ${faseNombre ? `<span class="badge ba">${_escTablero(faseNombre)}</span>` : ""}
        ${etapaNombre ? `<span class="badge bi">${_escTablero(etapaNombre)}</span>` : ""}
        ${estado}
      </div>
      <div class="k-card-title">${_escTablero(subtarea.titulo || "Subtarea")}</div>
      <div class="k-card-meta">
        <span class="k-card-id">#${String(subtarea.id || "").slice(-6)}</span>
        <div class="flex" style="gap:4px">
          <div class="avatar-group">${resps || '<span class="txt3">—</span>'}</div>
          <button class="btn btn-outline btn-xs" onclick="toggleSubtareaEtapaKanban('${subtarea.id}')">
            ${subtarea.completada ? "Reabrir" : "Completar"}
          </button>
        </div>
      </div>
    </div>`;
  }

  function _columnaSubtareasEtapaKanban() {
    const subtareas = Array.isArray(_subtareasEtapaKanban) ? _subtareasEtapaKanban : [];
    const contenido = subtareas.length
      ? subtareas.map((sub) => _tarjetaSubtareaEtapaKanban(sub)).join("")
      : '<div class="vacío" style="padding:14px">Sin subtareas de etapa</div>';
    return `
      <div class="k-col" id="col-etapas-static">
        <div class="k-col-head">
          <div class="k-col-title">
            <div class="k-col-dot" style="background:var(--a2)"></div>
            Subtareas de etapa
          </div>
          <span class="k-col-cnt">${subtareas.length}</span>
        </div>
        <div class="k-wip">Sin columna Kanban</div>
        <div class="k-cards">
          ${contenido}
        </div>
      </div>`;
  }

  async function toggleSubtareaEtapaKanban(subtareaId) {
    try {
      await window.api("POST", `/subtareas/${subtareaId}/toggle`);
      const proyId = state.get("proyectoActualId");
      if (proyId) await cargarTablero(proyId);
      if (window.toast) window.toast("Subtarea actualizada");
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  async function cargarSelectores() {
    if (!state.get("sesionActiva")) return;
    try {
      const ps = await window.api("GET", "/proyectos/");
      const opts =
        '<option value="">— Selecciona un proyecto —</option>' +
        ps.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join("");
      ["selPT", "selTareasProy", "selReporteProy", "selHistProy"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const valorAnterior = el.value;
        el.innerHTML = opts;
        if (valorAnterior && ps.some((p) => p.id === valorAnterior)) {
          el.value = valorAnterior;
        } else {
          el.value = "";
        }
      });
    } catch (_) {}
  }

  function irTablero(id, nombre) {
    state.set("proyectoActualId", id);
    if (window.mostrarPantalla) window.mostrarPantalla("tablero");
    setTimeout(() => {
      const sel = document.getElementById("selPT");
      const bc = document.getElementById("tBreadcrumb");
      if (sel) sel.value = id;
      if (bc) bc.textContent = nombre;
      cargarTablero(id);
    }, 0);
  }

  async function cargarTablero(proyId) {
    if (!proyId) return;
    const sel = document.getElementById("selPT");
    if (sel && sel.value && sel.value !== proyId) return;
    state.set("proyectoActualId", proyId);
    const board = document.getElementById("kanbanBoard");
    if (board) {
      board.innerHTML = '<div class="vacío" style="width:100%"><span class="spinner"></span> Cargando...</div>';
    }
    try {
      const [resTableros, miembros, estructura, resSubtareasEtapa] = await Promise.all([
        window.api("GET", `/proyectos/${proyId}/tableros`),
        window.api("GET", `/proyectos/${proyId}/miembros`).catch(() => []),
        window.cargarEstructuraProyecto(proyId).catch(() => ({
          fases: [],
          fasesPorId: {},
          etapasPorFase: {},
          etapasPorId: {},
        })),
        window.api("GET", `/proyectos/${proyId}/subtareas-etapa`).catch(() => []),
      ]);

      const tableros = adapter.adapt(resTableros);
      _estructuraTableroProyecto = estructura;
      _subtareasEtapaKanban = (Array.isArray(resSubtareasEtapa) ? resSubtareasEtapa : []).map(s => adapter.adaptSubtareaEtapa(s));
      window.miembrosActuales = miembros;
      if (!tableros.length) {
        if (board) board.innerHTML = '<div class="vacío" style="width:100%">Sin tableros</div>';
        return;
      }
      window.colsActuales = tableros[0].columnas || [];
      const bc = document.getElementById("tBreadcrumb");
      if (bc) bc.textContent = tableros[0].nombre;

      const cols = await Promise.all(
        window.colsActuales.map(async (col) => {
          const tareas = await window.api("GET", `/columnas/${col.id}/tareas`);
          return { ...col, tareas };
        }),
      );

      const columnasKanban = cols
        .map(
          (c) => `
        <div class="k-col" id="col-${c.id}" data-col-id="${c.id}">
          <div class="k-col-head">
            <div class="k-col-title">
              <div class="k-col-dot" style="background:${colColor(c.nombre)}"></div>
              ${c.nombre}
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="k-col-cnt" id="cnt-${c.id}">${c.tareas.length}${c.limiteWip ? "/" + c.limiteWip : ""}</span>
              <button class="btn btn-ghost btn-xs" style="color:var(--t3)"
                onclick="eliminarColumna('${c.id}')" title="Eliminar columna"><i class="ph ph-x"></i></button>
            </div>
          </div>
          ${c.limiteWip ? `<div class="k-wip">WIP: ${c.tareas.length}/${c.limiteWip}</div>` : ""}
          <div class="k-cards" id="cards-${c.id}" data-col-id="${c.id}">
            ${c.tareas.map((t) => tarjeta(t)).join("")}
          </div>
          <div class="k-add" onclick="abrirModalTareaCol('${c.id}')"><i class='ph ph-plus'></i> Agregar tarea</div>
        </div>`,
        )
        .join("");
      if (board) {
        board.innerHTML =
          _columnaSubtareasEtapaKanban() +
          columnasKanban +
          `<div class="k-col-nueva" onclick="agregarColumna()">
            <span class="k-col-nueva-icon"><i class='ph ph-plus-circle'></i></span>
            <span>Nueva columna</span>
          </div>`;
      }

      iniciarDragDrop();
    } catch (e) {
      if (board) board.innerHTML = `<div class="vacío" style="width:100%">Error: ${e.message}</div>`;
    }
  }

  function colColor(nombre) {
    const n = nombre.toLowerCase();
    if (n.includes("hacer") || n.includes("backlog")) return "var(--txt3)";
    if (n.includes("progreso") || n.includes("proceso")) return "var(--acento)";
    if (n.includes("revisi")) return "var(--ambar)";
    if (n.includes("complet") || n.includes("listo")) return "var(--verde)";
    return "var(--cyan)";
  }

  function tarjeta(t) {
    const resps = (t.responsables || [])
      .slice(0, 3)
      .map((id) => {
        const m = (window.miembrosActuales || []).find((m) => m.id === id);
        return `<div class="avatar avatar-sm" title="${m?.nombre || id}">${window.inic ? window.inic(m?.nombre || "?") : ""}</div>`;
      })
      .join("");

    const nSubtareas = (t.subtareas || []).length;
    let fase = null;
    let etapa = null;
    if (window.resolverContextoEstructura) {
      const res = window.resolverContextoEstructura(_estructuraTableroProyecto, t.faseId, t.etapaId);
      fase = res.fase;
      etapa = res.etapa;
    }

    return `<div class="k-card" draggable="true" data-tarea-id="${t.id}" data-col-id="${t.columnaId}">
      <div class="k-card-tags">
        <div class="prio ${window.colPrio ? window.colPrio(t.prioridad) : ""}"></div>
        ${window.badgeTipo ? window.badgeTipo(t.tipo) : `<span class="badge">${t.tipo}</span>`}
        ${fase ? `<span class="badge ba" title="Fase">${_escTablero(fase.nombre)}</span>` : ""}
        ${etapa ? `<span class="badge bi" title="Etapa">${_escTablero(etapa.nombre)}</span>` : ""}
        ${!fase && !etapa ? '<span class="badge bm" title="Tarea legada sin estructura">Sin fase/etapa</span>' : ""}
        ${t.estaVencida ? '<span class="badge br">Vencida</span>' : ""}
        ${nSubtareas > 0 ? `<span class="badge bm" title="Subtareas"><i class="ph ph-tree-structure" style="font-size:9px"></i> ${nSubtareas}</span>` : ""}
      </div>
      <div class="k-card-title">${t.titulo}</div>
      <div class="k-card-meta">
        <span class="k-card-id">#${t.id.slice(-6)}</span>
        <div class="flex" style="gap:4px">
          <div class="avatar-group">${resps}</div>
          <button class="btn btn-ghost btn-xs" onclick="abrirPanelSubtareas('${t.id}','${t.titulo.replace(/'/g, "\\'")}')"
            title="Subtareas y jerarquía" style="color:var(--a2)">
            <i class="ph ph-tree-structure"></i>
          </button>
          <button class="btn btn-ghost btn-xs" onclick="abrirPanelComentarios('${t.id}','${t.titulo.replace(/'/g, "\\'")}')">
            <i class="ph ph-chat-circle-text"></i>
          </button>
          <button class="btn btn-ghost btn-xs" onclick="abrirEditarTarea('${t.id}')" title="Editar">
            <i class="ph ph-pencil-simple"></i>
          </button>
          <button class="btn btn-ghost btn-xs" onclick="abrirAsignar('${t.id}')" title="Asignar"><i class="ph ph-user-plus"></i></button>
          <button class="btn btn-ghost btn-xs" onclick="clonarTarea('${t.id}')" title="Clonar"><i class="ph ph-copy"></i></button>
          <button class="btn btn-red btn-xs" onclick="eliminarTarea('${t.id}')" title="Eliminar"><i class="ph ph-trash"></i></button>
        </div>
      </div>
    </div>`;
  }

  function iniciarDragDrop() {
    document.querySelectorAll(".k-cards[data-col-id]").forEach((zona) => {
      zona.addEventListener("dragover", onDragOver);
      zona.addEventListener("dragenter", onDragEnter);
      zona.addEventListener("dragleave", onDragLeave);
      zona.addEventListener("drop", onDrop);
    });
    document.querySelectorAll(".k-card").forEach((card) => {
      card.addEventListener("dragstart", onDragStart);
      card.addEventListener("dragend", onDragEnd);
    });
  }

  function onDragStart(e) {
    dragTareaId = this.dataset.tareaId;
    dragColOrigenId = this.dataset.colId;
    this.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragTareaId);
    placeholder = document.createElement("div");
    placeholder.className = "k-card drag-placeholder";
    placeholder.style.height = this.offsetHeight + "px";
  }

  function onDragEnd() {
    this.classList.remove("dragging");
    placeholder?.remove();
    placeholder = null;
    document.querySelectorAll(".k-col").forEach((c) => c.classList.remove("drag-over"));
  }

  function onDragEnter(e) {
    e.preventDefault();
    e.currentTarget.closest(".k-col")?.classList.add("drag-over");
  }

  function onDragLeave(e) {
    const zona = e.currentTarget;
    if (!zona.contains(e.relatedTarget)) {
      zona.closest(".k-col")?.classList.remove("drag-over");
    }
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!placeholder) return;
    const zona = e.currentTarget;
    const cardDebajo = obtenerCardDebajo(zona, e.clientY);
    if (cardDebajo) zona.insertBefore(placeholder, cardDebajo);
    else zona.appendChild(placeholder);
  }

  async function onDrop(e) {
    e.preventDefault();
    const zona = e.currentTarget;
    const colDestinoId = zona.dataset.colId;
    zona.closest(".k-col")?.classList.remove("drag-over");
    placeholder?.remove();
    if (!dragTareaId || colDestinoId === dragColOrigenId) return;

    const cardEl = document.querySelector(`[data-tarea-id="${dragTareaId}"]`);
    if (cardEl) {
      cardEl.dataset.colId = colDestinoId;
      zona.appendChild(cardEl);
      actualizarContadores(dragColOrigenId, colDestinoId);
    }
    try {
      const data = payload.moverTarea(colDestinoId);
      await window.api("POST", `/tareas/${dragTareaId}/mover`, data);
      if (window.toast) window.toast("Tarea movida");
    } catch (err) {
      const colOrigen = document.getElementById(`cards-${dragColOrigenId}`);
      if (cardEl && colOrigen) {
        cardEl.dataset.colId = dragColOrigenId;
        colOrigen.appendChild(cardEl);
        actualizarContadores(colDestinoId, dragColOrigenId);
      }
      if (window.toast) window.toast(err.message, "err");
    }
  }

  function actualizarContadores(colOrigenId, colDestinoId) {
    [colOrigenId, colDestinoId].forEach((id) => {
      const zona = document.getElementById(`cards-${id}`);
      const cnt = document.getElementById(`cnt-${id}`);
      if (!zona || !cnt) return;
      const total = zona.querySelectorAll(".k-card:not(.drag-placeholder)").length;
      const match = cnt.textContent.match(/\/\d+/);
      cnt.textContent = total + (match ? match[0] : "");
    });
  }

  function obtenerCardDebajo(zona, y) {
    const cards = [...zona.querySelectorAll(".k-card:not(.dragging):not(.drag-placeholder)")];
    return cards.reduce((mejor, card) => {
      const rect = card.getBoundingClientRect();
      const offset = y - (rect.top + rect.height / 2);
      if (offset < 0 && offset > (mejor?.offset ?? -Infinity)) {
        return { offset, elemento: card };
      }
      return mejor;
    }, null)?.elemento;
  }

  async function eliminarColumna(colId) {
    if (!confirm("La columna debe estar vacía para eliminarla. ¿Continuar?")) return;
    try {
      await window.api("DELETE", `/columnas/${colId}`);
      if (window.toast) window.toast("Columna eliminada");
      const proyId = state.get("proyectoActualId");
      if (proyId) await cargarTablero(proyId);
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  function agregarColumna() {
    const proyId = state.get("proyectoActualId");
    if (!proyId) {
      if (window.toast) window.toast("Primero selecciona un proyecto", "err");
      return;
    }
    document.getElementById("colNombre").value = "";
    document.getElementById("colError").textContent = "";
    if (window.abrirModal) window.abrirModal("mColumna");
    setTimeout(() => document.getElementById("colNombre").focus(), 100);
  }

  async function confirmarAgregarColumna() {
    const nombre = document.getElementById("colNombre").value.trim();
    document.getElementById("colError").textContent = "";
    if (!nombre) {
      document.getElementById("colError").textContent = "El nombre es obligatorio";
      return;
    }
    const proyId = state.get("proyectoActualId");
    try {
      const tableros = await window.api("GET", `/proyectos/${proyId}/tableros`);
      if (!tableros.length) throw new Error("No hay tablero en este proyecto");
      const data = payload.crearColumna(nombre);
      await window.api("POST", `/tableros/${tableros[0].id}/columnas`, data);
      if (window.cerrarModal) window.cerrarModal("mColumna");
      if (window.toast) window.toast("Columna creada");
      await cargarTablero(proyId);
    } catch (e) {
      document.getElementById("colError").textContent = e.message;
    }
  }

  // Exponer a global
  window.toggleSubtareaEtapaKanban = toggleSubtareaEtapaKanban;
  window.cargarSelectores = cargarSelectores;
  window.irTablero = irTablero;
  window.cargarTablero = cargarTablero;
  window.colColor = colColor;
  window.tarjeta = tarjeta;
  window.iniciarDragDrop = iniciarDragDrop;
  window.eliminarColumna = eliminarColumna;
  window.agregarColumna = agregarColumna;
  window.confirmarAgregarColumna = confirmarAgregarColumna;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("tablero", {
    name: "tablero",
    htmlPath: "js/modules/tablero/tablero.html",
    cssPath: "js/modules/tablero/tablero.css",
    adapter: adapter,
    payload: payload,
    init: function () {
      const proyId = state.get("proyectoActualId");
      if (proyId) cargarTablero(proyId);
    },
  });
})();
