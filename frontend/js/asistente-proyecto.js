/**
 * TaskFlow — Asistente de Proyecto
 * Archivo: frontend/js/asistente-proyecto.js
 *
 * Uso: llama a renderAsistenteProyecto(contenedor, proyectoId, token)
 * desde el lugar donde cargas el tab del proyecto.
 */

window.renderAsistenteProyecto = async function (
  contenedor,
  proyectoId,
  token,
) {
  /* ── Helpers API ───────────────────────────────────────────────── */
  const BASE = (window.API_URL || "/api/v1").replace(/\/$/, "");
  const get = (path) =>
    fetch(BASE + path, { headers: { Authorization: "Bearer " + token } }).then(
      (r) => (r.ok ? r.json() : Promise.reject(r)),
    );
  const post = (path, body) =>
    fetch(BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(body),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r)));

  /* ── Cargar contexto del proyecto ──────────────────────────────── */
  let ctxProyecto = null;
  let ctxTareas = [];
  let ctxMiembros = [];
  let ctxColumnaId = null;      // primera columna del tablero (cargada en cargarContexto)
  let ctxFases = [];            // fases del proyecto
  let ctxEtapas = [];           // etapas de todas las fases
  let ctxUsuarioActual = null;  // perfil del usuario autenticado que usa el asistente

  async function cargarContexto() {
    try {
      const [proy, tareas] = await Promise.all([
        get("/proyectos/" + proyectoId),
        get(`/proyectos/${proyectoId}/tareas?limite=100`),
      ]);
      ctxProyecto = proy;

      // Normalizar tareas a array — el backend responde {datos:[...], pagina, ...}
      ctxTareas =
        tareas?.datos ||      // ← formato real del backend
        tareas?.tareas ||
        tareas?.items ||
        tareas?.data ||
        (Array.isArray(tareas) ? tareas : null) ||
        [];
      if (!Array.isArray(ctxTareas)) {
        const candidate =
          tareas?.datos ||
          tareas?.tareas ||
          tareas?.items ||
          tareas?.data ||
          tareas?.results ||
          null;
        if (Array.isArray(candidate)) ctxTareas = candidate;
        else ctxTareas = [];
      }

      // miembros es array de IDs — cargar objetos completos para poder buscar por nombre
      const miembroIds =
        proy.miembros || proy.integrantes || proy.members || [];
      if (miembroIds.length > 0) {
        try {
          const usersRes = await get(`/proyectos/${proyectoId}/miembros`);
          console.debug(
            "[Asistente] /miembros raw:",
            JSON.stringify(usersRes).slice(0, 500),
          );
          // Normalizar: puede ser array directo, o {miembros:[...]}, o [{usuario:{...},rol},...]
          const lista = Array.isArray(usersRes)
            ? usersRes
            : usersRes?.miembros || usersRes?.usuarios || usersRes?.items || [];
          // Cada elemento puede ser {usuario:{_id,nombre,...}, rol} o {_id, nombre, ...} directo
          ctxMiembros = lista
            .map((m) => m.usuario || m.user || m)
            .filter((m) => m && typeof m === "object" && (m._id || m.id));
          console.debug(
            "[Asistente] ctxMiembros resueltos:",
            ctxMiembros.map((m) => ({
              id: m._id || m.id,
              nombre: m.nombre || m.name || m.username || m.email,
            })),
          );
        } catch (e) {
          console.warn("[Asistente] Error cargando miembros:", e);
          ctxMiembros = miembroIds.map((id) => ({ _id: id, id }));
        }
      } else {
        ctxMiembros = [];
      }

      // Cargar columnaId una sola vez si no lo tenemos aún
      if (!ctxColumnaId) {
        try {
          // GET /proyectos/:id/tableros devuelve lista con columnas incluidas
          const tableros = await get(`/proyectos/${proyectoId}/tableros`);
          const lista =
            tableros?.tableros ||
            tableros?.items ||
            (Array.isArray(tableros) ? tableros : []);
          console.debug(
            "[Asistente] tableros:",
            lista.length,
            JSON.stringify(lista).slice(0, 300),
          );
          if (lista.length > 0) {
            const tablero = lista[0];
            // Las columnas vienen dentro del tablero directamente, sin segundo fetch
            const columnas = tablero?.columnas || tablero?.columns || [];
            ctxColumnaId = columnas[0]?._id || columnas[0]?.id || null;
            console.debug("[Asistente] columnaId cargado:", ctxColumnaId);
          }
        } catch (errTb) {
          console.warn("[Asistente] No se pudo cargar tablero:", errTb);
        }
      }

      // Cargar perfil del usuario autenticado
      try {
        const perfil = await get("/usuarios/perfil");
        ctxUsuarioActual = perfil || null;
        console.debug("[Asistente] usuario actual:", ctxUsuarioActual?.nombre, ctxUsuarioActual?.rol);
      } catch (_) {
        ctxUsuarioActual = null;
      }

      // Cargar fases y etapas del proyecto
      try {
        const fasesRes = await get(`/proyectos/${proyectoId}/fases`);
        ctxFases = Array.isArray(fasesRes) ? fasesRes : fasesRes?.fases || [];
        ctxEtapas = [];
        for (const fase of ctxFases) {
          try {
            const faseId = fase._id || fase.id;
            const etapasRes = await get(`/fases/${faseId}/etapas`);
            const etapas = Array.isArray(etapasRes) ? etapasRes : etapasRes?.etapas || [];
            etapas.forEach((e) => {
              if (!e.faseId) e.faseId = faseId;
            });
            ctxEtapas.push(...etapas);
          } catch (_) {}
        }
        console.debug("[Asistente] fases:", ctxFases.length, "etapas:", ctxEtapas.length);
      } catch (_) {
        ctxFases = [];
        ctxEtapas = [];
      }
    } catch (e) {
      console.error("[Asistente] Error cargando contexto:", e);
    }
  }

  await cargarContexto();

  /* ── Historial persistente (backend) ───────────────────────────── */
  async function saveMessage(role, text) {
    try {
      const form = new FormData();
      form.append("role", role);
      form.append("text", text);
      form.append("session_id", proyectoId || "default");
      // fire-and-forget; backend requires form data
      fetch(BASE + "/assistant/message", { method: "POST", body: form }).catch(
        () => {},
      );
    } catch (_) {}
  }

  async function cargarHistorial() {
    try {
      const res = await get(
        `/assistant/history?session_id=${proyectoId || "default"}&limit=200`,
      );
      const items = res?.history || [];
      console.debug("Asistente: historial recibido", items.length);
      // Renderizar historial y poblar array local
      historial.length = 0;
      for (const it of items) {
        const role = it.role || it.from || "user";
        const text = it.text || it.message || "";
        historial.push({
          role: role === "assistant" ? "assistant" : "user",
          content: text,
        });
        addMsg(role === "assistant" ? "bot" : "user", text);
      }
    } catch (e) {
      // ignore
    }
  }

  // historial se cargará después de inicializar la UI (ver más abajo)

  /* ── Construir resumen del proyecto para el prompt ─────────────── */
  function construirContexto() {
    if (!ctxProyecto) return "Sin contexto de proyecto disponible.";

    const tareasPendientes = ctxTareas.filter((t) =>
      ["TODO", "PENDIENTE", "BACKLOG"].includes((t.estado || "").toUpperCase()),
    );
    const tareasEnProgreso = ctxTareas.filter(
      (t) =>
        (t.estado || "").toUpperCase().includes("PROGRESO") ||
        (t.estado || "").toUpperCase().includes("IN_PROGRESS"),
    );
    const tareasListas = ctxTareas.filter((t) =>
      ["DONE", "COMPLETADO", "CERRADO"].includes(
        (t.estado || "").toUpperCase(),
      ),
    );
    const urgentes = ctxTareas.filter(
      (t) => (t.prioridad || "").toUpperCase() === "URGENTE",
    );
    const bugs = ctxTareas.filter(
      (t) => (t.tipo || "").toUpperCase() === "BUG",
    );

    const usuarioActualInfo = ctxUsuarioActual
      ? `${ctxUsuarioActual.nombre || ctxUsuarioActual.name || "?"} (${ctxUsuarioActual.rol || "?"}) — ID: ${ctxUsuarioActual.id || ctxUsuarioActual._id || "?"}`
      : "desconocido";

    const miembrosLista = ctxMiembros.length > 0
      ? ctxMiembros
          .map((m) => {
            const nombre = m.nombre || m.name || m.username || m.email || m._id || m.id;
            const rol = m.rol || "?";
            const esTu = ctxUsuarioActual && (m._id || m.id) === (ctxUsuarioActual.id || ctxUsuarioActual._id);
            return `${nombre} (${rol})${esTu ? " ← TÚ" : ""}`;
          })
          .join(", ")
      : "ninguno";

    const fasesEtapasTexto = ctxFases.length > 0
      ? ctxFases.map((f) => {
          const fId = f._id || f.id;
          const etapas = ctxEtapas.filter((e) => e.faseId === fId);
          const etapasTxt = etapas.length > 0
            ? etapas.map((e) => `    - Etapa: "${e.nombre}"`).join("\n")
            : "    (sin etapas)";
          return `  Fase: "${f.nombre}"\n${etapasTxt}`;
        }).join("\n")
      : "  (sin fases definidas)";

    return `
USUARIO ACTUAL (quien te está hablando): ${usuarioActualInfo}

PROYECTO: ${ctxProyecto.nombre || "Sin nombre"}
Descripción: ${ctxProyecto.descripcion || "Sin descripción"}
Estado: ${ctxProyecto.estado || "Activo"}
Fechas: ${ctxProyecto.fecha_inicio || "?"} → ${ctxProyecto.fecha_fin_estimada || "?"}
Miembros del proyecto (${ctxMiembros.length}): ${miembrosLista}

RESUMEN DE TAREAS (total: ${ctxTareas.length}):
- Pendientes: ${tareasPendientes.length}
- En progreso: ${tareasEnProgreso.length}
- Completadas: ${tareasListas.length}
- Urgentes: ${urgentes.length}
- Bugs abiertos: ${bugs.length}

TAREAS (para crear subtareas usa el título exacto o parcial):
${ctxTareas
  .slice(0, 15)
  .map(
    (t) =>
      `• [${t.tipo || "TASK"}] "${t.titulo}" — ${t.estado || "?"} — ${t.prioridad || "?"}` +
      (t.fechaVencimiento
        ? ` — Vence: ${t.fechaVencimiento.toString().split("T")[0]}`
        : ""),
  )
  .join("\n")}

ESTRUCTURA DE FASES Y ETAPAS:
${fasesEtapasTexto}
    `.trim();
  }

  /* ── Llamar a Claude via Anthropic API ─────────────────────────── */
  async function preguntarIA(mensajes) {
    const contexto = construirContexto();
    const systemPrompt = `Eres el asistente inteligente del proyecto "${ctxProyecto?.nombre || "TaskFlow"}".
Puedes responder preguntas sobre el proyecto Y ejecutar acciones reales sobre tareas y subtareas.

== ACCIONES (responde con texto natural + JSON al final) ==
CREAR TAREA: {"accion":"crear_tarea","titulo":"...","tipo":"TASK|BUG|FEATURE|IMPROVEMENT","prioridad":"BAJA|MEDIA|ALTA|URGENTE","descripcion":"...","fecha_vencimiento":"YYYY-MM-DD o null","asignado_a":"nombre exacto del miembro o null"}
ACTUALIZAR TAREA: {"accion":"actualizar_tarea","titulo_buscar":"nombre parcial de la tarea","cambios":{"estado":"TODO|IN_PROGRESS|DONE|BLOQUEADO","prioridad":"BAJA|MEDIA|ALTA|URGENTE","titulo":"...","descripcion":"...","responsables":["nombre del miembro"]}}
ELIMINAR TAREA: {"accion":"eliminar_tarea","titulo_buscar":"..."} — pide confirmación antes.
CREAR SUBTAREA DE TAREA: {"accion":"crear_subtarea","titulo":"...","tarea_buscar":"nombre parcial de la tarea padre","descripcion":"...","fecha_vencimiento":"YYYY-MM-DD o null","asignado_a":"nombre del miembro o null"}
CREAR SUBTAREA DE ETAPA: {"accion":"crear_subtarea_etapa","titulo":"...","etapa_buscar":"nombre parcial de la etapa","descripcion":"...","fecha_vencimiento":"YYYY-MM-DD o null","asignado_a":"nombre del miembro o null"}
DESHACER: {"accion":"deshacer"}

NOTAS IMPORTANTES:
- El CONTEXTO muestra quién es el usuario actual (quien te habla) con la etiqueta "← TÚ". Úsalo cuando digan "asígnalo a mí", "asígnalo a yo", o similar.
- Usa "asignado_a" con el nombre exacto del miembro tal como aparece en la lista de miembros del contexto (incluye el rol entre paréntesis para diferenciar si hay homónimos).
- Solo puedes asignar miembros que estén en la lista del proyecto. Si el nombre no coincide exactamente, deja "asignado_a": null y avisa.
- Las subtareas viven DENTRO de una tarea o etapa existente, no son tareas independientes.
- Para crear subtareas de una fase, usa crear_subtarea_etapa con el nombre de la etapa que pertenece a esa fase.
Responde siempre en español, conciso.

CONTEXTO ACTUAL DEL PROYECTO:
${contexto}`;

    // Enviar a través del proxy del backend para evitar CORS y proteger la API key
    const payload = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: mensajes,
    };

    const data = await post("/assistant/proxy_anthropic", payload).catch(
      (e) => {
        throw new Error(
          "Error al llamar al proxy del asistente: " + (e?.message || e),
        );
      },
    );

    if (!data) throw new Error("Respuesta vacía del proxy");
    if (data.error) throw new Error(JSON.stringify(data));
    // Detectar respuesta cortada por MAX_TOKENS (Gemini devuelve text vacío)
    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      throw new Error(
        "La respuesta fue cortada (MAX_TOKENS). El contexto del proyecto es demasiado largo.",
      );
    }

    // OpenAI ChatCompletion format
    if (
      data.choices &&
      Array.isArray(data.choices) &&
      data.choices[0]?.message?.content
    ) {
      return data.choices[0].message.content;
    }
    // Anthropic format (content array)
    if (data?.content && Array.isArray(data.content) && data.content[0]?.text) {
      return data.content[0].text;
    }
    // Fallbacks
    if (data?.completion) return data.completion;
    if (data?.message) return data.message;
    if (data?.text) return data.text;
    if (typeof data === "string") return data;
    return "Sin respuesta.";
  }

  /* ── Notificar al tablero que recargue datos ────────────────────── */
  function notificarTablero() {
    window.dispatchEvent(
      new CustomEvent("taskflow:actualizar-tablero", { detail: { proyectoId } }),
    );
  }

  /* ── Helper: normalizar texto eliminando tildes para comparación ─ */
  function normalizar(str) {
    return (str || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  /* ── Helper: buscar miembro por nombre (tolera tildes y mayúsculas) */
  function buscarMiembro(nombreBuscar) {
    const q = normalizar(nombreBuscar);
    if (!q) return null;

    // Caso especial: pronombres de primera persona → usuario actual (solo si es miembro del proyecto)
    const primeraPersona = ["yo", "mi", "me", "yo mismo", "myself", "a mi", "a mí"];
    if (primeraPersona.includes(q) && ctxUsuarioActual) {
      const uid = ctxUsuarioActual.id || ctxUsuarioActual._id;
      const enProyecto = ctxMiembros.find((m) => (m._id || m.id) === uid);
      return enProyecto || null; // Solo si es miembro del proyecto
    }

    return (
      ctxMiembros.find((m) => {
        const nombre = normalizar(
          m.nombre || m.name || m.username || m.email || "",
        );
        return nombre.includes(q) || q.includes(nombre);
      }) || null
    );
  }

  /* ── Helper: buscar tarea por nombre parcial ──────────────────── */
  function buscarTarea(titulo_buscar) {
    const q = normalizar(titulo_buscar);
    return (
      ctxTareas.find(
        (t) => t && t.titulo && normalizar(t.titulo).includes(q),
      ) || null
    );
  }

  /* ── Helper: buscar etapa por nombre parcial ─────────────────── */
  function buscarEtapa(nombre_buscar) {
    const q = normalizar(nombre_buscar);
    return (
      ctxEtapas.find(
        (e) => e && e.nombre && normalizar(e.nombre).includes(q),
      ) || null
    );
  }

  /* ── Detectar y ejecutar acciones ──────────────────────────────── */
  async function ejecutarAccion(texto) {
    // Buscar el último bloque JSON con "accion" en la respuesta.
    // La regex maneja objetos anidados a 1 nivel (ej: cambios:{...}) usando
    // (?:[^{}]|\{[^{}]*\})* que alterna caracteres normales con bloques {}.
    const textoNorm = texto.replace(/```[a-z]*\s*/g, "").replace(/```/g, "");
    const REGEX_JSON = /\{(?:[^{}]|\{[^{}]*\})*\}/g;
    const matches = [...textoNorm.matchAll(REGEX_JSON)].filter((m) =>
      m[0].includes('"accion"'),
    );
    if (!matches.length) return null;

    let accion;
    try {
      accion = JSON.parse(matches[matches.length - 1][0]);
    } catch (_) {
      return null;
    }

    // ── CREAR TAREA ───────────────────────────────────────────────────────
    if (accion.accion === "crear_tarea") {
      try {
        // Usar columnaId ya cargado al iniciar; si aún no está, intentar cargarlo ahora
        if (!ctxColumnaId) await cargarContexto();
        const columnaId = ctxColumnaId;
        if (!columnaId)
          return "⚠️ No se pudo obtener la columna del tablero. Verifica que el proyecto tenga un tablero con columnas creadas.";

        // Resolver nombre → ID del responsable
        const responsables = [];
        let nombreResuelto = null;
        if (accion.asignado_a) {
          const miembro = buscarMiembro(accion.asignado_a);
          if (miembro) {
            responsables.push(miembro._id || miembro.id);
            nombreResuelto =
              miembro.nombre || miembro.name || accion.asignado_a;
          }
        }

        const payload = {
          titulo: accion.titulo,
          tipo: accion.tipo || "TASK",
          prioridad: accion.prioridad || "MEDIA",
          descripcion: accion.descripcion || "",
          proyectoId: proyectoId,
          columnaId: columnaId,
          responsables: responsables,
          etiquetas: [],
          ...(accion.fecha_vencimiento
            ? { fechaVencimiento: accion.fecha_vencimiento }
            : {}),
        };
        const nueva = await post("/tareas", payload);
        const nuevaId = nueva?.id || nueva?._id;

        // Si hay responsable y la creación no lo incluyó, asignarlo via endpoint dedicado
        if (responsables.length > 0 && nuevaId) {
          try {
            await fetch(BASE + "/tareas/" + nuevaId + "/responsables", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify({ responsables }),
            });
          } catch (_) {}
        }

        lastAction = { accion: "deshacer_creacion", tareaId: nuevaId };
        await cargarContexto();
        notificarTablero();
        const miembrosDisponibles = ctxMiembros
          .map((m) => m.nombre || m.name || m.username || m.email)
          .filter(Boolean)
          .join(", ");
        const extras = [
          accion.fecha_vencimiento ? `vence ${accion.fecha_vencimiento}` : null,
          nombreResuelto
            ? `asignada a ${nombreResuelto}`
            : accion.asignado_a
            ? `⚠️ no se encontró el miembro "${accion.asignado_a}" (disponibles: ${miembrosDisponibles || "ninguno"})`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return `✅ Tarea creada: "${accion.titulo}" (${accion.tipo} · ${accion.prioridad})${extras ? " — " + extras : ""}`;
      } catch (_) {
        return "⚠️ No pude crear la tarea. Verifica que tengas permisos.";
      }
    }

    // ── ACTUALIZAR TAREA ─────────────────────────────────────────────────
    if (accion.accion === "actualizar_tarea") {
      const tarea = buscarTarea(accion.titulo_buscar);
      if (!tarea)
        return `⚠️ No encontré ninguna tarea que coincida con "${accion.titulo_buscar}".`;

      // Soporta {cambios:{...}} (nuevo) y {campo, valor} (compatibilidad vieja)
      const cambios =
        accion.cambios ||
        (accion.campo ? { [accion.campo]: accion.valor } : null);
      if (!cambios || !Object.keys(cambios).length)
        return "⚠️ No se especificaron cambios para la tarea.";

      // Mapear claves snake_case → camelCase que espera el backend
      const KEY_MAP = {
        estado: "estado", // no existe en ActualizarTarea pero lo filtramos abajo
        prioridad: "prioridad",
        titulo: "titulo",
        descripcion: "descripcion",
        fecha_vencimiento: "fechaVencimiento",
        fechaVencimiento: "fechaVencimiento",
        horas_estimadas: "horasEstimadas",
        horasEstimadas: "horasEstimadas",
        fase_id: "faseId",
        faseId: "faseId",
        etapa_id: "etapaId",
        etapaId: "etapaId",
        responsables: "responsables",
        etiquetas: "etiquetas",
      };
      // Campos que ActualizarTarea NO acepta (estado se maneja via mover columna o campo directo en DB)
      // El backend sí acepta estado en $set, así que lo pasamos tal cual
      const cambiosMapeados = {};
      for (const [k, v] of Object.entries(cambios)) {
        const keyCamel = KEY_MAP[k] || k;
        cambiosMapeados[keyCamel] = v;
      }

      // Guardar estado anterior (usando claves camelCase para poder restaurar)
      const camposAnteriores = {};
      for (const campo of Object.keys(cambiosMapeados)) {
        camposAnteriores[campo] = tarea[campo] ?? null;
      }
      lastAction = {
        accion: "deshacer_actualizacion",
        tareaId: tarea._id || tarea.id,
        camposAnteriores,
      };

      try {
        // Separar responsables (endpoint propio) del resto de campos
        const { responsables: respIds, ...camposSinResp } = cambiosMapeados;

        // Actualizar campos normales si hay algo más allá de responsables
        if (Object.keys(camposSinResp).length > 0) {
          await fetch(BASE + "/tareas/" + (tarea._id || tarea.id), {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify(camposSinResp),
          });
        }

        // Asignar responsables via endpoint dedicado si vienen en los cambios
        let advertenciaResp = null;
        if (respIds !== undefined) {
          const idsResueltos = Array.isArray(respIds)
            ? respIds
                .map((r) => {
                  if (typeof r === "string" && (r.length === 36 || r.length === 24)) return r;
                  const m = buscarMiembro(r);
                  if (!m) advertenciaResp = r; // guardamos el nombre que no se encontró
                  return m ? m._id || m.id : null;
                })
                .filter(Boolean)
            : [];

          if (idsResueltos.length > 0) {
            const respResp = await fetch(
              BASE + "/tareas/" + (tarea._id || tarea.id) + "/responsables",
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + token,
                },
                body: JSON.stringify({ responsables: idsResueltos }),
              },
            );
            if (!respResp.ok) {
              const errBody = await respResp.json().catch(() => ({}));
              return `⚠️ No se pudo asignar el responsable (${respResp.status}): ${errBody.detail || "error desconocido"}`;
            }
          }
        }

        await cargarContexto();
        notificarTablero();
        const miembrosDisponibles = ctxMiembros
          .map((m) => m.nombre || m.name || m.username || m.email)
          .filter(Boolean)
          .join(", ");
        const resumen = Object.entries(cambiosMapeados)
          .filter(([k]) => k !== "responsables")
          .map(([k, v]) => `${k} → ${v}`)
          .join(", ");
        if (advertenciaResp) {
          return `⚠️ No se encontró el miembro "${advertenciaResp}". Miembros disponibles: ${miembrosDisponibles || "ninguno"}. Los demás cambios sí se aplicaron${resumen ? ": " + resumen : ""}.`;
        }
        const respNombres = Array.isArray(cambiosMapeados.responsables)
          ? cambiosMapeados.responsables
              .map((r) => {
                const m = buscarMiembro(r);
                return m ? m.nombre || m.name || r : r;
              })
              .join(", ")
          : null;
        const partes = [
          resumen || null,
          respNombres ? `responsable(s) → ${respNombres}` : null,
        ].filter(Boolean).join(", ");
        return `✅ Tarea "${tarea.titulo}" actualizada${partes ? ": " + partes : ""}.`;
      } catch (_) {
        return "⚠️ No pude actualizar la tarea.";
      }
    }

    // ── ELIMINAR TAREA ───────────────────────────────────────────────────
    if (accion.accion === "eliminar_tarea") {
      const tarea = buscarTarea(accion.titulo_buscar);
      if (!tarea)
        return `⚠️ No encontré ninguna tarea que coincida con "${accion.titulo_buscar}".`;

      // Guardar todos los datos para poder restaurar si se deshace
      lastAction = { accion: "deshacer_eliminacion", tareaData: { ...tarea } };
      const tareaRealId = tarea._id || tarea.id;

      try {
        await fetch(BASE + "/tareas/" + tareaRealId, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + token },
        });
        await cargarContexto();
        return `✅ Tarea "${tarea.titulo}" eliminada correctamente.`;
      } catch (_) {
        return "⚠️ No pude eliminar la tarea. Verifica que tengas permisos.";
      }
    }

    // ── CREAR SUBTAREA DE TAREA ──────────────────────────────────────────
    if (accion.accion === "crear_subtarea") {
      const tarea = buscarTarea(accion.tarea_buscar);
      if (!tarea)
        return `⚠️ No encontré ninguna tarea que coincida con "${accion.tarea_buscar}".`;

      const responsables = [];
      let nombreResuelto = null;
      if (accion.asignado_a) {
        const miembro = buscarMiembro(accion.asignado_a);
        if (miembro) {
          responsables.push(miembro._id || miembro.id);
          nombreResuelto = miembro.nombre || miembro.name || accion.asignado_a;
        }
      }

      try {
        const payload = {
          titulo: accion.titulo,
          descripcion: accion.descripcion || "",
          responsables,
          ...(accion.fecha_vencimiento
            ? { fechaVencimiento: accion.fecha_vencimiento }
            : {}),
        };
        const subtarea = await post(
          `/tareas/${tarea._id || tarea.id}/subtareas`,
          payload,
        );
        lastAction = {
          accion: "deshacer_creacion_subtarea",
          subtareaId: subtarea.id || subtarea._id,
        };
        const extras = [
          accion.fecha_vencimiento ? `vence ${accion.fecha_vencimiento}` : null,
          nombreResuelto ? `asignada a ${nombreResuelto}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return `✅ Subtarea creada: "${accion.titulo}" en la tarea "${tarea.titulo}"${extras ? " — " + extras : ""}`;
      } catch (_) {
        return "⚠️ No pude crear la subtarea. Verifica que tengas permisos.";
      }
    }

    // ── CREAR SUBTAREA DE ETAPA ──────────────────────────────────────────
    if (accion.accion === "crear_subtarea_etapa") {
      const etapa = buscarEtapa(accion.etapa_buscar);
      if (!etapa)
        return `⚠️ No encontré ninguna etapa que coincida con "${accion.etapa_buscar}". Las etapas disponibles son: ${ctxEtapas.map((e) => `"${e.nombre}"`).join(", ") || "ninguna"}`;

      const responsables = [];
      let nombreResuelto = null;
      if (accion.asignado_a) {
        const miembro = buscarMiembro(accion.asignado_a);
        if (miembro) {
          responsables.push(miembro._id || miembro.id);
          nombreResuelto = miembro.nombre || miembro.name || accion.asignado_a;
        }
      }

      try {
        const payload = {
          titulo: accion.titulo,
          descripcion: accion.descripcion || "",
          responsables,
          ...(accion.fecha_vencimiento
            ? { fechaVencimiento: accion.fecha_vencimiento }
            : {}),
        };
        const subtarea = await post(
          `/etapas/${etapa._id || etapa.id}/subtareas`,
          payload,
        );
        lastAction = {
          accion: "deshacer_creacion_subtarea",
          subtareaId: subtarea.id || subtarea._id,
        };
        const extras = [
          accion.fecha_vencimiento ? `vence ${accion.fecha_vencimiento}` : null,
          nombreResuelto ? `asignada a ${nombreResuelto}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return `✅ Subtarea creada: "${accion.titulo}" en la etapa "${etapa.nombre}"${extras ? " — " + extras : ""}`;
      } catch (_) {
        return "⚠️ No pude crear la subtarea en la etapa. Verifica que tengas permisos.";
      }
    }

    // ── DESHACER ─────────────────────────────────────────────────────────
    if (accion.accion === "deshacer") {
      if (!lastAction)
        return "⚠️ No hay ninguna acción reciente que pueda deshacer.";

      const la = lastAction;
      lastAction = null;

      try {
        if (la.accion === "deshacer_creacion") {
          if (!la.tareaId)
            return "⚠️ No tengo el ID de la tarea creada para eliminarla.";
          await fetch(BASE + "/tareas/" + la.tareaId, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
          });
          await cargarContexto();
          return "↩️ Acción deshecha: la tarea recién creada fue eliminada.";
        }

        if (la.accion === "deshacer_creacion_subtarea") {
          if (!la.subtareaId)
            return "⚠️ No tengo el ID de la subtarea creada para eliminarla.";
          await fetch(BASE + "/subtareas/" + la.subtareaId, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
          });
          return "↩️ Acción deshecha: la subtarea recién creada fue eliminada.";
        }

        if (la.accion === "deshacer_actualizacion") {
          await fetch(BASE + "/tareas/" + la.tareaId, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify(la.camposAnteriores),
          });
          await cargarContexto();
          return "↩️ Acción deshecha: la tarea fue restaurada a su estado anterior.";
        }

        if (la.accion === "deshacer_eliminacion") {
          const {
            _id,
            id,
            estaVencida,
            subtareas,
            horasRegistradas,
            perfilVisual,
            creadoEn,
            ...datos
          } = la.tareaData;
          // Asegurar que los campos requeridos tengan camelCase correcto
          await post("/tareas", {
            ...datos,
            proyectoId: datos.proyectoId || proyectoId,
            columnaId: datos.columnaId,
            responsables: datos.responsables || [],
            etiquetas: datos.etiquetas || [],
          });
          await cargarContexto();
          return `↩️ Acción deshecha: la tarea "${la.tareaData.titulo}" fue restaurada.`;
        }
      } catch (_) {
        return "⚠️ No pude deshacer la acción.";
      }
    }

    return null;
  }

  /* ── Sugerencias rápidas ────────────────────────────────────────── */
  const SUGERENCIAS = [
    "¿Cómo va el proyecto?",
    "¿Qué tareas están urgentes?",
    "Crea una subtarea de pruebas unitarias en la tarea de login",
    "Crea una tarea de revisión de código y asígnala a Juan",
    "Asigna la tarea de diseño al primer miembro del equipo",
    "Muéstrame las tareas en progreso",
  ];

  /* ── Estado de la conversación ──────────────────────────────────── */
  const historial = []; // [{role, content}]
  let lastAction = null; // { accion, tareaId, camposAnteriores } — para deshacer
  let pendingAction = null; // acción pendiente de confirmación del usuario

  /* ── HTML del asistente ─────────────────────────────────────────── */
  contenedor.innerHTML = `
    <div class="ap-root">
      <div class="ap-sidebar">
        <div class="ap-sidebar-header">
          <div class="ap-ai-badge">
            <i class="ph ph-sparkle"></i>
            <span>IA</span>
          </div>
          <div class="ap-sidebar-info">
            <div class="ap-sidebar-titulo">Asistente</div>
            <div class="ap-sidebar-sub" id="ap-proyecto-nombre">Cargando…</div>
          </div>
        </div>

        <div class="ap-stats" id="ap-stats">
          <div class="ap-stat-card">
            <span class="ap-stat-num" id="ap-stat-total">—</span>
            <span class="ap-stat-lbl">Tareas</span>
          </div>
          <div class="ap-stat-card">
            <span class="ap-stat-num ap-urgente" id="ap-stat-urgentes">—</span>
            <span class="ap-stat-lbl">Urgentes</span>
          </div>
          <div class="ap-stat-card">
            <span class="ap-stat-num ap-ok" id="ap-stat-listas">—</span>
            <span class="ap-stat-lbl">Listas</span>
          </div>
          <div class="ap-stat-card">
            <span class="ap-stat-num ap-bug" id="ap-stat-bugs">—</span>
            <span class="ap-stat-lbl">Bugs</span>
          </div>
        </div>

        <div class="ap-sugerencias-titulo">Preguntas rápidas</div>
        <div class="ap-sugerencias" id="ap-sugerencias"></div>

        <button class="ap-btn-refrescar" id="ap-btn-refrescar">
          <i class="ph ph-arrow-clockwise"></i> Actualizar contexto
        </button>
      </div>

      <div class="ap-chat">
        <div class="ap-chat-msgs" id="ap-msgs">
          <div class="ap-bienvenida" id="ap-bienvenida">
            <div class="ap-bienvenida-ico"><i class="ph ph-robot"></i></div>
            <div class="ap-bienvenida-txt">
              Hola, soy tu asistente de proyecto.<br>
              Puedo ayudarte a revisar el estado, responder preguntas<br>
              y crear o actualizar tareas con lenguaje natural.
            </div>
          </div>
        </div>

        <div class="ap-input-wrap">
          <textarea
            class="ap-input"
            id="ap-input"
            placeholder="Pregunta algo sobre el proyecto…"
            rows="1"
          ></textarea>
          <button class="ap-btn-send" id="ap-btn-send" title="Enviar">
            <i class="ph ph-paper-plane-right"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  /* ── CSS ────────────────────────────────────────────────────────── */
  if (!document.getElementById("ap-styles")) {
    const s = document.createElement("style");
    s.id = "ap-styles";
    s.textContent = `
      .ap-root {
        display: flex; height: calc(100vh - 130px); min-height: 500px;
        background: var(--bg, #111318);
        border-radius: var(--r, 10px);
        border: 1px solid var(--b1, rgba(255,255,255,.07));
        overflow: hidden; font-family: 'DM Sans', sans-serif;
      }

      /* ── Sidebar ── */
      .ap-sidebar {
        width: 230px; flex-shrink: 0;
        background: var(--s1, rgba(255,255,255,.03));
        border-right: 1px solid var(--b1, rgba(255,255,255,.07));
        display: flex; flex-direction: column;
        padding: 18px 14px; gap: 16px; overflow-y: auto;
      }
      .ap-sidebar-header { display: flex; align-items: center; gap: 10px; }
      .ap-ai-badge {
        width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
        background: var(--a, #5b52e8);
        display: flex; align-items: center; justify-content: center;
        gap: 2px; font-size: 11px; font-weight: 700; color: #fff;
      }
      .ap-ai-badge i { font-size: 18px; }
      .ap-sidebar-titulo { font-size: 13px; font-weight: 600; color: var(--t1, #e4e6f0); }
      .ap-sidebar-sub { font-size: 11px; color: var(--t3, #7b82a0); margin-top: 1px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }

      .ap-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
      .ap-stat-card {
        background: var(--s2, rgba(255,255,255,.05));
        border: 1px solid var(--b1, rgba(255,255,255,.07));
        border-radius: 8px; padding: 10px 8px;
        display: flex; flex-direction: column; align-items: center; gap: 3px;
      }
      .ap-stat-num { font-size: 20px; font-weight: 700; color: var(--t1, #e4e6f0); line-height: 1; }
      .ap-stat-num.ap-urgente { color: #f87171; }
      .ap-stat-num.ap-ok      { color: #4ade80; }
      .ap-stat-num.ap-bug     { color: #fbbf24; }
      .ap-stat-lbl { font-size: 10px; color: var(--t3, #7b82a0); }

      .ap-sugerencias-titulo {
        font-size: 10px; font-weight: 600; letter-spacing: .07em;
        text-transform: uppercase; color: var(--t3, #7b82a0);
      }
      .ap-sugerencias { display: flex; flex-direction: column; gap: 5px; }
      .ap-sug-btn {
        text-align: left; background: none; cursor: pointer;
        border: 1px solid var(--b1, rgba(255,255,255,.07));
        border-radius: 8px; padding: 8px 10px;
        font-size: 11px; color: var(--t2, #adb3cc);
        font-family: 'DM Sans', sans-serif;
        transition: background .15s, color .15s, border-color .15s;
        line-height: 1.4;
      }
      .ap-sug-btn:hover {
        background: rgba(91,82,232,.12);
        color: var(--t1, #e4e6f0);
        border-color: rgba(91,82,232,.3);
      }

      .ap-btn-refrescar {
        margin-top: auto; background: none;
        border: 1px solid var(--b1, rgba(255,255,255,.07));
        border-radius: 8px; padding: 8px 10px;
        font-size: 11px; color: var(--t3, #7b82a0);
        font-family: 'DM Sans', sans-serif; cursor: pointer;
        display: flex; align-items: center; gap: 6px;
        transition: color .15s, border-color .15s;
      }
      .ap-btn-refrescar:hover { color: var(--t1, #e4e6f0); border-color: var(--b2, rgba(255,255,255,.15)); }
      .ap-btn-refrescar i { font-size: 14px; }

      /* ── Chat ── */
      .ap-chat {
        flex: 1; display: flex; flex-direction: column; overflow: hidden;
      }
      .ap-chat-msgs {
        flex: 1; overflow-y: auto; padding: 20px 20px 12px;
        display: flex; flex-direction: column; gap: 14px;
        scroll-behavior: smooth;
      }
      .ap-chat-msgs::-webkit-scrollbar { width: 3px; }
      .ap-chat-msgs::-webkit-scrollbar-track { background: transparent; }
      .ap-chat-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 4px; }

      /* Bienvenida */
      .ap-bienvenida {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 14px; padding: 40px 20px;
        text-align: center; color: var(--t3, #7b82a0);
        animation: ap-fade-in .4s ease;
      }
      .ap-bienvenida-ico {
        width: 56px; height: 56px; border-radius: 16px;
        background: rgba(91,82,232,.15); border: 1px solid rgba(91,82,232,.25);
        display: flex; align-items: center; justify-content: center;
      }
      .ap-bienvenida-ico i { font-size: 28px; color: var(--a, #8b83ff); }
      .ap-bienvenida-txt { font-size: 13px; line-height: 1.7; }

      /* Mensajes */
      .ap-msg { display: flex; flex-direction: column; max-width: 82%; gap: 4px;
        animation: ap-msg-in .2s ease; }
      .ap-msg.user { align-self: flex-end; align-items: flex-end; }
      .ap-msg.bot  { align-self: flex-start; align-items: flex-start; }

      @keyframes ap-msg-in {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes ap-fade-in {
        from { opacity: 0; } to { opacity: 1; }
      }

      .ap-burbuja {
        padding: 10px 14px; border-radius: 14px;
        font-size: 13px; line-height: 1.6; word-break: break-word;
        white-space: pre-wrap;
      }
      .ap-msg.user .ap-burbuja {
        background: var(--a, #5b52e8); color: #fff;
        border-bottom-right-radius: 4px;
      }
      .ap-msg.bot .ap-burbuja {
        background: var(--s2, rgba(255,255,255,.06));
        color: var(--t1, #e4e6f0);
        border: 1px solid var(--b1, rgba(255,255,255,.07));
        border-bottom-left-radius: 4px;
      }
      .ap-msg.bot .ap-burbuja.accion {
        border-color: rgba(74,222,128,.25);
        background: rgba(74,222,128,.07);
        color: #4ade80;
      }
      /* Estilos Markdown dentro de burbujas del bot */
      .ap-msg.bot .ap-burbuja p { margin: 0 0 6px 0; }
      .ap-msg.bot .ap-burbuja p:last-child { margin-bottom: 0; }
      .ap-msg.bot .ap-burbuja strong { font-weight: 600; color: var(--t1, #e4e6f0); }
      .ap-msg.bot .ap-burbuja em { font-style: italic; opacity: 0.85; }
      .ap-msg.bot .ap-burbuja ul { margin: 4px 0 4px 16px; padding: 0; }
      .ap-msg.bot .ap-burbuja li { margin-bottom: 3px; }
      .ap-msg.bot .ap-burbuja code {
        background: rgba(255,255,255,.1); border-radius: 4px;
        padding: 1px 5px; font-family: monospace; font-size: 12px;
      }
      .ap-msg.bot .ap-burbuja pre {
        background: rgba(0,0,0,.3); border-radius: 8px;
        padding: 10px 12px; overflow-x: auto; margin: 6px 0;
      }
      .ap-msg.bot .ap-burbuja pre code {
        background: none; padding: 0; font-size: 12px;
      }
      .ap-hora { font-size: 10px; color: var(--t3, #7b82a0); padding: 0 3px; }

      /* Typing */
      .ap-typing {
        display: flex; gap: 4px; align-items: center; padding: 10px 14px;
        background: var(--s2, rgba(255,255,255,.06));
        border: 1px solid var(--b1, rgba(255,255,255,.07));
        border-radius: 14px; border-bottom-left-radius: 4px;
        width: fit-content;
      }
      .ap-typing span {
        width: 5px; height: 5px; border-radius: 50%;
        background: var(--t3, #7b82a0); animation: ap-dot 1.1s infinite;
      }
      .ap-typing span:nth-child(2) { animation-delay: .18s; }
      .ap-typing span:nth-child(3) { animation-delay: .36s; }
      @keyframes ap-dot {
        0%,60%,100% { transform: translateY(0); opacity: .4; }
        30% { transform: translateY(-5px); opacity: 1; }
      }

      /* Input */
      .ap-input-wrap {
        display: flex; align-items: flex-end; gap: 8px;
        padding: 12px 16px 16px;
        border-top: 1px solid var(--b1, rgba(255,255,255,.07));
        background: var(--s1, rgba(255,255,255,.03));
      }
      .ap-input {
        flex: 1; background: var(--s2, rgba(255,255,255,.06));
        border: 1px solid var(--b1, rgba(255,255,255,.07));
        border-radius: 12px; padding: 10px 14px;
        font-size: 13px; font-family: 'DM Sans', sans-serif;
        color: var(--t1, #e4e6f0); resize: none;
        min-height: 42px; max-height: 100px; outline: none; line-height: 1.5;
        transition: border-color .15s;
      }
      .ap-input:focus { border-color: rgba(91,82,232,.45); }
      .ap-input::placeholder { color: var(--t3, #7b82a0); }
      .ap-btn-send {
        width: 42px; height: 42px; border-radius: 12px; border: none; flex-shrink: 0;
        background: var(--a, #5b52e8); color: #fff; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 3px 14px rgba(91,82,232,.35);
        transition: filter .15s, transform .1s;
      }
      .ap-btn-send:hover { filter: brightness(1.15); }
      .ap-btn-send:active { transform: scale(.95); }
      .ap-btn-send:disabled { background: var(--s2, #2a2f45); box-shadow: none; cursor: not-allowed; filter: none; }
      .ap-btn-send i { font-size: 18px; }
    `;
    document.head.appendChild(s);
  }

  /* ── Referencias DOM ────────────────────────────────────────────── */
  const msgsEl = document.getElementById("ap-msgs");
  const inputEl = document.getElementById("ap-input");
  const sendBtn = document.getElementById("ap-btn-send");
  const bienvenida = document.getElementById("ap-bienvenida");
  const sugsEl = document.getElementById("ap-sugerencias");
  const refrescarBtn = document.getElementById("ap-btn-refrescar");

  /* ── Poblar stats del sidebar ───────────────────────────────────── */
  function actualizarStats() {
    const nombre = document.getElementById("ap-proyecto-nombre");
    if (nombre && ctxProyecto) nombre.textContent = ctxProyecto.nombre || "—";

    const urgentes = ctxTareas.filter(
      (t) => (t.prioridad || "").toUpperCase() === "URGENTE",
    ).length;
    const listas = ctxTareas.filter((t) =>
      ["DONE", "COMPLETADO", "CERRADO"].includes(
        (t.estado || "").toUpperCase(),
      ),
    ).length;
    const bugs = ctxTareas.filter(
      (t) => (t.tipo || "").toUpperCase() === "BUG",
    ).length;

    const el = (id) => document.getElementById(id);
    if (el("ap-stat-total")) el("ap-stat-total").textContent = ctxTareas.length;
    if (el("ap-stat-urgentes")) el("ap-stat-urgentes").textContent = urgentes;
    if (el("ap-stat-listas")) el("ap-stat-listas").textContent = listas;
    if (el("ap-stat-bugs")) el("ap-stat-bugs").textContent = bugs;
  }
  actualizarStats();

  /* ── Sugerencias ────────────────────────────────────────────────── */
  SUGERENCIAS.forEach((txt) => {
    const btn = document.createElement("button");
    btn.className = "ap-sug-btn";
    btn.textContent = txt;
    btn.addEventListener("click", () => {
      inputEl.value = txt;
      enviar();
    });
    sugsEl.appendChild(btn);
  });

  /* ── Helpers UI ─────────────────────────────────────────────────── */
  function ahora() {
    return new Date().toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* Convierte Markdown básico a HTML seguro */
  function mdToHtml(texto) {
    if (!texto) return "";
    // Normalizar a string y retornos de carro
    let t = String(texto).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // Escapar HTML primero para evitar XSS
    t = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Bloques de código ```...```
    t = t.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    // Código inline `...`
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Negritas **texto** o __texto__
    t = t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/__(.*?)__/g, "<strong>$1</strong>");
    // Cursivas *texto* o _texto_
    t = t.replace(/\*(.*?)\*/g, "<em>$1</em>");
    t = t.replace(/_(.*?)_/g, "<em>$1</em>");

    // Listas: convertir líneas en <li>
    t = t.replace(/^\s*[\-\•]\s+(.+)$/gm, "<li>$1</li>");
    t = t.replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>");
    // Agrupar <li> consecutivos en un solo <ul>
    t = t.replace(/(?:<li>[\s\S]*?<\/li>\s*)+/g, function (block) {
      return "<ul>" + block.trim() + "</ul>";
    });

    // Saltos de línea dobles → párrafo, simples → <br>
    t = t.replace(/\n\n+/g, "</p><p>");
    t = t.replace(/\n/g, "<br>");

    t = "<p>" + t + "</p>";
    // Limpiar párrafos vacíos
    t = t.replace(/<p><\/p>/g, "");
    // Sacar uls/pre que hayan quedado dentro de p
    t = t.replace(/<p>(<ul>[\s\S]*?<\/ul>)<\/p>/g, "$1");
    t = t.replace(/<p>(<pre>[\s\S]*?<\/pre>)<\/p>/g, "$1");
    return t;
  }

  function addMsg(rol, texto, esAccion = false) {
    if (bienvenida) bienvenida.remove();
    const wrap = document.createElement("div");
    wrap.className = "ap-msg " + (rol === "user" ? "user" : "bot");
    const bub = document.createElement("div");
    bub.className = "ap-burbuja" + (esAccion ? " accion" : "");
    // Los mensajes del bot se renderizan como HTML (con Markdown convertido)
    // Los del usuario se muestran como texto plano (seguro)
    if (rol === "bot" && !esAccion) {
      bub.innerHTML = mdToHtml(texto);
    } else {
      bub.textContent = texto;
    }
    const hora = document.createElement("div");
    hora.className = "ap-hora";
    hora.textContent = ahora();
    wrap.appendChild(bub);
    wrap.appendChild(hora);
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  // Cargar historial una vez que addMsg y msgsEl existen
  try {
    await cargarHistorial();
  } catch (e) {
    console.warn("No se pudo cargar historial del asistente:", e);
  }

  function addTyping() {
    const wrap = document.createElement("div");
    wrap.className = "ap-msg bot";
    wrap.id = "ap-typing-wrap";
    const t = document.createElement("div");
    t.className = "ap-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    wrap.appendChild(t);
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function removeTyping() {
    document.getElementById("ap-typing-wrap")?.remove();
  }

  /* ── Enviar mensaje ─────────────────────────────────────────────── */
  let cargando = false;

  async function enviar() {
    const q = inputEl.value.trim();
    if (!q || cargando) return;
    cargando = true;
    sendBtn.disabled = true;

    addMsg("user", q);
    historial.push({ role: "user", content: q });
    try {
      saveMessage("user", q);
    } catch (_) {}
    inputEl.value = "";
    inputEl.style.height = "auto";
    addTyping();

    try {
      const respTexto = await preguntarIA(historial);
      removeTyping();

      // Verificar si hay acción ejecutable
      const resultadoAccion = await ejecutarAccion(respTexto);

      if (resultadoAccion) {
        // Mostrar mensaje limpio (sin el JSON técnico).
        // Usa la misma regex que en ejecutarAccion para manejar objetos anidados.
        const REGEX_JSON_ACCION = /\{(?:[^{}]|\{[^{}]*\})*\}/g;
        const textoLimpio = respTexto
          // Quitar bloques ```...``` que contengan JSON con "accion"
          .replace(/```[a-z]*\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*```/g, (m) =>
            m.includes('"accion"') ? "" : m,
          )
          // Quitar JSON suelto con "accion"
          .replace(REGEX_JSON_ACCION, (m) => (m.includes('"accion"') ? "" : m))
          // Limpiar fences vacíos que queden
          .replace(/```[a-z]*\s*```/g, "")
          .trim();
        if (textoLimpio) {
          addMsg("bot", textoLimpio);
          try {
            saveMessage("assistant", textoLimpio);
          } catch (_) {}
        }
        addMsg("bot", resultadoAccion, true);
        try {
          saveMessage("assistant", resultadoAccion);
        } catch (_) {}
        actualizarStats();
      } else {
        addMsg("bot", respTexto);
        try {
          saveMessage("assistant", respTexto);
        } catch (_) {}
      }

      historial.push({ role: "assistant", content: respTexto });

      // Limitar historial a últimos 20 mensajes
      if (historial.length > 20) historial.splice(0, historial.length - 20);
    } catch (e) {
      removeTyping();
      addMsg("bot", "⚠️ Error al conectar con el asistente: " + e.message);
    }

    cargando = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  sendBtn.addEventListener("click", enviar);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  });
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + "px";
  });

  /* ── Refrescar contexto ─────────────────────────────────────────── */
  refrescarBtn.addEventListener("click", async () => {
    refrescarBtn.disabled = true;
    refrescarBtn.innerHTML =
      '<i class="ph ph-circle-notch" style="animation:spin 1s linear infinite"></i> Actualizando…';
    if (!document.getElementById("ap-spin-style")) {
      const ss = document.createElement("style");
      ss.id = "ap-spin-style";
      ss.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
      document.head.appendChild(ss);
    }
    await cargarContexto();
    actualizarStats();
    addMsg(
      "bot",
      "🔄 Contexto actualizado. Ahora tengo la información más reciente del proyecto.",
    );
    refrescarBtn.disabled = false;
    refrescarBtn.innerHTML =
      '<i class="ph ph-arrow-clockwise"></i> Actualizar contexto';
  });
};
