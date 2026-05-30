/* ═══════════════════════════════════════════════════
   TaskFlow — subtareas.js
   Panel de subtareas +
   Modal de envío de notificaciones externas
════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════
   SUBTAREAS — Panel lateral tipo drawer
══════════════════════════════════════════════════ */

let _subtareasTareaId = null;
let _subtareasTitulo = "";

async function abrirPanelSubtareas(tareaId, tituloTarea) {
  _subtareasTareaId = tareaId;
  _subtareasTitulo = tituloTarea;

  let panel = document.getElementById("panelSubtareas");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "panelSubtareas";
    panel.innerHTML = _htmlPanelSubtareas();
    document.body.appendChild(panel);
    panel
      .querySelector(".subtarea-backdrop")
      .addEventListener("click", cerrarPanelSubtareas);
  }

  panel.querySelector("#stTareaTitle").textContent = tituloTarea;
  panel.classList.add("open");
  document.body.style.overflow = "hidden";
  await _cargarSubtareas(tareaId);
}

function cerrarPanelSubtareas() {
  const panel = document.getElementById("panelSubtareas");
  if (panel) panel.classList.remove("open");
  document.body.style.overflow = "";
}

function _htmlPanelSubtareas() {
  return `
<div class="subtarea-backdrop"></div>
<div class="subtarea-drawer">
  <div class="subtarea-header">
    <div>
      <div class="subtarea-label"><i class="ph ph-tree-structure"></i> Subtareas y jerarquía</div>
      <div class="subtarea-title" id="stTareaTitle">—</div>
    </div>
    <button class="btn btn-ghost btn-xs" onclick="cerrarPanelSubtareas()" style="font-size:18px">✕</button>
  </div>

  <div class="subtarea-progress-wrap" id="stProgressWrap" style="display:none">
    <div class="subtarea-progress-label">
      <span id="stProgLabel">0 / 0</span>
      <span id="stProgPct" style="font-family:var(--mono);font-size:11px;color:var(--green)">0%</span>
    </div>
    <div class="prog"><div class="prog-bar" id="stProgBar" style="width:0%;background:var(--green)"></div></div>
  </div>

  <div
    id="stCompositeWrap"
    style="display:none;margin:10px 0 12px;padding:10px 12px;border:1px solid var(--b1);border-radius:var(--r);background:var(--s2)"
  >
    <div class="subtarea-form-title" style="margin-bottom:8px">
      <i class="ph ph-flow-arrow" style="color:var(--a)"></i>
      Vista jerárquica
    </div>
    <div id="stCompositeResumen" class="txt3" style="font-size:11px">—</div>
    <div id="stCompositeTree" style="margin-top:10px"></div>
  </div>

  <div class="subtarea-lista" id="stLista">
    <div class="vacío"><span class="spinner"></span></div>
  </div>

  <div class="subtarea-form">
    <div class="subtarea-form-title"><i class="ph ph-plus-circle" style="color:var(--a)"></i> Nueva subtarea</div>
    <div class="fg" style="margin-bottom:8px">
      <input class="finput" id="stNuevoTitulo" placeholder="Título de la subtarea..."
        onkeydown="if(event.key==='Enter')crearSubtarea()">
    </div>
    <div class="fg" style="margin-bottom:8px">
      <textarea class="ftextarea" id="stNuevoDesc" placeholder="Descripción (opcional)..." style="min-height:54px;resize:none"></textarea>
    </div>
    <div class="frow" style="margin-bottom:8px">
      <div class="fg">
        <label class="flabel">Fecha vencimiento</label>
        <input class="finput" id="stNuevoFV" type="datetime-local">
      </div>
      <div class="fg">
        <label class="flabel">Responsables</label>
        <div id="stRespLista" class="resp-lista" style="max-height:72px;overflow-y:auto"></div>
      </div>
    </div>
    <div class="ferror" id="stError"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('stNuevoTitulo').value=''">Limpiar</button>
      <button class="btn btn-primary btn-sm" id="stBtnCrear" onclick="crearSubtarea()">
        <i class="ph ph-plus"></i> Crear subtarea
      </button>
    </div>
  </div>
</div>`;
}

