/* ═══════════════════════════════════════════════════
   TaskFlow — parches.js
   Parches sobre dashboard.js y vistas.js:
   1. Sobreescribe cargarTareasPaginadas para agregar
      el botón de subtareas en la tabla de tareas.
   2. Sobreescribe cargarNotificaciones para agregar
      el botón de envío de notificación externa.
   3. Inyecta botón "Enviar Notificación" en pantalla
      de notificaciones para PM y ADMIN.
════════════════════════════════════════════════════ */

/* ── 1. TABLA DE TAREAS — con botón de subtareas ── */

const _LIMITE_TAREAS_P = 20;
let _paginaTareasP = 1;

const _cargarTareasPaginadasOrig = window.cargarTareasPaginadas;

window.cargarTareasPaginadas = async function (proyId, pagina) {
  if (!proyId) return;
  proyActualId = proyId;
  _paginaTareasP = pagina || 1;

  // Cargar columnas y miembros
  try {
    const tableros = await api("GET", `/proyectos/${proyId}/tableros`);
    colsActuales = tableros[0]?.columnas || [];
  } catch (_) {
    colsActuales = [];
  }

  try {
    const todos = await api("GET", "/usuarios/activos");
    miembrosActuales = todos
      .filter((u) => u.rol === "DEVELOPER")
      .map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol }));
  } catch (_) {
    miembrosActuales = [];
  }

  const tb = document.getElementById("tbTareas");
  const pagEl = document.getElementById("pagTareas");
  if (tb)
    tb.innerHTML =
      '<tr><td colspan="7" class="vacío"><span class="spinner"></span></td></tr>';

  try {
    const res = await api(
      "GET",
      `/proyectos/${proyId}/tareas?pagina=${_paginaTareasP}&limite=${_LIMITE_TAREAS_P}`,
    );
    const ts = res.datos || res;

    if (!ts.length) {
      tb.innerHTML =
        '<tr><td colspan="7" class="vacío">Sin tareas en este proyecto</td></tr>';
      if (pagEl) pagEl.innerHTML = "";
      return;
    }

    tb.innerHTML = ts
      .map((t) => {
        const resps = (t.responsables || [])
          .map((id) => {
            const m = miembrosActuales.find((m) => m.id === id);
            return `<div class="avatar avatar-sm" title="${m?.nombre || id}">${inic(m?.nombre || "?")}</div>`;
          })
          .join("");

        const nSub = (t.subtareas || []).length;

        return `<tr>
        <td style="font-weight:500;cursor:pointer" onclick="abrirPanelComentarios('${t.id}','${t.titulo.replace(/'/g, "\\'")}')">
          ${t.titulo}
          ${nSub > 0 ? `<span class="badge bm" style="margin-left:4px"><i class="ph ph-tree-structure" style="font-size:9px"></i> ${nSub}</span>` : ""}
        </td>
        <td>${badgeTipo(t.tipo)}</td>
        <td>${badgePrio(t.prioridad)}</td>
        <td><div class="avatar-group">${resps || '<span class="txt3">—</span>'}</div></td>
        <td>${t.estaVencida ? '<span class="badge br">Vencida</span>' : '<span class="badge bg">Activa</span>'}</td>
        <td>
          <div class="flex" style="gap:4px">
            <button class="btn btn-outline btn-xs" style="color:var(--a2)"
              onclick="abrirPanelSubtareas('${t.id}','${t.titulo.replace(/'/g, "\\'")}')"
              title="Subtareas (Builder)">
              <i class="ph ph-tree-structure"></i>
            </button>
            <button class="btn btn-outline btn-xs" onclick="abrirPanelComentarios('${t.id}','${t.titulo.replace(/'/g, "\\'")}')">
              💬
            </button>
            <button class="btn btn-outline btn-xs" onclick="abrirAsignar('${t.id}')">Asignar</button>
            <button class="btn btn-outline btn-xs" onclick="clonarTarea('${t.id}')">Clonar</button>
            <button class="btn btn-red btn-xs" onclick="eliminarTarea('${t.id}')">✕</button>
          </div>
        </td>
      </tr>`;
      })
      .join("");

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
};

