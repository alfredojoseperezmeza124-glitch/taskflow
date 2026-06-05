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
      '<tr><td colspan="4" class="vacío"><span class="spinner"></span></td></tr>';

  try {
    const res = await api(
      "GET",
      `/proyectos/${proyId}/tareas?pagina=${_paginaTareasP}&limite=${_LIMITE_TAREAS_P}`,
    );
    const ts = res.datos || res;

    if (!ts.length) {
      tb.innerHTML =
        '<tr><td colspan="4" class="vacío">Sin tareas en este proyecto</td></tr>';
      if (pagEl) pagEl.innerHTML = "";
      return;
    }

    tb.innerHTML = ts
      .map((t) => {
        const resps = (t.responsables || [])
          .map((id) => {
            const m = (typeof _resolverUsuario === "function")
              ? _resolverUsuario(id)
              : miembrosActuales.find((m) => m.id === id);
            const nombre = m?.nombre || m?.name || null;
            return `<div class="avatar avatar-sm" title="${nombre || id}">${inic(nombre || id.slice(0, 2).toUpperCase())}</div>`;
          })
          .join("");

        const nSub = (t.subtareas || []).length;

        const vence = t.fechaVencimiento
          ? new Date(t.fechaVencimiento).toLocaleDateString("es", { day: "numeric", month: "short" })
          : null;

        return `<tr>
        <td onclick="abrirDetalleTarea('${t.id}')" style="cursor:pointer">
          <div style="font-size:13px;font-weight:600;color:var(--t1);line-height:1.4;margin-bottom:8px">${t.titulo}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
            ${badgeTipo(t.tipo)}
            ${badgePrio(t.prioridad)}
            ${nSub > 0 ? `<span class="badge bm" style="font-size:9px"><i class="fi fi-rr-network" style="font-size:9px"></i> ${nSub}</span>` : ""}
          </div>
        </td>
        <td>
          <div class="avatar-group">${resps || '<span class="txt3" style="font-size:12px">Sin asignar</span>'}</div>
        </td>
        <td>
          <div style="display:flex;flex-direction:column;gap:5px">
            ${t.estaVencida ? '<span class="badge br"><i class="fi fi-rr-clock-three" style="font-size:9px"></i> Vencida</span>' : '<span class="badge bg"><i class="fi fi-rr-check" style="font-size:9px"></i> Activa</span>'}
            ${vence ? `<span style="font-size:10px;color:var(--t3);font-family:var(--mono);display:flex;align-items:center;gap:3px"><i class="fi fi-rr-calendar" style="font-size:9px"></i>${vence}</span>` : ""}
          </div>
        </td>
        <td class="td-acciones">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-outline btn-xs" style="color:var(--a2)" onclick="abrirPanelSubtareas('${t.id}','${t.titulo.replace(/'/g, "\\'")}'); event.stopPropagation()" title="Subtareas"><i class="fi fi-rr-network"></i></button>
            <button class="btn btn-outline btn-xs" onclick="abrirPanelComentarios('${t.id}','${t.titulo.replace(/'/g, "\\'")}'); event.stopPropagation()" title="Comentarios"><i class="fi fi-rr-comment"></i></button>
            <button class="btn btn-outline btn-xs" onclick="abrirAsignar('${t.id}'); event.stopPropagation()" title="Asignar"><i class="fi fi-rr-user-add"></i></button>
            <button class="btn btn-outline btn-xs" onclick="clonarTarea('${t.id}'); event.stopPropagation()" title="Clonar"><i class="fi fi-rr-copy"></i></button>
            <button class="btn btn-red btn-xs" onclick="eliminarTarea('${t.id}'); event.stopPropagation()" title="Eliminar"><i class="fi fi-rr-trash"></i></button>
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
      tb.innerHTML = `<tr><td colspan="4" class="vacío">Error: ${e.message}</td></tr>`;
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

/* ── PANEL DETALLE TAREA ── */
window.abrirDetalleTarea = async function abrirDetalleTarea(tareaId) {
  if (!tareaId) return;
  let modal = document.getElementById("mDetalleTarea");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "overlay";
    modal.id = "mDetalleTarea";
    modal.innerHTML = `
      <div class="modal" style="width:640px;max-height:84vh;overflow:hidden;display:flex;flex-direction:column;gap:0;padding:0;border-radius:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px 14px;border-bottom:1px solid var(--b1);background:var(--s2)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:34px;height:34px;background:var(--abg);border:1px solid var(--abg2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--a2)"><i class="fi fi-rr-checkbox"></i></span>
            <div>
              <div style="font-size:11px;color:var(--t3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.06em">Detalle de tarea</div>
              <div id="dtTitulo" style="font-size:15px;font-weight:700;color:var(--t1);letter-spacing:-.02em;margin-top:2px">—</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-xs" onclick="cerrarModal('mDetalleTarea')" style="width:28px;height:28px;padding:0;border-radius:8px;font-size:14px"><i class="fi fi-rr-cross-small"></i></button>
        </div>
        <div style="overflow:auto;flex:1;padding:20px 22px" id="dtContenido"><div class="spinner"></div></div>
        <div style="padding:14px 22px;border-top:1px solid var(--b1);background:var(--s2);display:flex;justify-content:flex-end;gap:8px">
          <button id="dtBtnAsignar" class="btn btn-outline btn-sm"><i class="fi fi-rr-user-add"></i> Asignar</button>
          <button id="dtBtnEditar" class="btn btn-primary btn-sm"><i class="fi fi-rr-pencil"></i> Editar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) cerrarModal("mDetalleTarea");
    });
  }

  abrirModal("mDetalleTarea");
  const cont = document.getElementById("dtContenido");
  const tituloEl = document.getElementById("dtTitulo");
  if (cont) cont.innerHTML = '<div class="spinner"></div>';

  try {
    const t = await api("GET", `/tareas/${tareaId}`);
    if (tituloEl) tituloEl.textContent = t.titulo || "Tarea";

    const btnEditar = document.getElementById("dtBtnEditar");
    if (btnEditar) btnEditar.onclick = () => { cerrarModal("mDetalleTarea"); abrirEditarTarea(tareaId); };
    const btnAsignar = document.getElementById("dtBtnAsignar");
    if (btnAsignar) btnAsignar.onclick = () => { cerrarModal("mDetalleTarea"); abrirAsignar(tareaId); };

    const prioBadge = typeof badgePrio === "function" ? badgePrio(t.prioridad) : t.prioridad;
    const tipoBadge = typeof badgeTipo === "function" ? badgeTipo(t.tipo) : t.tipo;

    const responsables = (t.responsables || []).map((id) => {
      const m = (typeof _resolverUsuario === "function") ? _resolverUsuario(id) : (miembrosActuales || []).find((m) => m.id === id);
      const nombre = m?.nombre || m?.name || id;
      return `<div class="avatar avatar-sm" title="${nombre}">${typeof inic === "function" ? inic(nombre) : nombre.slice(0,2).toUpperCase()}</div>`;
    }).join("");

    const vence = t.fechaVencimiento ? new Date(t.fechaVencimiento).toLocaleString("es", {dateStyle:"medium",timeStyle:"short"}) : "—";
    const estado = t.estaVencida
      ? '<span class="badge br"><i class="fi fi-rr-clock-three" style="font-size:10px"></i> Vencida</span>'
      : '<span class="badge bg"><i class="fi fi-rr-check" style="font-size:10px"></i> Activa</span>';

    const fase = t.faseNombre ? `<span class="badge ba text-[10px]"><i class="fi fi-rr-flag" style="font-size:9px"></i> ${t.faseNombre}</span>` : "";
    const etapa = t.etapaNombre ? `<span class="badge bi text-[10px]"><i class="fi fi-rr-layers" style="font-size:9px"></i> ${t.etapaNombre}</span>` : "";

    const esc = (v) => String(v || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 180px;gap:20px">
        <div>
          <div style="font-size:13px;color:var(--t3);margin-bottom:10px;line-height:1.7;background:var(--s2);padding:12px;border-radius:8px;border:1px solid var(--b1)">${esc(t.descripcion||t.descripcionCorta||"Sin descripción")}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${prioBadge} ${tipoBadge} ${estado} ${fase} ${etapa}</div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--t3)">
            <i class="fi fi-rr-calendar" style="font-size:13px"></i>
            <span>Vence: <strong style="color:var(--t2)">${vence}</strong></span>
          </div>
        </div>
        <div style="border-left:1px solid var(--b1);padding-left:16px;display:flex;flex-direction:column;gap:14px">
          <div>
            <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-family:var(--mono);margin-bottom:6px">Responsables</div>
            <div class="avatar-group">${responsables || '<span class="txt3" style="font-size:12px">Sin asignar</span>'}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-family:var(--mono);margin-bottom:6px">Prioridad</div>
            ${prioBadge}
          </div>
          <div>
            <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;font-family:var(--mono);margin-bottom:6px">Tipo</div>
            ${tipoBadge}
          </div>
        </div>
      </div>`;
  } catch (e) {
    if (cont) cont.innerHTML = `<div class="vacío">Error al cargar la tarea: ${e.message}</div>`;
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
