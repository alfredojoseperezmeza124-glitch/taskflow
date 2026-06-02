/* ═══════════════════════════════════════════════════
   TaskFlow — configuracion.js
   Sección de configuración del sistema.
   Los temas se obtienen del backend vía Abstract Factory.
   NO hay colores hardcodeados — todo viene de GET /temas
════════════════════════════════════════════════════ */

let _temaActual = localStorage.getItem("tf_tema") || "oscuro";
let _temasBackend = []; // cache de temas cargados desde el backend

/* ── CARGA PRINCIPAL ── */
async function cargarConfiguracion() {
  if (!S) return;

  // Esperar a que loader.js haya llenado el slot
  let intentos = 0;
  while (!document.getElementById("temasGrid") && intentos < 20) {
    await new Promise((r) => setTimeout(r, 50));
    intentos++;
  }
  if (!document.getElementById("temasGrid")) return;

  const esAdmin = S.usuario.rol === "ADMIN";

  ["cardConfigGeneral", "cardPolitica"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = esAdmin ? "" : "none";
  });

  // Cargar temas desde el backend (Abstract Factory)
  await _cargarTemasDesdeBackend();

  // Configuración del sistema (solo Admin)
  if (esAdmin) {
    try {
      const cfg = await api("GET", "/configuracion");
      _poblarFormConfiguracion(cfg);
      // Marcar el tema activo según la BD
      if (cfg.tema) {
        _temaActual = cfg.tema;
        _marcarTemaActivo(cfg.tema);
      }
    } catch (_) {}
  }

  // Usuarios activos
  try {
    const us = await api("GET", "/usuarios/activos");
    const el = document.getElementById("cfgUsersOnline");
    if (el)
      el.textContent = `${us.length} usuario${us.length !== 1 ? "s" : ""} activo${us.length !== 1 ? "s" : ""}`;
  } catch (_) {}
}

/* ── CARGA DE TEMAS DESDE EL BACKEND (Abstract Factory) ── */
async function _cargarTemasDesdeBackend() {
  const grid = document.getElementById("temasGrid");
  if (!grid) return;

  grid.innerHTML = `<div style="padding:20px;color:var(--t3);font-family:var(--mono);font-size:12px">
    <span class="spinner"></span> Cargando temas desde la fábrica...
  </div>`;

  try {
    // GET /temas → el backend instancia cada fábrica y devuelve sus variables
    const temas = await api("GET", "/temas");
    _temasBackend = temas;

    // Ajustar columnas según cantidad de temas
    grid.style.gridTemplateColumns = `repeat(${temas.length}, 1fr)`;

    grid.innerHTML = temas
      .map((t) => {
        const v = t.variables;
        const c = v.colores;
        const activo = t.nombre === _temaActual;

        // Usar los colores REALES de la fábrica para la previsualización
        return `
      <div class="tema-card ${activo ? "activo" : ""}" onclick="seleccionarTema('${t.nombre}')">
        <div class="tema-preview" style="background:${c.fondo}">
          <div class="tema-preview-sidebar" style="background:${c.superficie}">
            <div class="tema-preview-dot" style="background:${c.acento}"></div>
            <div class="tema-preview-dot" style="background:${c.verde}"></div>
            <div class="tema-preview-dot" style="background:${c.silenciado}"></div>
          </div>
          <div class="tema-preview-main" style="background:${c.fondo}">
            <div class="tema-preview-bar" style="background:${c.acento};width:70%"></div>
            <div class="tema-preview-bar" style="background:${c.superficie};width:90%"></div>
            <div class="tema-preview-bar" style="background:${c.superficie};width:55%"></div>
            <div style="display:flex;gap:4px;margin-top:2px">
              <div style="height:10px;width:30%;background:${c.acento};border-radius:3px;opacity:.8"></div>
              <div style="height:10px;width:20%;background:${c.verde};border-radius:3px;opacity:.7"></div>
            </div>
          </div>
        </div>
        <div class="tema-nombre">${v.nombre.charAt(0).toUpperCase() + v.nombre.slice(1)}</div>
        <div class="tema-desc">Fabrica${v.nombre.charAt(0).toUpperCase() + v.nombre.slice(1)}()</div>
        <div class="tema-colores">
          ${[c.fondo, c.superficie, c.acento, c.verde, c.rojo, c.ambar, c.azul]
            .map(
              (col) =>
                `<div class="tema-color-dot" style="background:${col}" title="${col}"></div>`,
            )
            .join("")}
        </div>
      </div>`;
      })
      .join("");

    // Mostrar variables del tema activo al cargar
    const temaActivo = temas.find((t) => t.nombre === _temaActual);
    if (temaActivo) _mostrarVariablesTema(temaActivo);
  } catch (e) {
    grid.innerHTML = `<div class="vacío">Error al cargar temas: ${e.message}</div>`;
  }
}

function _marcarTemaActivo(nombre) {
  document.querySelectorAll(".tema-card").forEach((card) => {
    card.classList.toggle(
      "activo",
      card.getAttribute("onclick") === `seleccionarTema('${nombre}')`,
    );
  });
}