async function _cargarSubtareas(tareaId) {
  const lista = document.getElementById("stLista");
  const compositeWrap = document.getElementById("stCompositeWrap");
  const compositeResumen = document.getElementById("stCompositeResumen");
  const compositeTree = document.getElementById("stCompositeTree");
  if (!lista) return;
  lista.innerHTML = '<div class="vacío"><span class="spinner"></span></div>';
  if (compositeWrap) compositeWrap.style.display = "none";
  if (compositeResumen)
    compositeResumen.innerHTML = '<span class="spinner"></span>';
  if (compositeTree) compositeTree.innerHTML = "";
  _poblarRespSubtarea();

  const [subtareasRes, jerarquiaRes] = await Promise.allSettled([
    api("GET", `/tareas/${tareaId}/subtareas`),
    api("GET", `/tareas/${tareaId}/jerarquia`),
  ]);

  if (subtareasRes.status === "fulfilled") {
    _renderizarSubtareas(subtareasRes.value);
  } else {
    const e = subtareasRes.reason;
    lista.innerHTML = `<div class="vacío">Error: ${e.message}</div>`;
  }

  if (jerarquiaRes.status === "fulfilled") {
    _renderizarJerarquiaCompuesta(jerarquiaRes.value);
  } else if (compositeWrap && compositeResumen && compositeTree) {
    compositeWrap.style.display = "";
    const msg = jerarquiaRes.reason?.message || "No disponible";
    compositeResumen.textContent = `No se pudo cargar la jerarquía: ${msg}`;
    compositeTree.innerHTML = "";
  }
}

function _renderizarSubtareas(subtareas) {
  const lista = document.getElementById("stLista");
  const wrap = document.getElementById("stProgressWrap");
  if (!lista) return;

  if (!subtareas.length) {
    lista.innerHTML = `<div class="vacío" style="padding:32px 16px">
      <i class="ph ph-tree-structure" style="font-size:36px;display:block;margin-bottom:10px;opacity:.2"></i>
      Sin subtareas. Crea la primera para empezar.
    </div>`;
    if (wrap) wrap.style.display = "none";
    return;
  }

  const total = subtareas.length;
  const completadas = subtareas.filter((s) => s.completada).length;
  const pct = Math.round((completadas / total) * 100);
  if (wrap) {
    wrap.style.display = "";
    document.getElementById("stProgLabel").textContent =
      `${completadas} / ${total} completadas`;
    document.getElementById("stProgPct").textContent = `${pct}%`;
    document.getElementById("stProgBar").style.width = `${pct}%`;
  }

  lista.innerHTML = subtareas
    .map(
      (s) => `
    <div class="subtarea-item ${s.completada ? "completada" : ""}" id="st-${s.id}">
      <div class="subtarea-check" onclick="_toggleSubtarea('${s.id}')" title="${s.completada ? "Desmarcar" : "Completar"}">
        ${
          s.completada
            ? '<i class="ph ph-check-circle" style="color:var(--green);font-size:18px"></i>'
            : '<i class="ph ph-circle" style="color:var(--t3);font-size:18px"></i>'
        }
      </div>
      <div class="subtarea-body">
        <div class="subtarea-item-titulo">${s.titulo}</div>
        ${s.descripcion ? `<div class="subtarea-item-desc">${s.descripcion}</div>` : ""}
        <div class="subtarea-item-meta">
          ${s.fechaVencimiento ? `<span class="txt3"><i class="ph ph-calendar-blank"></i> ${fFecha(s.fechaVencimiento)}</span>` : ""}
          ${s.responsables && s.responsables.length ? `<span class="txt3"><i class="ph ph-user"></i> ${s.responsables.length}</span>` : ""}
        </div>
      </div>
      <div class="subtarea-acciones">
        <button class="btn btn-red btn-xs" onclick="_eliminarSubtarea('${s.id}')" title="Eliminar">
          <i class="ph ph-trash"></i>
        </button>
      </div>
    </div>`,
    )
    .join("");
}

