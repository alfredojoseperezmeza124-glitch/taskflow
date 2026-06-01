/* ═══════════════════════════════════════════════════
   TaskFlow — modules/registro/registro.js
   Lógica del módulo Registro (creación de nuevos usuarios).
   Usa RegistroAdapter para normalizar los datos.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.registroAdapter;
  const payload = window.TF.modules.registroPayload;
  const state = window.TF.state;

  function seleccionarRol(el) {
    document
      .querySelectorAll(".registro-rol-opt")
      .forEach((o) => o.classList.remove("activo"));
    el.classList.add("activo");
    const hidden = document.getElementById("rRol");
    if (hidden) hidden.value = el.dataset.val;
  }

  function toggleVerPassReg() {
    const campo = document.getElementById("rPass");
    const icono = document.getElementById("iconoVerPassReg");
    if (!campo) return;
    if (campo.type === "password") {
      campo.type = "text";
      if (icono) icono.className = "ph ph-eye-slash";
    } else {
      campo.type = "password";
      if (icono) icono.className = "ph ph-eye";
    }
  }

  async function crearUsuario() {
    const errEl = document.getElementById("rError");
    if (errEl) errEl.textContent = "";
    const nombre = document.getElementById("rNombre")?.value?.trim();
    const email = document.getElementById("rEmail")?.value?.trim();
    const pass = document.getElementById("rPass")?.value?.trim();
    const rol = document.getElementById("rRol")?.value || "DEVELOPER";
    if (!nombre || !email || !pass) {
      if (errEl) errEl.textContent = "Todos los campos son obligatorios";
      return;
    }
    const btn = document.querySelector("#pantalla-registro .btn-primary");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Creando...';
    }
    try {
      const data = payload.crearUsuario({
        nombre,
        email,
        contrasena: pass,
        rol,
      });
      const res = await window.api("POST", "/usuarios/registro", data);
      const normalizado = adapter.adapt(res);

      // Limpiar formulario
      ["rNombre", "rEmail", "rPass"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      // Resetear selector de rol a Developer
      document
        .querySelectorAll(".registro-rol-opt")
        .forEach((o) => o.classList.remove("activo"));
      const dev = document.querySelector('.registro-rol-opt[data-val="DEVELOPER"]');
      if (dev) dev.classList.add("activo");
      const hidden = document.getElementById("rRol");
      if (hidden) hidden.value = "DEVELOPER";

      if (window._invalidarCacheUsuarios) {
        window._invalidarCacheUsuarios();
      }
      if (window.toast) window.toast("Usuario creado correctamente");
    } catch (e) {
      if (errEl) errEl.textContent = e.message;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-user-plus"></i> Crear usuario';
      }
    }
  }

  // Exponer a global
  window.seleccionarRol = seleccionarRol;
  window.toggleVerPassReg = toggleVerPassReg;
  window.crearUsuario = crearUsuario;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("registro", {
    name: "registro",
    htmlPath: "js/modules/registro/registro.html",
    cssPath: null,
    adapter: adapter,
    payload: payload,
    init: function () {
      // Inicialización del registro
    },
  });
})();