/* ── SELECCIONAR TEMA ── */
async function seleccionarTema(nombreTema) {
  _temaActual = nombreTema;

  // 1. Aplicar en el frontend inmediatamente
  aplicarTema(nombreTema);

  // 2. Marcar tarjeta activa
  _marcarTemaActivo(nombreTema);

  // 3. Mostrar variables desde el cache del backend
  const temaData = _temasBackend.find((t) => t.nombre === nombreTema);
  if (temaData) {
    _mostrarVariablesTema(temaData);
  } else {
    // Si no está en caché, pedir al backend
    try {
      const vars = await api("GET", `/temas/${nombreTema}`);
      _mostrarVariablesTema({ nombre: nombreTema, variables: vars });
    } catch (_) {}
  }

  // 4. Guardar en el sistema (Admin) o solo local
  if (S?.usuario?.rol === "ADMIN") {
    try {
      await api("PUT", "/configuracion", { tema: nombreTema });
      toast(`Tema "${nombreTema}" aplicado y guardado`);
    } catch (_) {
      toast(`Tema "${nombreTema}" aplicado localmente`);
    }
  } else {
    toast(`Tema "${nombreTema}" aplicado`);
  }
}

/* ── PANEL DE VARIABLES ── */
function _mostrarVariablesTema(temaData) {
  const panel = document.getElementById("temaVariablesPanel");
  const contenido = document.getElementById("temaVariablesContenido");
  if (!panel || !contenido) return;

  const v = temaData.variables || temaData;
  const c = v.colores || {};
  panel.style.display = "";

  const etiquetas = {
    fondo: "Fondo",
    superficie: "Superficie",
    superficie2: "Superficie 2",
    borde: "Borde",
    acento: "Acento",
    texto: "Texto",
    silenciado: "Silenciado",
    verde: "Verde",
    ambar: "Ámbar",
    rojo: "Rojo",
    azul: "Azul",
  };

  const nombre = v.nombre || temaData.nombre || "?";
  const nombreCap = nombre.charAt(0).toUpperCase() + nombre.slice(1);

  contenido.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;
      padding:12px;background:var(--s2);border-radius:var(--r);border:1px solid var(--b1)">
      <i class="ph ph-factory" style="font-size:22px;color:var(--a)"></i>
      <div>
        <div style="font-size:13px;font-weight:500;color:var(--t1)">
          Fábrica instanciada:
          <code style="font-family:var(--mono);color:var(--a2);font-size:12px">
            FabricaTema${nombreCap}()
          </code>
        </div>
        <div class="txt3">Fuente: ${v.fuente_base} · Radio: ${v.radio_borde}</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:5px">
        ${Object.values(c)
          .map(
            (col) =>
              `<div style="width:16px;height:16px;border-radius:50%;background:${col};
            border:1px solid rgba(255,255,255,.15)" title="${col}"></div>`,
          )
          .join("")}
      </div>
    </div>
    <div class="tema-vars-grid">
      ${Object.entries(c)
        .map(
          ([k, val]) => `
        <div class="tema-var-item">
          <div class="tema-var-swatch" style="background:${val}"></div>
          <div>
            <div class="tema-var-nombre">${etiquetas[k] || k}</div>
            <div class="tema-var-valor">${val}</div>
          </div>
        </div>`,
        )
        .join("")}
    </div>`;
}

/* ── CONFIGURACIÓN GENERAL ── */
function _poblarFormConfiguracion(cfg) {
  const elN = document.getElementById("cfgNombre");
  const elZ = document.getElementById("cfgZona");
  const elF = document.getElementById("cfgMaxFile");
  if (elN) elN.value = cfg.nombrePlataforma || "TaskFlow";
  if (elZ) elZ.value = cfg.zona_horaria || "America/Bogota";
  if (elF) elF.value = cfg.tamanoMaxArchivoMb || 10;

  const pol = cfg.politicaContrasena || {};
  const elL = document.getElementById("polLong");
  const elC = document.getElementById("polCad");
  if (elL) elL.value = pol.longitudMinima || 8;
  if (elC) elC.value = pol.caducidadDias || 90;
  _setToggle("polMay", pol.requiereMayusculas !== false);
  _setToggle("polNum", pol.requiereNumeros !== false);
  _setToggle("polSim", !!pol.requiereSimbolos);
}

function _setToggle(id, activo) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("on", activo);
}

async function guardarConfiguracion() {
  const errEl = document.getElementById("cfgError");
  if (errEl) errEl.textContent = "";
  try {
    await api("PUT", "/configuracion", {
      nombrePlataforma:
        document.getElementById("cfgNombre")?.value?.trim() || null,
      zona_horaria: document.getElementById("cfgZona")?.value || null,
      tamanoMaxArchivoMb:
        parseInt(document.getElementById("cfgMaxFile")?.value) || null,
    });
    toast("Configuración guardada");
  } catch (e) {
    if (errEl) errEl.textContent = e.message;
  }
}

async function guardarPolitica() {
  try {
    await api("PUT", "/configuracion", {
      politicaContrasena: {
        longitudMinima:
          parseInt(document.getElementById("polLong")?.value) || 8,
        requiereMayusculas: document
          .getElementById("polMay")
          ?.classList.contains("on"),
        requiereNumeros: document
          .getElementById("polNum")
          ?.classList.contains("on"),
        requiereSimbolos: document
          .getElementById("polSim")
          ?.classList.contains("on"),
        caducidadDias: parseInt(document.getElementById("polCad")?.value) || 0,
      },
    });
    toast("Política de contraseñas guardada");
  } catch (e) {
    toast(e.message, "err");
  }
}