async function crearSubtarea() {
  const titulo =
    document.getElementById("stNuevoTitulo") &&
    document.getElementById("stNuevoTitulo").value.trim();
  const errEl = document.getElementById("stError");
  if (errEl) errEl.textContent = "";
  if (!titulo) {
    if (errEl) errEl.textContent = "El título es obligatorio";
    return;
  }
  if (!_subtareasTareaId) return;

  const btn = document.getElementById("stBtnCrear");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
  }

  const resp = getSeleccionados("stRespLista");
  const fv =
    (document.getElementById("stNuevoFV") &&
      document.getElementById("stNuevoFV").value) ||
    null;
  const desc =
    (document.getElementById("stNuevoDesc") &&
      document.getElementById("stNuevoDesc").value.trim()) ||
    null;

  try {
    await api("POST", `/tareas/${_subtareasTareaId}/subtareas`, {
      titulo,
      descripcion: desc,
      responsables: resp,
      fechaVencimiento: fv || null,
    });
    document.getElementById("stNuevoTitulo").value = "";
    document.getElementById("stNuevoDesc").value = "";
    document.getElementById("stNuevoFV").value = "";
    document
      .querySelectorAll("#stRespLista .resp-chip")
      .forEach((c) => c.classList.remove("sel"));
    toast("Subtarea creada");
    await _cargarSubtareas(_subtareasTareaId);
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-plus"></i> Crear subtarea';
    }
  }
}

async function _toggleSubtarea(subtareaId) {
  try {
    await api("POST", `/subtareas/${subtareaId}/toggle`);
    await _cargarSubtareas(_subtareasTareaId);
  } catch (e) {
    toast(e.message, "err");
  }
}

async function _eliminarSubtarea(subtareaId) {
  if (!confirm("¿Eliminar esta subtarea?")) return;
  try {
    await api("DELETE", `/subtareas/${subtareaId}`);
    toast("Subtarea eliminada");
    await _cargarSubtareas(_subtareasTareaId);
  } catch (e) {
    toast(e.message, "err");
  }
}

function _poblarRespSubtarea() {
  const c = document.getElementById("stRespLista");
  if (!c) return;
  if (!miembrosActuales || !miembrosActuales.length) {
    c.innerHTML =
      '<span class="txt3" style="font-size:11px">Sin developers</span>';
    return;
  }
  c.innerHTML = miembrosActuales
    .map(
      (m) => `
    <div class="resp-chip" onclick="toggleResp(this)" data-id="${m.id}"
      style="font-size:10px;padding:2px 7px 2px 4px">
      <div class="avatar avatar-sm" style="width:16px;height:16px;font-size:8px">${inic(m.nombre)}</div>
      ${m.nombre.split(" ")[0]}
    </div>`,
    )
    .join("");
}

