/* ═══════════════════════════════════════════════════
   TaskFlow — modules/usuarios/usuarios.js
   Lógica del módulo Usuarios (pantalla de administración de usuarios).
   Usa UsuariosAdapter para normalizar los datos.
════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const adapter = window.TF.modules.usuariosAdapter;
  const state = window.TF.state;

  async function cargarUsuarios() {
    const usuario = state.get("usuario") || {};
    if (usuario.rol !== "ADMIN") {
      const tb = document.getElementById("tbUsuarios");
      if (tb) {
        tb.innerHTML = '<tr><td colspan="6" class="vacío">Acceso restringido a Administradores</td></tr>';
      }
      return;
    }
    try {
      const res = await window.api("GET", "/usuarios/");
      const us = adapter.adapt(res);
      const tb = document.getElementById("tbUsuarios");
      if (tb) {
        tb.innerHTML = us
          .map(
            (u) => `<tr>
          <td><div class="flex" style="gap:8px">
            <div class="avatar avatar-sm">${window.inic ? window.inic(u.nombre) : ""}</div>${u.nombre}
          </div></td>
          <td class="txt2">${u.email}</td>
          <td>${window.badgeRol ? window.badgeRol(u.rol) : `<span class="badge">${u.rol}</span>`}</td>
          <td class="txt3">${window.fFecha ? window.fFecha(u.ultimoAcceso) : u.ultimoAcceso}</td>
          <td><span class="badge ${u.estaActivo ? "bg" : "br"}">${u.estaActivo ? "Activo" : "Inactivo"}</span></td>
          <td>${
            u.estaActivo && u.id !== usuario.id
              ? `<button class="btn btn-red btn-xs" onclick="desactivarUsuario('${u.id}')">Desactivar</button>`
              : ""
          }</td>
        </tr>`,
          )
          .join("");
      }
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  async function desactivarUsuario(id) {
    if (!confirm("¿Desactivar este usuario?")) return;
    try {
      await window.api("PUT", `/usuarios/${id}/desactivar`);
      if (window.toast) window.toast("Usuario desactivado");
      if (window._invalidarCacheUsuarios) {
        window._invalidarCacheUsuarios();
      }
      cargarUsuarios();
    } catch (e) {
      if (window.toast) window.toast(e.message, "err");
    }
  }

  // Exponer a global
  window.cargarUsuarios = cargarUsuarios;
  window.desactivarUsuario = desactivarUsuario;

  /* ── Registrar módulo ── */
  window.TF.moduleLoader.registrar("usuarios", {
    name: "usuarios",
    htmlPath: "js/modules/usuarios/usuarios.html",
    cssPath: null,
    adapter: adapter,
    payload: null,
    init: cargarUsuarios,
  });
})();
