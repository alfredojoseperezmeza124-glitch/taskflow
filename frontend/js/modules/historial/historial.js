/* ═══════════════════════════════════════════════════
   TaskFlow — modules/historial/historial.js
   Lógica del módulo Historial (auditoría, por tarea, búsqueda, completadas).
   Usa HistorialAdapter para normalizar los datos.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.historialAdapter;
  const payload = window.TF.modules.historialPayload;
  const state = window.TF.state;

  let historialUltimoCambio = null;

  function cambiarTabHist(nombre, btn) {
    const pantalla = document.getElementById("pantalla-historial");
    if (!pantalla) return;
    pantalla.querySelectorAll(".htab").forEach((t) => t.classList.remove("activo"));
    pantalla.querySelectorAll(".hpanel").forEach((p) => p.classList.remove("activo"));
    btn.classList.add("activo");
    pantalla.querySelector(`#hpanel-${nombre}`)?.classList.add("activo");
    if (nombre === "completadas") cargarTareasCompletadas();
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
    const cont = document.getElementById("listaHist");
    if (cont) cont.innerHTML = '<span class="spinner"></span>';
    try {
      const res = await window.api("GET", `/proyectos/${proyId}/auditoria?limite=100`);
      const rsRaw = Array.isArray(res) ? res : res.datos || [];
      const rs = adapter.adapt(rsRaw);
      const mapaU = window._obtenerMapaUsuarios ? await window._obtenerMapaUsuarios() : {};

      if (!rs.length) {
        if (cont) cont.innerHTML = '<div class="vacío">Sin registros de auditoría</div>';
        return;
      }
      if (cont) {
        cont.innerHTML = `<div class="timeline">${rs
          .filter((r) => r && r.usuarioId)
          .map((r, i) => {
            const nombre = _nombreUsuario(mapaU, r.usuarioId);
            const u = mapaU[r.usuarioId];
            const av = u ? `<div class="avatar avatar-sm" style="display:inline-flex;vertical-align:middle;margin-right:4px">${window.inic ? window.inic(u.nombre) : ""}</div>` : "";
            return `
            <div class="tl-item ${i === 0 ? "reciente" : ""}">
              <div class="tl-accion"><strong>${r.accion || "—"}</strong> en ${r.tipoEntidad || "—"}</div>
              <div class="tl-meta">${av}${nombre} · ${window.fFecha ? window.fFecha(r.marca) : r.marca}</div>
            </div>`;
          })
          .join("")}</div>`;
      }
    } catch (e) {
      if (cont) cont.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
    }
  }

  async function cargarHistorialTarea() {
    const raw = document.getElementById("histAreaId")?.value.trim() || document.getElementById("histTareaId")?.value.trim();
    if (!raw) {
      if (window.toast) window.toast("Ingresa un ID de tarea", "err");
      return;
    }
    const cont = document.getElementById("listaHistTarea");
    if (cont) cont.innerHTML = '<span class="spinner"></span>';
    const undoZ = document.getElementById("undoZona");
    if (undoZ) undoZ.style.display = "none";
    try {
      let tareaId = raw;
      const proyId = state.get("proyectoActualId");
      if (proyId && raw.length <= 6) {
        const res = await window.api("GET", `/proyectos/${proyId}/tareas`);
        const tareas = Array.isArray(res) ? res : res.datos || [];
        const encontrada = tareas.find((t) => t.id.endsWith(raw));
        if (encontrada) tareaId = encontrada.id;
      }
      const rawRes = await window.api("GET", `/tareas/${tareaId}/historial`);
      const rs = adapter.adapt(rawRes);
      if (!rs.length) {
        if (cont) cont.innerHTML = '<div class="vacío">Sin historial para esta tarea</div>';
        return;
      }
      historialUltimoCambio = rs[0];
      const mapaU2 = window._obtenerMapaUsuarios ? await window._obtenerMapaUsuarios() : {};
      if (cont) {
        cont.innerHTML = `<div class="timeline">${rs
          .map((r, i) => {
            const nombre = _nombreUsuario(mapaU2, r.usuarioId);
            const u2 = mapaU2[r.usuarioId];
            const av = u2 ? `<div class="avatar avatar-sm" style="display:inline-flex;vertical-align:middle;margin-right:4px">${window.inic ? window.inic(u2.nombre) : ""}</div>` : "";
            return `
            <div class="tl-item ${i === 0 ? "reciente" : ""}">
              <div class="tl-accion"><strong>${r.accion}</strong> en ${r.tipoEntidad}</div>
              <div class="tl-meta">${av}${nombre} · ${window.fFecha ? window.fFecha(r.marca) : r.marca}</div>
            </div>`;
          })
          .join("")}</div>`;
      }
      if (historialUltimoCambio && undoZ) {
        undoZ.style.display = "";
        const undoD = document.getElementById("undoDetalle");
        if (undoD) {
          undoD.textContent = historialUltimoCambio.valorAnterior
            ? `Revertir: ${historialUltimoCambio.accion} (${window.fFecha ? window.fFecha(historialUltimoCambio.marca) : historialUltimoCambio.marca})`
            : "No hay cambio anterior para revertir";
        }
      }
    } catch (e) {
      if (cont) cont.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
    }
  }

  async function deshacerUltimoCambio() {
    if (!historialUltimoCambio?.valorAnterior) {
      if (window.toast) window.toast("No hay cambio anterior que deshacer", "err");
      return;
    }
    const { entidadId, valorAnterior, accion } = historialUltimoCambio;
    if (!confirm(`¿Deshacer "${accion}"? Se revertirán los cambios al estado anterior.`)) return;
    try {
      await window.api("PUT", `/tareas/${entidadId}`, valorAnterior);
      if (window.toast) window.toast("Cambio revertido");
      historialUltimoCambio = null;
      const undoZ = document.getElementById("undoZona");
      if (undoZ) undoZ.style.display = "none";
      cargarHistorialTarea();
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  async function buscarTareas() {
    const proyId = state.get("proyectoActualId");
    if (!proyId) {
      if (window.toast) window.toast("Primero selecciona un proyecto", "err");
      return;
    }
    const searchVal = payload.buscarParams({
      texto: document.getElementById("fTexto")?.value.trim() || "",
      prioridad: document.getElementById("fPrioridad")?.value || "",
      tipo: document.getElementById("fTipo")?.value || "",
    });
    const params = new URLSearchParams();
    if (searchVal.texto) params.append("texto", searchVal.texto);
    if (searchVal.prioridad) params.append("prioridad", searchVal.prioridad);
    if (searchVal.tipo) params.append("tipo", searchVal.tipo);
    const tb = document.getElementById("tbBusqueda");
    if (tb) {
      tb.innerHTML = '<tr><td colspan="5" class="vacío"><span class="spinner"></span></td></tr>';
    }
    try {
      const ts = await window.api("GET", `/proyectos/${proyId}/tareas?${params}`);
      if (tb) {
        if (!ts.length) {
          tb.innerHTML = '<tr><td colspan="5" class="vacío">Sin resultados</td></tr>';
          return;
        }
        tb.innerHTML = ts
          .map(
            (t) => `<tr>
          <td style="color:var(--txt);font-weight:500">${t.titulo}</td>
          <td>${window.badgeTipo ? window.badgeTipo(t.tipo) : `<span class="badge">${t.tipo}</span>`}</td>
          <td>${window.badgePrio ? window.badgePrio(t.prioridad) : `<span class="badge">${t.prioridad}</span>`}</td>
          <td class="txt3">${(window.colsActuales || []).find((c) => c.id === t.columnaId)?.nombre || t.columnaId.slice(-6)}</td>
          <td>${t.estaVencida ? '<span class="badge br">Vencida</span>' : '<span class="badge bg">Activa</span>'}</td>
        </tr>`,
          )
          .join("");
      }
    } catch (e) {
      if (tb) tb.innerHTML = `<tr><td colspan="5" class="vacío">Error: ${e.message}</td></tr>`;
    }
  }

  function limpiarFiltros() {
    ["fTexto", "fPrioridad", "fTipo"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const tb = document.getElementById("tbBusqueda");
    if (tb) {
      tb.innerHTML = '<tr><td colspan="5" class="vacío">Aplica un filtro para buscar</td></tr>';
    }
  }

  async function cargarTareasCompletadas() {
    const proyId = state.get("proyectoActualId");
    const cont = document.getElementById("listaCompletadas");
    if (!proyId) {
      if (cont) cont.innerHTML = '<div class="vacío">Selecciona un proyecto primero</div>';
      return;
    }
    if (cont) cont.innerHTML = '<span class="spinner"></span>';
    try {
      const tableros = await window.api("GET", `/proyectos/${proyId}/tableros`);
      const columnas = tableros[0]?.columnas || [];
      const colCompletado = columnas.find((c) => c.nombre.toLowerCase().includes("complet"));
      if (!colCompletado) {
        if (cont) cont.innerHTML = '<div class="vacío">No se encontró columna de completadas</div>';
        return;
      }
      const tareas = await window.api("GET", `/columnas/${colCompletado.id}/tareas`);
      const usuario = state.get("usuario") || {};
      const mias = tareas.filter((t) => t.responsables.includes(usuario.id));
      if (!mias.length) {
        if (cont) cont.innerHTML = '<div class="vacío">No tienes tareas completadas asignadas</div>';
        return;
      }
      if (cont) {
        cont.innerHTML = mias
          .map(
            (t) => `
          <div style="display:flex;align-items:center;justify-content:space-between;
            padding:12px 0;border-bottom:1px solid rgba(63,63,70,.35)">
            <div>
              <div style="font-size:13px;font-weight:500;color:var(--verde)">✓ ${t.titulo}</div>
              <div class="txt3">${window.badgeTipo ? window.badgeTipo(t.tipo) : t.tipo} · ${t.horasRegistradas}h · ${window.fFecha ? window.fFecha(t.creadoEn) : t.creadoEn}</div>
            </div>
            ${window.badgePrio ? window.badgePrio(t.prioridad) : `<span class="badge">${t.prioridad}</span>`}
          </div>`,
          )
          .join("");
      }
    } catch (e) {
      if (cont) cont.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
    }
  }

  // Exponer a global
  window.cambiarTabHist = cambiarTabHist;
  window.cargarHistorial = cargarHistorial;
  window.cargarHistorialTarea = cargarHistorialTarea;
  window.deshacerUltimoCambio = deshacerUltimoCambio;
  window.buscarTareas = buscarTareas;
  window.limpiarFiltros = limpiarFiltros;
  window.cargarTareasCompletadas = cargarTareasCompletadas;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("historial", {
    name: "historial",
    htmlPath: "js/modules/historial/historial.html",
    cssPath: null,
    adapter: adapter,
    payload: payload,
    init: function () {
      const proyId = state.get("proyectoActualId");
      if (proyId) cargarHistorial(proyId);
    },
  });
})();