function _escHtml(txt) {
  return String(txt || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function _contarNodosCompuestos(nodo) {
  const hijos = nodo?.hijos || [];
  return 1 + hijos.reduce((acc, h) => acc + _contarNodosCompuestos(h), 0);
}

function _renderNodoCompuesto(nodo, nivel = 0) {
  const hijos = nodo?.hijos || [];
  const esCompuesta = nodo?.tipo === "COMPUESTA";
  const icono = esCompuesta ? "ph-tree-structure" : "ph-dot-outline";
  const horas = Number(nodo?.horasEstimadas || 0).toFixed(1);
  const progreso = Number(nodo?.progreso || 0).toFixed(1);
  const responsables = (nodo?.responsables || []).length;
  const margen = nivel * 14;

  return `
    <div style="margin-left:${margen}px;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--b1);border-radius:8px;background:var(--s1)">
        <i class="ph ${icono}" style="font-size:15px;color:${esCompuesta ? "var(--a2)" : "var(--t3)"}"></i>
        <div style="min-width:0;flex:1">
          <div style="font-size:12px;color:var(--t1);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_escHtml(nodo?.titulo || "Tarea")}</div>
          <div class="txt3" style="font-size:10px;font-family:var(--mono)">ID: ${_escHtml((nodo?.id || "").slice(-8))}</div>
        </div>
        <span class="badge bi" title="Horas estimadas">${horas}h</span>
        <span class="badge bb" title="Progreso">${progreso}%</span>
        <span class="badge ba" title="Responsables">${responsables}</span>
      </div>
      ${hijos.map((h) => _renderNodoCompuesto(h, nivel + 1)).join("")}
    </div>
  `;
}

function _renderizarJerarquiaCompuesta(jerarquia) {
  const wrap = document.getElementById("stCompositeWrap");
  const resumen = document.getElementById("stCompositeResumen");
  const tree = document.getElementById("stCompositeTree");
  if (!wrap || !resumen || !tree) return;

  wrap.style.display = "";
  if (!jerarquia || typeof jerarquia !== "object") {
    resumen.textContent = "Jerarquía no disponible para esta tarea.";
    tree.innerHTML = "";
    return;
  }

  const totalNodos = _contarNodosCompuestos(jerarquia);
  const horas = Number(jerarquia.horasEstimadas || 0).toFixed(1);
  const progreso = Number(jerarquia.progreso || 0).toFixed(1);
  const responsables = (jerarquia.responsables || []).length;

  resumen.innerHTML = `
    <span class="badge bb">Progreso ${progreso}%</span>
    <span class="badge bi">Horas ${horas}h</span>
    <span class="badge ba">Responsables ${responsables}</span>
    <span class="badge bg">Nodos ${totalNodos}</span>
  `;
  tree.innerHTML = _renderNodoCompuesto(jerarquia, 0);
}

/* ══════════════════════════════════════════════════
   NOTIFICACIONES EXTERNAS — Modal de envío externo
══════════════════════════════════════════════════ */

let _notifDestinatarios = [];

async function abrirModalNotifExterna() {
  let modal = document.getElementById("mNotifExterna");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "overlay";
    modal.id = "mNotifExterna";
    modal.innerHTML = _htmlModalNotifExterna();
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) cerrarModal("mNotifExterna");
    });
  }
  abrirModal("mNotifExterna");
  await _cargarDestinatariosNotif();
}

function _htmlModalNotifExterna() {
  return `
<div class="modal" style="width:520px">
  <div class="flex-between" style="margin-bottom:6px">
    <div class="modal-t" style="margin-bottom:0">
      <i class="ph ph-paper-plane-right" style="color:var(--a)"></i>
      Enviar notificación externa
    </div>
    <button class="btn btn-ghost btn-xs" onclick="cerrarModal('mNotifExterna')">✕</button>
  </div>

  <div style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:10px 12px;margin-bottom:16px">
    <div style="font-size:11px;color:var(--t3);font-family:var(--mono);line-height:1.6">
      <strong style="color:var(--a2)">Flujo de notificación:</strong>
      Proveedor → Origen → Interfaz → API externa
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap">
      <span style="font-family:var(--mono);font-size:10px;padding:3px 8px;border-radius:4px;background:var(--s3);color:var(--t3);border:1px solid var(--b1)">Proveedor</span>
      <span style="color:var(--t3);font-size:12px">→</span>
      <span id="flowFabrica" style="font-family:var(--mono);font-size:10px;padding:3px 8px;border-radius:4px;background:var(--abg);color:var(--a2);border:1px solid rgba(108,99,255,.3)">Canal Email</span>
      <span style="color:var(--t3);font-size:12px">→</span>
      <span id="flowAdapter" style="font-family:var(--mono);font-size:10px;padding:3px 8px;border-radius:4px;background:var(--amberbg);color:var(--amber);border:1px solid rgba(251,191,36,.3)">Canal Email</span>
      <span style="color:var(--t3);font-size:12px">→</span>
      <span id="flowApi" style="font-family:var(--mono);font-size:10px;padding:3px 8px;border-radius:4px;background:var(--greenbg);color:var(--green);border:1px solid rgba(52,211,153,.3)">Email API</span>
    </div>
  </div>

  <div class="fg">
    <label class="flabel">Canal de envio</label>
    <div style="display:flex;gap:8px;margin-top:6px" id="notifCanalBtns">
      <button class="btn btn-outline btn-sm activo-canal" data-canal="email" onclick="_selCanalNotif(this)"
        style="flex:1;border-color:var(--a);background:var(--abg);color:var(--a2)">
        <i class="ph ph-envelope"></i> Email
      </button>
      <button class="btn btn-outline btn-sm" data-canal="whatsapp" onclick="_selCanalNotif(this)" style="flex:1">
        <i class="ph ph-chat-circle"></i> WhatsApp
      </button>
      <button class="btn btn-outline btn-sm" data-canal="sms" onclick="_selCanalNotif(this)" style="flex:1">
        <i class="ph ph-device-mobile"></i> SMS
      </button>
    </div>
    <input type="hidden" id="notifCanalSel" value="email">
  </div>

  <div class="fg">
    <label class="flabel">Destinatario</label>
    <select class="fselect" id="notifDestinatarioSel">
      <option value="">— Cargando usuarios... —</option>
    </select>
    <div id="notifContactoInfo" style="margin-top:5px;font-size:11px;color:var(--t3);font-family:var(--mono)"></div>
  </div>

  <div class="fg">
    <label class="flabel">Asunto (email)</label>
    <input class="finput" id="notifAsuntoInput" value="Notificacion TaskFlow" placeholder="Asunto del email">
  </div>

  <div class="fg">
    <label class="flabel">Mensaje</label>
    <textarea class="ftextarea" id="notifMensajeInput"
      placeholder="Escribe el mensaje de la notificacion..."
      style="min-height:80px"></textarea>
  </div>

  <div id="notifEnvioResultadoModal" style="display:none;margin-bottom:12px"></div>
  <div class="ferror" id="notifErrorModal"></div>

  <div class="modal-actions">
    <button class="btn btn-ghost" onclick="cerrarModal('mNotifExterna')">Cancelar</button>
    <button class="btn btn-outline btn-sm" onclick="_probarTodosCanalesModal()" id="btnProbarModal">
      <i class="ph ph-broadcast"></i> Probar todos los canales
    </button>
    <button class="btn btn-primary" onclick="_enviarNotifExternaModal()" id="btnEnviarNotifModal">
      <i class="ph ph-paper-plane-right"></i> Enviar
    </button>
  </div>
</div>`;
}

