/* ═══════════════════════════════════════════════════
   TaskFlow — modules/notificaciones/notificaciones.js
   Lógica del módulo Notificaciones (bandeja, preferencias, envío externo con Twilio).
   Usa NotificacionesAdapter para normalizar los datos.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.notificacionesAdapter;
  const payload = window.TF.modules.notificacionesPayload;
  const state = window.TF.state;

  async function cargarNotificaciones() {
    if (!state.get("sesionActiva")) return;
    const usuario = state.get("usuario") || {};
    const esAdmin = usuario.rol === "ADMIN";
    const panelAdmin = document.getElementById("panelAdminNotif");
    const panelMio = document.getElementById("panelMisNotif");
    const btnMarcar = document.getElementById("btnMarcarLeidas");

    const panelEnvio = document.getElementById("panelEnvioExterno");
    const esAdminOPM = esAdmin || usuario.rol === "PROJECT_MANAGER";

    if (panelAdmin) panelAdmin.style.display = esAdmin ? "" : "none";
    if (panelMio) panelMio.style.display = esAdmin ? "none" : "";
    if (btnMarcar) btnMarcar.style.display = esAdmin ? "none" : "";
    if (panelEnvio) panelEnvio.style.display = esAdminOPM ? "" : "none";

    // Cargar usuarios para el selector del panel de envío
    if (esAdminOPM) _notifCargarDestinatarios();

    if (!esAdmin) {
      try {
        const res = await window.api("GET", "/notificaciones/");
        const ns = adapter.adapt(res);
        const noLeidas = ns.filter((n) => !n.leida).length;
        if (window.actualizarBadgeNotif) {
          window.actualizarBadgeNotif(noLeidas);
        }
        const iconoNotif = (tipo) =>
          ({
            TAREA_ASIGNADA: "📋",
            COMENTARIO_EN_TAREA: "💬",
            MENCION_EN_COMENTARIO: "@",
            ESTADO_TAREA_CAMBIADO: "→",
            TAREA_VENCIDA: "⚠",
            MIEMBRO_INVITADO: "👥",
          })[tipo] || "🔔";

        const cont = document.getElementById("listaNotifc");
        if (cont) {
          cont.innerHTML = ns.length
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
                    <div class="notif-ts">${window.fFecha ? window.fFecha(n.creadoEn) : n.creadoEn}</div>
                  </div>
                  ${accion}
                </div>`;
                })
                .join("")
            : '<div class="vacío">Sin notificaciones</div>';
        }

        const rawPrefs = await window.api("GET", "/notificaciones/preferencias");
        const prefs = adapter.adaptPreferencias(rawPrefs);
        const prefsCont = document.getElementById("prefsNotif");
        if (prefsCont) {
          prefsCont.innerHTML = `<div>${[
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
        }
      } catch (e) {
        if (window.toast) window.toast(e.message, "err");
      }
    }
  }

  async function irATarea(tareaId, tituloTarea) {
    if (!tareaId) return;

    try {
      const res = await window.api("GET", `/tareas/${tareaId}`);
      if (res.proyectoId) {
        state.set("proyectoActualId", res.proyectoId);
        if (window.mostrarPantalla) window.mostrarPantalla("tareas");
        if (window.cargarSelectores) await window.cargarSelectores();
        const sel = document.getElementById("selTareasProy");
        if (sel) sel.value = res.proyectoId;
        if (window.cargarTareasPaginadas) {
          await window.cargarTareasPaginadas(res.proyectoId, 1);
        }
        setTimeout(() => {
          if (window.abrirPanelComentarios) {
            window.abrirPanelComentarios(tareaId, tituloTarea || res.titulo);
          }
        }, 300);
      }
    } catch (e) {
      if (window.toast) window.toast("Abriendo comentarios...", "ok");
      if (window.abrirPanelComentarios) {
        window.abrirPanelComentarios(tareaId, tituloTarea);
      }
    }
  }

  async function marcarLeida(id) {
    try {
      await window.api("PUT", `/notificaciones/${id}/leer`);
      cargarNotificaciones();
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  async function marcarTodasLeidas() {
    try {
      const r = await window.api("PUT", "/notificaciones/leer-todas");
      if (window.toast) window.toast(r.mensaje);
      cargarNotificaciones();
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  async function guardarPrefs() {
    const on = (id) => document.getElementById(id)?.classList.contains("on");
    try {
      const data = payload.actualizarPreferencias({
        notificacionAsignacion: on("pn1"),
        notificacionVencimiento: on("pn2"),
        notificacionComentario: on("pn3"),
        notificacionCambioEstado: on("pn4"),
      });
      await window.api("PUT", "/notificaciones/preferencias", data);
      if (window.toast) window.toast("Preferencias guardadas");
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  const _NOTIF_FLOW = {
    email: { fabrica: "Canal Email", adapter: "Canal Email", api: "Email API" },
    whatsapp: { fabrica: "Canal WhatsApp", adapter: "Canal WhatsApp", api: "WhatsApp API" },
    sms: { fabrica: "Canal SMS", adapter: "Canal SMS", api: "SMS API" },
  };

  function notifSelCanal(el) {
    document.querySelectorAll(".ncanal-opt").forEach((c) => c.classList.remove("activo"));
    el.classList.add("activo");
    const canal = el.dataset.canal;
    const flow = _NOTIF_FLOW[canal] || {};

    const set = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = val;
    };
    set("nflujoCanal", canal);
    set("nflujoFabrica", flow.fabrica || "");
    set("nflujoAdapter", flow.adapter || "");
    set("nflujoApi", flow.api || "");

    const telWrap = document.getElementById("nTelWrap");
    const telLabel = document.getElementById("nTelLabel");
    const asuntoFg = document.getElementById("nAsunto") && document.getElementById("nAsunto").closest(".fg");
    if (telWrap) {
      const necesitaTel = canal === "whatsapp" || canal === "sms";
      telWrap.style.display = necesitaTel ? "" : "none";
      if (telLabel) {
        telLabel.textContent = canal === "whatsapp" ? "Numero de WhatsApp" : "Numero de SMS";
      }
    }
    if (asuntoFg) asuntoFg.style.display = canal === "email" ? "" : "none";
  }

  async function _notifCargarDestinatarios() {
    const sel = document.getElementById("nDestinatario");
    if (!sel || sel.options.length > 1) return;
    try {
      const us = await window.api("GET", "/usuarios/activos");
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
    const canalEl = document.querySelector(".ncanal-opt.activo");
    const canal = canalEl ? canalEl.dataset.canal : "email";
    const userId = document.getElementById("nDestinatario")?.value || "";
    const msgEl = document.getElementById("nMensaje");
    const mensaje = msgEl ? msgEl.value.trim() : "";
    const asuntoEl = document.getElementById("nAsunto");
    const asunto = asuntoEl ? asuntoEl.value.trim() : "Notificacion TaskFlow";
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

    if (errEl) errEl.textContent = "";
    if (resEl) resEl.textContent = "";

    if (!userId) {
      if (errEl) errEl.textContent = "Selecciona un destinatario";
      return;
    }
    if (!mensaje) {
      if (errEl) errEl.textContent = "Escribe un mensaje";
      return;
    }
    if ((canal === "whatsapp" || canal === "sms") && !telefono) {
      if (errEl) {
        errEl.textContent = `Ingresa el número de teléfono para ${canal.toUpperCase()} (incluye código de país, ej: +573001234567)`;
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Enviando...';
    }
    if (resEl) resEl.innerHTML = '<span class="spinner"></span> Procesando...';

    try {
      const data = payload.enviarExterno({
        canal,
        usuarioId: userId,
        mensaje,
        asunto,
        contacto: telefono,
      });

      const r = await window.api("POST", "/notificaciones/enviar-externo", data);

      const ok = r.enviada;
      const estado = (r.estado || "").toLowerCase();
      const entregado = estado === "delivered";
      const aceptado = ["accepted", "queued", "sending", "sent", "delivered"].includes(estado);
      const etiqueta = entregado ? "Entregado" : aceptado ? "Aceptado por Twilio" : "No enviado";
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

      if (window.toast) {
        window.toast(
          aceptado ? `Notificación aceptada por ${canal}` : `No se pudo enviar: ${r.detalle || "error"}`,
          aceptado ? "ok" : "err",
        );
      }

      if (msgEl && ok) msgEl.value = "";
      if (telEl && ok && (canal === "whatsapp" || canal === "sms")) {
        telEl.value = telefono;
      }
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
      if (resEl) {
        resEl.innerHTML = `<i class="ph ph-x-circle" style="color:var(--red)"></i> Error: ${e.message}`;
      }
      if (window.toast) window.toast(e.message, "err");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Enviar notificación';
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
    if (resEl) resEl.innerHTML = '<span class="spinner"></span> Probando canales...';

    try {
      const cuerpo = { usuarioId: userId };
      if (telefono) {
        cuerpo.contactoWhatsapp = telefono;
        cuerpo.contactoSms = telefono;
      }
      const r = await window.api("POST", "/notificaciones/probar-canales", cuerpo);
      const resultados = r.resultados || {};
      const orden = ["email", "whatsapp", "sms"];
      const html = orden
        .filter((c) => resultados[c])
        .map((c) => {
          const x = resultados[c] || {};
          const estado = (x.estado || "").toLowerCase();
          const aceptado = ["accepted", "queued", "sending", "sent", "delivered"].includes(estado);
          return `${aceptado ? "✅" : "❌"} ${c.toUpperCase()}: ${x.detalle || "sin detalle"}${x.contacto_usado ? ` · ${x.contacto_usado}` : ""}`;
        })
        .join(" · ");
      if (resEl) resEl.textContent = html || "Sin resultados";
      if (window.toast) window.toast("Prueba de canales completada");
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
      if (resEl) resEl.textContent = `Error: ${e.message}`;
      if (window.toast) window.toast(e.message, "err");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-broadcast"></i> Probar todos';
      }
    }
  }

  // Exponer a global
  window.cargarNotificaciones = cargarNotificaciones;
  window.irATarea = irATarea;
  window.marcarLeida = marcarLeida;
  window.marcarTodasLeidas = marcarTodasLeidas;
  window.guardarPrefs = guardarPrefs;
  window.notifSelCanal = notifSelCanal;
  window.notifEnviar = notifEnviar;
  window.notifProbarTodos = notifProbarTodos;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("notificaciones", {
    name: "notificaciones",
    htmlPath: "js/modules/notificaciones/notificaciones.html",
    cssPath: null,
    adapter: adapter,
    payload: payload,
    init: cargarNotificaciones,
  });
})();
