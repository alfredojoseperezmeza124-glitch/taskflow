/* ═══════════════════════════════════════════════════
   TaskFlow — modules/reportes/reportes.js
   Lógica del módulo Reportes (métricas, sprint, equipo, logs, exportar).
   Usa ReportesAdapter para normalizar los datos.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.reportesAdapter;
  const payload = window.TF.modules.reportesPayload;
  const state = window.TF.state;

  async function cargarReporte(proyId) {
    if (!proyId) {
      ["rTotal", "rVenc", "rProg"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = "—";
      });
      const dist = document.getElementById("rDist");
      if (dist) {
        dist.innerHTML = '<div class="vacío">Selecciona un proyecto</div>';
      }
      return;
    }
    const elems = ["rTotal", "rVenc", "rProg", "rDist"];
    elems.forEach((id) => {
      const el = document.getElementById(id);
      if (el && id !== "rDist") el.textContent = "—";
      if (el && id === "rDist") {
        el.innerHTML = '<div class="vacío">Cargando...</div>';
      }
    });
    try {
      const raw = await window.api("GET", `/proyectos/${proyId}/metricas`);
      const m = adapter.adaptMetricas(raw);
      document.getElementById("rTotal").textContent = m.totalTareas ?? "0";
      document.getElementById("rVenc").textContent = m.tareasVencidas ?? "0";
      document.getElementById("rProg").textContent = `${m.progreso ?? 0}%`;
      const dist = Object.entries(m.tareasPorEstado || {});
      const maxD = Math.max(...dist.map(([, v]) => v), 1);
      const distCont = document.getElementById("rDist");
      if (distCont) {
        distCont.innerHTML = dist.length
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
      }
      // Recargar panel activo si corresponde
      const panelEquipo = document.getElementById("rpanel-equipo");
      if (panelEquipo?.classList.contains("activo")) {
        cargarEstadisticasEquipo(proyId);
      }
      const panelSprint = document.getElementById("rpanel-sprint");
      if (panelSprint?.classList.contains("activo")) {
        document.getElementById("contenidoSprint").innerHTML =
          '<div class="vacío">Ingresa el nombre del sprint y haz clic en Generar</div>';
      }
    } catch (e) {
      if (window.toast) window.toast("Error cargando métricas: " + e.message, "err");
      const dist = document.getElementById("rDist");
      if (dist) dist.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
    }
  }

  async function exportarReporteBridge(tipo, formato) {
    const proyId = document.getElementById("selReporteProy")?.value;
    if (!proyId) {
      if (window.toast) window.toast("Selecciona un proyecto primero", "err");
      return;
    }
    try {
      const params = payload.exportarParams(tipo, formato);
      const ruta = `/proyectos/${proyId}/exportar?tipo=${encodeURIComponent(params.tipo)}&formato=${encodeURIComponent(params.formato)}`;
      const token = state.get("token") || (window.S?.token_acceso || "");
      const resp = await fetch(`${window.API || "/api"}${ruta}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
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
      const nombre = m?.[1] || `${params.tipo}.${params.formato}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.toast) window.toast("Reporte exportado correctamente");
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  function exportarReporteBridgeDesdeUI() {
    const tipo = document.getElementById("expTipo")?.value || "tareas";
    const formato = document.getElementById("expFormato")?.value || "json";
    exportarReporteBridge(tipo, formato);
  }

  function cambiarTabReporte(nombre, btn) {
    document.querySelectorAll("#tabsReporte .htab").forEach((t) => t.classList.remove("activo"));
    document.querySelectorAll('[id^="rpanel-"]').forEach((p) => p.classList.remove("activo"));
    btn.classList.add("activo");
    document.getElementById(`rpanel-${nombre}`)?.classList.add("activo");
    const proyId = document.getElementById("selReporteProy")?.value;

    if (nombre === "equipo") {
      if (!proyId) {
        const c = document.getElementById("statsEquipo");
        if (c) {
          c.innerHTML =
            '<div class="vacío"><i class="ph ph-folder" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px"></i>Selecciona un proyecto para ver las estadísticas del equipo</div>';
        }
      } else {
        cargarEstadisticasEquipo(proyId);
      }
    }

    if (nombre === "sprint") {
      const c = document.getElementById("contenidoSprint");
      if (!proyId) {
        if (c) {
          c.innerHTML =
            '<div class="vacío"><i class="ph ph-lightning" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px"></i>Selecciona un proyecto primero</div>';
        }
      } else {
        if (c) {
          c.innerHTML = '<div class="vacío">Ingresa el nombre del sprint y haz clic en Generar</div>';
        }
      }
    }

    if (nombre === "metricas" && proyId) cargarReporte(proyId);
    if (nombre === "auditoria_global") cargarAuditoriaGlobal();
  }

  function inicializarTabsReporte() {
    const usuario = state.get("usuario") || {};
    const rol = usuario.rol;
    const esAdmin = rol === "ADMIN";
    const esPMoAdmin = rol === "ADMIN" || rol === "PROJECT_MANAGER";

    ["tabAuditGlobal", "tabRetencion"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = esAdmin ? "" : "none";
    });

    const tabSprint = document.querySelector("#tabsReporte .htab:nth-child(2)");
    const tabEquipo = document.querySelector("#tabsReporte .htab:nth-child(3)");
    if (tabSprint) tabSprint.style.display = esPMoAdmin ? "" : "none";
    if (tabEquipo) tabEquipo.style.display = esPMoAdmin ? "" : "none";
  }

  async function generarReporteSprint() {
    const proyId = document.getElementById("selReporteProy")?.value;
    if (!proyId) {
      if (window.toast) window.toast("Selecciona un proyecto primero", "err");
      return;
    }
    const sprint = document.getElementById("sprintNombre").value.trim() || "Sprint actual";
    const contenedor = document.getElementById("contenidoSprint");
    if (contenedor) contenedor.innerHTML = '<span class="spinner"></span>';
    try {
      const rawMetricas = await window.api("GET", `/proyectos/${proyId}/metricas`);
      const metricas = adapter.adaptMetricas(rawMetricas);
      const proyecto = await window.api("GET", `/proyectos/${proyId}`);
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

      if (contenedor) {
        contenedor.innerHTML = `
          <div class="sprint-reporte">
            <div class="sprint-header">
              <div>
                <div class="sprint-titulo"><i class="ph ph-lightning" style="color:var(--amber)"></i> ${sprint}</div>
                <div class="sprint-sub">${proyecto.nombre} · Generado ${window.fFecha ? window.fFecha(new Date().toISOString()) : new Date().toLocaleDateString()}</div>
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
      }
    } catch (e) {
      if (contenedor) contenedor.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
    }
  }

  async function cargarEstadisticasEquipo(proyId) {
    const contenedor = document.getElementById("statsEquipo");
    if (!contenedor) return;
    if (!proyId) {
      contenedor.innerHTML = '<div class="vacío">Selecciona un proyecto</div>';
      return;
    }
    contenedor.innerHTML = '<span class="spinner"></span>';
    try {
      const [rawMetricas, miembros] = await Promise.all([
        window.api("GET", `/proyectos/${proyId}/metricas`),
        window.api("GET", `/proyectos/${proyId}/miembros`),
      ]);
      const metricas = adapter.adaptMetricas(rawMetricas);
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
                    <div class="avatar avatar-sm">${window.inic ? window.inic(m.nombre) : ""}</div>${m.nombre}
                  </div>
                </td>
                <td>${window.badgeRol ? window.badgeRol(m.rol) : `<span class="badge">${m.rol}</span>`}</td>
                <td><span class="badge bi">${window.inic ? cantidad : ""}</span></td>
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

  async function cargarAuditoriaGlobal() {
    const contenedor = document.getElementById("listaAuditoriaGlobal");
    if (!contenedor) return;
    contenedor.innerHTML = '<span class="spinner"></span>';
    try {
      const proyectos = await window.api("GET", "/proyectos/");
      const mapaUAudit = window._obtenerMapaUsuarios ? await window._obtenerMapaUsuarios() : {};

      const auditoriaRaw = await Promise.all(
        proyectos.map((p) =>
          window.api("GET", `/proyectos/${p.id}/auditoria?limite=100`)
            .then((res) => (Array.isArray(res) ? res : res.datos || []))
            .catch(() => []),
        ),
      );
      const todaAuditoria = auditoriaRaw
        .flat()
        .filter((r) => r && r.usuarioId)
        .sort((a, b) => new Date(b.marca) - new Date(a.marca));

      if (!todaAuditoria.length) {
        contenedor.innerHTML = '<div class="vacío">Sin registros de auditoría global</div>';
        return;
      }
      contenedor.innerHTML = `<div class="timeline">${todaAuditoria
        .slice(0, 80)
        .map((r, i) => {
          const uAudit = mapaUAudit[r.usuarioId];
          const nombreAudit = uAudit ? uAudit.nombre : `ID:${(r.usuarioId || "").slice(-6)}`;
          const avAudit = uAudit ? `<div class="avatar avatar-sm" style="display:inline-flex;vertical-align:middle;margin-right:4px">${window.inic ? window.inic(uAudit.nombre) : ""}</div>` : "";
          return `
          <div class="tl-item ${i === 0 ? "reciente" : ""}">
            <div class="tl-accion"><strong>${r.accion || "—"}</strong> en ${r.tipoEntidad || "—"}</div>
            <div class="tl-meta">${avAudit}${nombreAudit} · ${window.fFecha ? window.fFecha(r.marca) : r.marca}</div>
          </div>`;
        })
        .join("")}</div>`;
    } catch (e) {
      contenedor.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
    }
  }

  function aplicarPoliticaRetencion() {
    const dias = document.getElementById("diasRetencion")?.value;
    const nivel = document.getElementById("nivelRetencion")?.value;
    const msg = document.getElementById("retencionMensaje");
    if (!dias || parseInt(dias) < 7) {
      if (msg) msg.textContent = "✕ El mínimo es 7 días";
      return;
    }
    localStorage.setItem("tf_retencion", JSON.stringify({ dias, nivel }));
    if (msg) {
      msg.textContent = `✓ Política aplicada: conservar ${dias} días (nivel: ${nivel})`;
    }
    if (window.toast) window.toast("Política de retención guardada");
  }

  // Exponer a global
  window.cargarReporte = cargarReporte;
  window.exportarReporteBridge = exportarReporteBridge;
  window.exportarReporteBridgeDesdeUI = exportarReporteBridgeDesdeUI;
  window.cambiarTabReporte = cambiarTabReporte;
  window.inicializarTabsReporte = inicializarTabsReporte;
  window.generarReporteSprint = generarReporteSprint;
  window.cargarEstadisticasEquipo = cargarEstadisticasEquipo;
  window.cargarAuditoriaGlobal = cargarAuditoriaGlobal;
  window.aplicarPoliticaRetencion = aplicarPoliticaRetencion;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("reportes", {
    name: "reportes",
    htmlPath: "js/modules/reportes/reportes.html",
    cssPath: null,
    adapter: adapter,
    payload: payload,
    init: function () {
      inicializarTabsReporte();
      const proyId = state.get("proyectoActualId");
      if (proyId) cargarReporte(proyId);
    },
  });
})();