const _FLOW_MAP = {
  email: { fabrica: "Canal Email", adapter: "Canal Email", api: "Email API" },
  whatsapp: {
    fabrica: "Canal WhatsApp",
    adapter: "Canal WhatsApp",
    api: "WhatsApp API",
  },
  sms: { fabrica: "Canal SMS", adapter: "Canal SMS", api: "SMS API" },
};

function _selCanalNotif(btn) {
  document.querySelectorAll("#notifCanalBtns button").forEach((b) => {
    b.classList.remove("activo-canal");
    b.style.borderColor = "";
    b.style.background = "";
    b.style.color = "";
  });
  btn.classList.add("activo-canal");
  btn.style.borderColor = "var(--a)";
  btn.style.background = "var(--abg)";
  btn.style.color = "var(--a2)";
  const canal = btn.dataset.canal;
  document.getElementById("notifCanalSel").value = canal;
  const flow = _FLOW_MAP[canal];
  if (flow) {
    document.getElementById("flowFabrica").textContent = flow.fabrica;
    document.getElementById("flowAdapter").textContent = flow.adapter;
    document.getElementById("flowApi").textContent = flow.api;
  }
  _actualizarContactoInfoModal();
}

async function _cargarDestinatariosNotif() {
  try {
    const us = await api("GET", "/usuarios/activos");
    _notifDestinatarios = us;
    const sel = document.getElementById("notifDestinatarioSel");
    if (!sel) return;
    sel.innerHTML =
      '<option value="">— Selecciona un destinatario —</option>' +
      us
        .map((u) => `<option value="${u.id}">${u.nombre} (${u.rol})</option>`)
        .join("");
    sel.addEventListener("change", _actualizarContactoInfoModal);
  } catch (_) {}
}