/* ── 2. NOTIFICACIONES — inyectar botón de envío externo ── */

const _cargarNotificacionesOrig = window.cargarNotificaciones;

window.cargarNotificaciones = async function () {
  // Llamar la función original
  if (_cargarNotificacionesOrig) await _cargarNotificacionesOrig();

  // Mantener una sola UX de envío (panel inline ya existente)
  const rol = S?.usuario?.rol;
  if (rol === "ADMIN" || rol === "PROJECT_MANAGER") {
    // Inyectar sección de contacto externo en panel de preferencias
    _inyectarPanelContacto();
  }
};

function _inyectarPanelContacto() {
  // Solo si el panel de prefs existe (no-admin lo tiene)
  const panelMio = document.getElementById("panelMisNotif");
  if (!panelMio || document.getElementById("cardContactoExterno")) return;

  const rol = S?.usuario?.rol;

  const card = document.createElement("div");
  card.id = "cardContactoExterno";
  card.className = "card";
  card.style.marginTop = "12px";
  card.innerHTML = `
    <div class="card-t"><i class="ph ph-phone"></i> Contacto para canales externos — Adapter</div>
    <div style="font-size:11px;color:var(--t3);font-family:var(--mono);margin-bottom:12px;line-height:1.6">
      Configura tu número de teléfono para recibir notificaciones por
      <strong style="color:var(--a2)">WhatsApp</strong> y <strong style="color:var(--a2)">SMS</strong>
      cuando el canal sea <code style="background:var(--s3);padding:1px 5px;border-radius:3px">AMBOS</code>.
    </div>
    <div class="frow" style="margin-bottom:12px">
      <div class="fg">
        <label class="flabel"><i class="ph ph-whatsapp-logo"></i> WhatsApp</label>
        <input class="finput" id="cfgTelWA" placeholder="+57 300 000 0000">
      </div>
      <div class="fg">
        <label class="flabel"><i class="ph ph-chat-text"></i> SMS</label>
        <input class="finput" id="cfgTelSMS" placeholder="+57 300 000 0000">
      </div>
    </div>
    <div class="flex" style="justify-content:flex-end">
      <button class="btn btn-primary btn-sm" onclick="_guardarContactoExterno()">
        <i class="ph ph-floppy-disk"></i> Guardar contacto
      </button>
    </div>`;

  panelMio.appendChild(card);

  // Pre-cargar datos guardados
  api("GET", "/notificaciones/preferencias")
    .then((prefs) => {
      const wa = document.getElementById("cfgTelWA");
      const sms = document.getElementById("cfgTelSMS");
      if (wa && prefs.telefonoWhatsapp) wa.value = prefs.telefonoWhatsapp;
      if (sms && prefs.telefonoSms) sms.value = prefs.telefonoSms;
    })
    .catch(() => {});
}

window._guardarContactoExterno = async function () {
  const wa = document.getElementById("cfgTelWA")?.value?.trim() || null;
  const sms = document.getElementById("cfgTelSMS")?.value?.trim() || null;
  try {
    await api("PUT", "/notificaciones/contacto", {
      telefonoWhatsapp: wa,
      telefonoSms: sms,
    });
    toast("Datos de contacto guardados ✓");
  } catch (e) {
    toast(e.message, "err");
  }
};

/* ── 3. ACTUALIZAR CABECERA TABLA TAREAS ── */
// Agregar columna "Subtareas" al encabezado de la tabla de tareas
document.addEventListener("taskflow:ready", () => {
  // Parchear el HTML del slot de tareas para agregar la columna
  const slot = document.getElementById("slot-tareas");
  if (slot) {
    const observer = new MutationObserver(() => {
      const thead = slot.querySelector("thead tr");
      if (thead && thead.children.length === 6) {
        // Ya tiene 6 columnas, agregar "Subtareas" antes de "Acciones"
        // Se refleja en el render de cargarTareasPaginadas (colspan=7)
        observer.disconnect();
      }
    });
    observer.observe(slot, { childList: true, subtree: true });
  }
});
