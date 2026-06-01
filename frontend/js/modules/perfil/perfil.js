/* ═══════════════════════════════════════════════════
   TaskFlow — modules/perfil/perfil.js
   Lógica del módulo Perfil (gestión de datos personales, bio y avatar).
   Usa PerfilAdapter para normalizar los datos.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.perfilAdapter;
  const payload = window.TF.modules.perfilPayload;
  const state = window.TF.state;

  async function cargarPerfil() {
    if (!state.get("sesionActiva")) return;
    const rawUser = state.get("usuario");
    const u = adapter.adapt(rawUser);

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
    const elFR = document.getElementById("perFechaReg");
    if (elFR) {
      elFR.textContent = u.fechaRegistro
        ? new Date(u.fechaRegistro).toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "long",
            year: "numeric"
          })
        : "—";
    }

    aplicarAvatarPerfil(u.avatarUri, u.nombre);

    // Stats: proyectos y último acceso
    try {
      const ps = await window.api("GET", "/proyectos/");
      const elP = document.getElementById("perStProyectos");
      if (elP) elP.textContent = ps.length;

      // Tareas del usuario
      let totalT = 0;
      await Promise.all(
        ps.map(async (p) => {
          try {
            const res = await window.api("GET", `/proyectos/${p.id}/tareas?limite=200`);
            const ts = Array.isArray(res) ? res : res.datos || [];
            totalT += ts.filter((t) => (t.responsables || []).includes(u.id)).length;
          } catch (_) {}
        }),
      );
      const elT = document.getElementById("perStTareas");
      if (elT) elT.textContent = totalT;
      const elA = document.getElementById("perStAcceso");
      if (elA) {
        elA.textContent = u.ultimoAcceso
          ? new Date(u.ultimoAcceso).toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "short",
            })
          : "—";
      }
    } catch (_) {}
  }

  function aplicarAvatarPerfil(url, nombre) {
    const img = document.getElementById("perAvatarImg");
    const inicEl = document.getElementById("perAvatarInic");
    if (!img || !inicEl) return;
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
      inicEl.textContent = window.inic ? window.inic(nombre) : "";
    }
  }

  function previsualizarAvatar(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById("perAvatarUrl").value = e.target.result;
      const usuario = state.get("usuario") || {};
      aplicarAvatarPerfil(e.target.result, usuario.nombre || "");
    };
    reader.readAsDataURL(file);
  }

  function previsualizarAvatarUrl(url) {
    const usuario = state.get("usuario") || {};
    aplicarAvatarPerfil(url || null, usuario.nombre || "");
  }

  async function guardarPerfil() {
    document.getElementById("perError").textContent = "";
    const avatarUri = document.getElementById("perAvatarUrl").value.trim() || null;
    try {
      const data = payload.actualizarPerfil({
        nombre: document.getElementById("perNombre").value,
        descripcion: document.getElementById("perDesc").value,
        avatarUri,
      });
      const r = await window.api("PUT", "/usuarios/perfil", data);
      const normalizado = adapter.adapt(r);
      const usuarioActual = state.get("usuario") || {};
      state.set("usuario", { ...usuarioActual, ...normalizado });

      if (window.actualizarUI) window.actualizarUI();
      cargarPerfil();
      if (window.toast) window.toast("Perfil actualizado");
    } catch (e) {
      document.getElementById("perError").textContent = e.message;
    }
  }

  // Exponer a global
  window.cargarPerfil = cargarPerfil;
  window.aplicarAvatarPerfil = aplicarAvatarPerfil;
  window.previsualizarAvatar = previsualizarAvatar;
  window.previsualizarAvatarUrl = previsualizarAvatarUrl;
  window.guardarPerfil = guardarPerfil;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("perfil", {
    name: "perfil",
    htmlPath: "js/modules/perfil/perfil.html",
    cssPath: null,
    adapter: adapter,
    payload: payload,
    init: cargarPerfil,
  });
})();