function _actualizarContactoInfoModal() {
  const sel = document.getElementById("notifDestinatarioSel");
  const info = document.getElementById("notifContactoInfo");
  const canal =
    (document.getElementById("notifCanalSel") &&
      document.getElementById("notifCanalSel").value) ||
    "email";
  if (!sel || !info) return;
  const usuario = _notifDestinatarios.find((u) => u.id === sel.value);
  if (!usuario) {
    info.textContent = "";
    return;
  }
  const mapa = {
    email: "Email: " + usuario.email,
    whatsapp: "WhatsApp: (configura en Notificaciones > Contacto)",
    sms: "SMS: (configura en Notificaciones > Contacto)",
  };
  info.textContent = mapa[canal] || usuario.email;
}

async function _enviarNotifExternaModal() {
  const canal =
    document.getElementById("notifCanalSel") &&
    document.getElementById("notifCanalSel").value;
  const userId =
    document.getElementById("notifDestinatarioSel") &&
    document.getElementById("notifDestinatarioSel").value;
  const asunto =
    document.getElementById("notifAsuntoInput") &&
    document.getElementById("notifAsuntoInput").value.trim();
  const mensaje =
    document.getElementById("notifMensajeInput") &&
    document.getElementById("notifMensajeInput").value.trim();
  const errEl = document.getElementById("notifErrorModal");
  const resEl = document.getElementById("notifEnvioResultadoModal");
  if (errEl) errEl.textContent = "";
  if (resEl) resEl.style.display = "none";

  if (!userId) {
    if (errEl) errEl.textContent = "Selecciona un destinatario";
    return;
  }
  if (!mensaje) {
    if (errEl) errEl.textContent = "El mensaje es obligatorio";
    return;
  }

  const btn = document.getElementById("btnEnviarNotifModal");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Enviando...';
  }

  try {
    const r = await api("POST", "/notificaciones/enviar-externo", {
      canal,
      usuarioId: userId,
      mensaje,
      asunto: asunto || "Notificacion TaskFlow",
    });
    _mostrarResultadoNotifModal([{ canal, ...r }]);
    toast("Notificacion enviada por " + canal);
    if (document.getElementById("notifMensajeInput"))
      document.getElementById("notifMensajeInput").value = "";
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
    toast(e.message, "err");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-paper-plane-right"></i> Enviar';
    }
  }
}

async function _probarTodosCanalesModal() {
  const userId =
    document.getElementById("notifDestinatarioSel") &&
    document.getElementById("notifDestinatarioSel").value;
  const errEl = document.getElementById("notifErrorModal");
  if (!userId) {
    if (errEl) errEl.textContent = "Selecciona un destinatario";
    return;
  }
  const btn = document.getElementById("btnProbarModal");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Probando...';
  }
  if (errEl) errEl.textContent = "";
  try {
    const r = await api("POST", "/notificaciones/probar-canales", {
      usuarioId: userId,
    });
    const resultados = Object.entries(r.resultados || {}).map(
      ([canal, res]) => ({ canal, ...res }),
    );
    _mostrarResultadoNotifModal(resultados);
    toast("Prueba de todos los canales completada");
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="ph ph-broadcast"></i> Probar todos los canales';
    }
  }
}

function _mostrarResultadoNotifModal(resultados) {
  const resEl = document.getElementById("notifEnvioResultadoModal");
  if (!resEl) return;
  resEl.style.display = "";
  resEl.innerHTML = `
    <div style="background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:10px 12px">
      <div style="font-size:11px;font-weight:600;color:var(--t2);margin-bottom:8px;font-family:var(--mono)">Resultado del canal</div>
      ${resultados
        .map(
          (r) => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--b0)">
          <span>${r.enviada ? "✅" : "❌"}</span>
          <span class="badge ${r.enviada ? "bg" : "br"}">${(r.canal || "?").toUpperCase()}</span>
          <span style="font-size:11px;color:var(--t3);font-family:var(--mono);flex:1">${r.detalle || ""}</span>
          ${r.contacto_usado ? `<span style="font-size:10px;color:var(--t3)">${r.contacto_usado}</span>` : ""}
        </div>`,
        )
        .join("")}
    </div>`;
}

/* ══════════════════════════════════════════════════
   SSE — Stream de notificaciones en tiempo real
══════════════════════════════════════════════════ */

let _sseConexion = null;

function conectarStream() {
  if (!S || !S.token_acceso) return;
  if (_sseConexion) _sseConexion.close();

  _sseConexion = new EventSource(
    `${API}/notificaciones/stream?token=${S.token_acceso}`,
  );

  _sseConexion.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.tipo === "ping" || data.tipo === "conectado") return;
      if (data.tipo === "notificacion") {
        const badge = document.getElementById("badgeNotif");
        if (badge) {
          const n = parseInt(badge.textContent || "0") + 1;
          badge.textContent = n;
          badge.style.display = "";
        }
        toast("🔔 " + (data.mensaje || "Nueva notificacion"));
      }
    } catch (_) {}
  };

  _sseConexion.onerror = () => {
    setTimeout(() => {
      if (S && S.token_acceso) conectarStream();
    }, 5000);
  };
}

function desconectarStream() {
  if (_sseConexion) {
    _sseConexion.close();
    _sseConexion = null;
  }
}

window._conectarStreamSSE = conectarStream;
window._desconectarStreamSSE = desconectarStream;

/* ══════════════════════════════════════════════════
   ESTILOS INLINE para panel de subtareas
══════════════════════════════════════════════════ */

(function _inyectarEstilos() {
  const css = `
#panelSubtareas{position:fixed;inset:0;z-index:300;pointer-events:none}
#panelSubtareas.open{pointer-events:auto}
.subtarea-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);opacity:0;transition:opacity .2s}
#panelSubtareas.open .subtarea-backdrop{opacity:1}
.subtarea-drawer{position:absolute;top:0;right:0;width:460px;max-width:96vw;height:100%;
  background:var(--s1);border-left:1px solid var(--b2);display:flex;flex-direction:column;
  transform:translateX(100%);transition:transform .22s cubic-bezier(.4,0,.2,1);
  box-shadow:-12px 0 48px rgba(0,0,0,.4)}
#panelSubtareas.open .subtarea-drawer{transform:translateX(0)}
.subtarea-header{display:flex;align-items:flex-start;justify-content:space-between;
  padding:18px 20px 12px;border-bottom:1px solid var(--b1);flex-shrink:0}
.subtarea-label{font-size:10px;font-weight:500;color:var(--a2);letter-spacing:.08em;
  text-transform:uppercase;font-family:var(--mono);margin-bottom:4px;display:flex;align-items:center;gap:5px}
.subtarea-title{font-size:15px;font-weight:600;color:var(--t1);letter-spacing:-.02em;line-height:1.3}
.subtarea-progress-wrap{padding:12px 20px 8px;border-bottom:1px solid var(--b0);flex-shrink:0}
.subtarea-progress-label{display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-bottom:5px}
.subtarea-lista{flex:1;overflow-y:auto;padding:8px 12px}
.subtarea-item{display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:var(--r);
  margin-bottom:4px;border:1px solid var(--b0);transition:background .1s,border-color .1s}
.subtarea-item:hover{background:var(--s2);border-color:var(--b1)}
.subtarea-item.completada{opacity:.55}
.subtarea-item.completada .subtarea-item-titulo{text-decoration:line-through;color:var(--t3)}
.subtarea-check{cursor:pointer;flex-shrink:0;margin-top:1px;transition:transform .1s}
.subtarea-check:hover{transform:scale(1.15)}
.subtarea-body{flex:1;min-width:0}
.subtarea-item-titulo{font-size:13px;font-weight:500;color:var(--t1);margin-bottom:2px}
.subtarea-item-desc{font-size:12px;color:var(--t3);margin-bottom:4px}
.subtarea-item-meta{display:flex;gap:8px;font-size:10px;color:var(--t3);font-family:var(--mono)}
.subtarea-acciones{flex-shrink:0;opacity:0;transition:opacity .15s}
.subtarea-item:hover .subtarea-acciones{opacity:1}
.subtarea-form{border-top:1px solid var(--b1);padding:14px 16px;background:var(--s2);flex-shrink:0}
.subtarea-form-title{font-size:12px;font-weight:500;color:var(--t2);margin-bottom:10px;display:flex;align-items:center;gap:6px}
`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();
