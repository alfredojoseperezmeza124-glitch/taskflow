/* TaskFlow loader.js */
const PAGINAS_HTML = {
  login: `<div class="login-overlay" id="loginOverlay">

  <!-- Fondo con gradiente y elementos decorativos estilo NomiWise -->
  <div class="login-bg">
    <div class="login-bg-orb login-bg-orb1"></div>
    <div class="login-bg-orb login-bg-orb2"></div>
    <div class="login-bg-orb login-bg-orb3"></div>
    <div class="login-bg-grid"></div>
  </div>

  <!-- Contenedor principal horizontal -->
  <div class="login-card">

    <!-- Panel izquierdo — branding + ilustración -->
    <div class="login-left">
      <div class="login-logo-row">
        <div class="login-logo-icon">
          <i class="ph ph-kanban"></i>
        </div>
        <span class="login-logo-text">TaskFlow</span>
      </div>

      <div class="login-hero">
        <div class="login-hero-title">Gestión ágil para<br>equipos que <span class="login-hero-accent">entregan</span></div>
        <div class="login-hero-desc">Organiza proyectos, asigna tareas y mantén el control con tableros Kanban en tiempo real.</div>
      </div>

      <!-- Stats decorativas -->
      <div class="login-stats">
        <div class="login-stat">
          <div class="login-stat-num" id="loginPatronesCount">—</div>
          <div class="login-stat-label">Tecnologías</div>
        </div>
        <div class="login-stat-sep"></div>
        <div class="login-stat">
          <div class="login-stat-num">3</div>
          <div class="login-stat-label">Roles de usuario</div>
        </div>
        <div class="login-stat-sep"></div>
        <div class="login-stat">
          <div class="login-stat-num">∞</div>
          <div class="login-stat-label">Proyectos</div>
        </div>
      </div>

      <!-- Pills de features -->
      <div class="login-pills">
        <div class="login-pill"><i class="ph ph-kanban"></i> Kanban</div>
        <div class="login-pill"><i class="ph ph-users"></i> Equipos</div>
        <div class="login-pill"><i class="ph ph-chart-bar"></i> Reportes</div>
        <div class="login-pill"><i class="ph ph-bell"></i> Notificaciones</div>
        <div class="login-pill"><i class="ph ph-list-checks"></i> Subtareas</div>
      </div>
    </div>

    <!-- Panel derecho — formulario -->
    <div class="login-right">
      <div class="login-form-header">
        <div class="login-form-title">Iniciar sesión</div>
        <div class="login-form-sub">Ingresa tus credenciales para continuar</div>
      </div>

      <div class="login-fields">
        <div class="fg">
          <label class="flabel">Correo electrónico</label>
          <div class="login-input-wrap">
            <i class="ph ph-envelope login-input-ico"></i>
            <input class="finput login-finput" id="lEmail" type="email"
              placeholder="correo@empresa.com" autocomplete="email">
          </div>
        </div>

        <div class="fg">
          <label class="flabel">Contraseña</label>
          <div class="login-input-wrap">
            <i class="ph ph-lock login-input-ico"></i>
            <input class="finput login-finput login-finput-pass" id="lPass" type="password"
              placeholder="••••••••" autocomplete="current-password">
            <button onclick="toggleVerPass()" tabindex="-1" id="btnVerPass" class="login-eye-btn">
              <i class="ph ph-eye" id="iconoVerPass"></i>
            </button>
          </div>
          <div class="ferror" id="lError"></div>
        </div>

        <button class="btn btn-primary btn-w login-btn" id="btnLogin" onclick="iniciarSesion()">
          <i class="ph ph-sign-in"></i> Iniciar sesión
        </button>
      </div>

      <div class="login-roles">
        <div class="login-roles-label">Roles del sistema</div>
        <div class="login-roles-badges">
          <span class="login-role-badge login-role-admin"><i class="ph ph-shield-check"></i> Admin</span>
          <span class="login-role-badge login-role-pm"><i class="ph ph-briefcase"></i> Project Manager</span>
          <span class="login-role-badge login-role-dev"><i class="ph ph-code"></i> Developer</span>
        </div>
      </div>

      <div class="login-footer">
        Universidad Popular del Cesar · TaskFlow 2026
      </div>
    </div>

  </div>
</div>
<div class="pantalla activa" id="pantalla-login" style="display:none"></div>
`,
  dashboard: `<div class="pantalla" id="pantalla-dashboard">
  <div class="dash-wrap">

    <!-- Hero renovado con Tailwind -->
    <div class="dash-hero relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[var(--s2)] via-[var(--s2)] to-[rgba(108,99,255,0.08)] p-5 mb-5 shadow-card">
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-brand/10 blur-3xl"></div>
        <div class="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-ok/5 blur-2xl"></div>
      </div>
      <div class="relative flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-3 mb-1">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-light flex items-center justify-center shadow-brand text-white text-lg flex-shrink-0">
              <i class="ph ph-chart-line-up"></i>
            </div>
            <div class="dash-title text-xl font-bold text-[var(--t1)]" id="dashSaludo">Dashboard estratégico</div>
          </div>
          <div class="dash-sub flex items-center gap-1.5 text-xs text-[var(--t3)] ml-13 pl-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-ok animate-pulse inline-block"></span>
            En tiempo real · <span id="dashFecha" class="font-medium text-[var(--t2)]"></span>
          </div>
        </div>
        <div class="dash-controls flex items-center gap-2 flex-shrink-0">
          <button class="btn btn-outline btn-sm dash-refresh hover:border-brand/40 hover:bg-brand/10 hover:text-brand-light transition-all rounded-xl" onclick="refrescarDashboard()" title="Actualizar dashboard">
            <i class="ph ph-arrows-clockwise"></i>
          </button>
          <div id="dashAcciones"></div>
        </div>
      </div>
    </div>

    <!-- Filtros analíticos -->
    <div class="card rounded-2xl border border-white/[0.07] bg-[var(--s2)] p-4 mb-4 shadow-card">
      <div class="chart-header mb-3">
        <div>
          <div class="chart-title flex items-center gap-2 font-semibold text-[var(--t1)]"><i class="ph ph-funnel text-brand-light"></i> Filtros analíticos</div>
          <div class="chart-sub text-xs text-[var(--t3)] mt-0.5">Cruza proyecto, fase, etapa, responsable y contexto jerárquico</div>
        </div>
        <button class="btn btn-ghost btn-xs hover:bg-white/[0.06] rounded-lg transition-all" onclick="limpiarFiltrosDashboard()">
          <i class="ph ph-eraser"></i> Limpiar
        </button>
      </div>
      <div class="frow" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        <div class="fg"><label class="flabel">Proyecto</label>
          <select class="fselect" id="selDashProy" onchange="actualizarDashboardProy(this.value)"><option value="">— Todos los proyectos —</option></select>
        </div>
        <div class="fg"><label class="flabel">Fase</label>
          <select class="fselect" id="selDashFase" onchange="onCambioFaseDashboard()"><option value="">— Todas las fases —</option></select>
        </div>
        <div class="fg"><label class="flabel">Etapa</label>
          <select class="fselect" id="selDashEtapa" onchange="onCambioFiltroDashboard()"><option value="">— Todas las etapas —</option></select>
        </div>
        <div class="fg"><label class="flabel">Responsable</label>
          <select class="fselect" id="selDashResp" onchange="onCambioFiltroDashboard()"><option value="">— Todo el equipo —</option></select>
        </div>
      </div>
      <div class="frow mt-2.5" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        <div class="fg"><label class="flabel">Prioridad</label>
          <select class="fselect" id="selDashPrio" onchange="onCambioFiltroDashboard()">
            <option value="">— Todas —</option><option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option>
          </select>
        </div>
        <div class="fg"><label class="flabel">Tipo</label>
          <select class="fselect" id="selDashTipo" onchange="onCambioFiltroDashboard()">
            <option value="">— Todos —</option><option value="TASK">Task</option>
            <option value="BUG">Bug</option><option value="FEATURE">Feature</option><option value="IMPROVEMENT">Improvement</option>
          </select>
        </div>
        <div class="fg"><label class="flabel">Contexto</label>
          <select class="fselect" id="selDashContexto" onchange="onCambioFiltroDashboard()">
            <option value="todos">Todo el trabajo</option>
            <option value="estructura">Solo con fase/etapa</option>
            <option value="legadas">Solo legadas sin fase/etapa</option>
          </select>
        </div>
        <div class="fg"><label class="flabel">Ventana de velocidad</label>
          <select class="fselect" id="selDashSemanas" onchange="onCambioFiltroDashboard()">
            <option value="4">4 semanas</option><option value="8" selected>8 semanas</option><option value="12">12 semanas</option>
          </select>
        </div>
      </div>
      <div class="flex justify-end mt-2.5">
        <label class="flex items-center gap-2 text-xs text-[var(--t3)] cursor-pointer px-3 py-2 rounded-lg border border-white/[0.07] bg-[var(--s3)] hover:border-brand/30 transition-all select-none">
          <input type="checkbox" id="chkDashIncluirSubEtapa" checked onchange="onCambioFiltroDashboard()" class="accent-brand">
          Incluir subtareas de etapa
        </label>
      </div>
    </div>

    <!-- KPI Grid mejorado con Tailwind -->
    <div class="kpi-grid">

      <div class="kpi-card kpi-primary group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[var(--s2)] to-[rgba(108,99,255,0.06)] p-4 cursor-default hover:-translate-y-1 hover:shadow-brand transition-all duration-200">
        <div class="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"></div>
        <div class="kpi-icon w-10 h-10 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center text-brand-light group-hover:bg-brand/25 transition-colors mb-3">
          <i class="ph ph-chart-line-up text-xl"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-label text-xs font-medium text-[var(--t3)] uppercase tracking-wider mb-1">Trabajo visible</div>
          <div class="kpi-value text-2xl font-bold" id="stDashTrabajo">—</div>
          <div class="kpi-sub text-xs text-[var(--t3)] mt-1" id="stDashTrabajoSub">—</div>
        </div>
      </div>

      <div class="kpi-card kpi-success group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[var(--s2)] to-[rgba(52,211,153,0.05)] p-4 cursor-default hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(52,211,153,0.2)] transition-all duration-200">
        <div class="absolute inset-0 bg-gradient-to-br from-ok/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"></div>
        <div class="kpi-icon w-10 h-10 rounded-xl bg-ok/15 border border-ok/25 flex items-center justify-center text-ok group-hover:bg-ok/25 transition-colors mb-3">
          <i class="ph ph-kanban text-xl"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-label text-xs font-medium text-[var(--t3)] uppercase tracking-wider mb-1">Tareas Kanban</div>
          <div class="kpi-value text-2xl font-bold" id="stDashTareas">—</div>
          <div class="kpi-sub text-xs text-[var(--t3)] mt-1" id="stDashTareasSub">—</div>
        </div>
      </div>

      <div class="kpi-card kpi-info group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[var(--s2)] to-[rgba(96,165,250,0.05)] p-4 cursor-default hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(96,165,250,0.2)] transition-all duration-200">
        <div class="absolute inset-0 bg-gradient-to-br from-info/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"></div>
        <div class="kpi-icon w-10 h-10 rounded-xl bg-info/15 border border-info/25 flex items-center justify-center text-info group-hover:bg-info/25 transition-colors mb-3">
          <i class="ph ph-tree-structure text-xl"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-label text-xs font-medium text-[var(--t3)] uppercase tracking-wider mb-1">Subtareas de etapa</div>
          <div class="kpi-value text-2xl font-bold" id="stDashSubEtapas">—</div>
          <div class="kpi-sub text-xs text-[var(--t3)] mt-1" id="stDashSubEtapasSub">—</div>
        </div>
      </div>

      <div class="kpi-card kpi-danger group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[var(--s2)] to-[rgba(248,113,113,0.05)] p-4 cursor-default hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(248,113,113,0.2)] transition-all duration-200">
        <div class="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"></div>
        <div class="kpi-icon w-10 h-10 rounded-xl bg-danger/15 border border-danger/25 flex items-center justify-center text-danger group-hover:bg-danger/25 transition-colors mb-3">
          <i class="ph ph-warning-circle text-xl"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-label text-xs font-medium text-[var(--t3)] uppercase tracking-wider mb-1">Trabajo vencido</div>
          <div class="kpi-value text-2xl font-bold" id="stDashVencidas">—</div>
          <div class="kpi-sub text-xs text-[var(--t3)] mt-1" id="stDashVencidasSub">—</div>
        </div>
      </div>

      <div class="kpi-card kpi-warning group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[var(--s2)] to-[rgba(251,191,36,0.05)] p-4 cursor-default hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(251,191,36,0.2)] transition-all duration-200">
        <div class="absolute inset-0 bg-gradient-to-br from-warn/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"></div>
        <div class="kpi-icon w-10 h-10 rounded-xl bg-warn/15 border border-warn/25 flex items-center justify-center text-warn group-hover:bg-warn/25 transition-colors mb-3">
          <i class="ph ph-git-branch text-xl"></i>
        </div>
        <div class="kpi-body">
          <div class="kpi-label text-xs font-medium text-[var(--t3)] uppercase tracking-wider mb-1">Cobertura estructura</div>
          <div class="kpi-value text-2xl font-bold" id="stDashCobertura">—</div>
          <div class="kpi-sub text-xs text-[var(--t3)] mt-1" id="stDashCoberturaSub">—</div>
        </div>
      </div>

    </div>

    <div class="dash-row-main">
      <div class="card dash-chart-lg">
        <div class="chart-header">
          <div>
            <div class="chart-title"><i class="ph ph-kanban"></i> Flujo por estado</div>
            <div class="chart-sub">Columnas Kanban + subtareas de etapa</div>
          </div>
        </div>
        <div id="chartDashEstado" style="height:300px"></div>
      </div>
      <div class="card dash-chart-md">
        <div class="chart-header">
          <div>
            <div class="chart-title"><i class="ph ph-trend-up"></i> Velocidad semanal</div>
            <div class="chart-sub">Creación de trabajo en la ventana seleccionada</div>
          </div>
        </div>
        <div id="chartDashVelocidad" style="height:300px"></div>
      </div>
    </div>

    <div class="dash-row-2">
      <div class="card">
        <div class="chart-header">
          <div>
            <div class="chart-title"><i class="ph ph-flag-banner"></i> Distribución por fase</div>
            <div class="chart-sub">Incluye tareas y subtareas de etapa según filtros</div>
          </div>
        </div>
        <div id="chartDashFase" style="height:220px"></div>
      </div>
      <div class="card">
        <div class="chart-header">
          <div>
            <div class="chart-title"><i class="ph ph-signpost"></i> Carga por etapa</div>
            <div class="chart-sub">Comparativo tareas vs subtareas de etapa</div>
          </div>
        </div>
        <div id="chartDashEtapa" style="height:220px"></div>
      </div>
      <div class="card">
        <div class="chart-header">
          <div>
            <div class="chart-title"><i class="ph ph-users-three"></i> Carga del equipo</div>
            <div class="chart-sub">Asignaciones activas por miembro</div>
          </div>
        </div>
        <div id="chartDashResponsables" style="height:220px"></div>
      </div>
    </div>

    <div class="dash-row-main">
      <div class="card dash-chart-md">
        <div class="chart-header">
          <div>
            <div class="chart-title"><i class="ph ph-chart-pie-slice"></i> Prioridad</div>
            <div class="chart-sub">Mix de prioridades en tareas</div>
          </div>
        </div>
        <div id="chartDashPrioridad" style="height:250px"></div>
      </div>
      <div class="card dash-chart-md">
        <div class="chart-header">
          <div>
            <div class="chart-title"><i class="ph ph-chart-bar"></i> Tipo de trabajo</div>
            <div class="chart-sub">Task / Bug / Feature / Improvement</div>
          </div>
        </div>
        <div id="chartDashTipo" style="height:250px"></div>
      </div>
    </div>

    <div class="card">
      <div class="chart-header" style="margin-bottom:12px">
        <div>
          <div class="chart-title"><i class="ph ph-lightbulb"></i> Insights del estado actual</div>
          <div class="chart-sub">Lectura automática basada en fase, etapa y tareas legadas</div>
        </div>
      </div>
      <div id="dashAlertas" class="vacío">Analizando...</div>
    </div>

    <div class="card dash-projects-panel" style="margin-bottom:24px">
      <div class="chart-header" style="margin-bottom:16px">
        <div>
          <div class="chart-title"><i class="ph ph-folder-simple-star"></i> Proyectos recientes</div>
          <div class="chart-sub">Últimos proyectos con actividad</div>
        </div>
        <div id="dashAccionesProy"></div>
      </div>
      <div id="dashProyectos" class="vacío">Cargando...</div>
    </div>

  </div>
</div>
`,
  proyectos: `<div class="pantalla" id="pantalla-proyectos">
  <div class="page-wrap">
    <div class="page-head">
      <div><div class="page-title">Proyectos</div><div class="page-desc">Gestiona y organiza tus proyectos</div></div>
      <div class="flex" id="proyAcciones"></div>
    </div>
    <div class="card"><div class="card-t"><i class="ph ph-list"></i> Listado</div><div id="listaProyectos" class="vacío">Cargando...</div></div>
    <div class="card" id="proyJerarquiaCard">
      <div class="flex-between" style="margin-bottom:12px;gap:10px;flex-wrap:wrap">
        <div class="card-t" style="margin-bottom:0">
          <i class="ph ph-tree-structure"></i> Estructura del proyecto
        </div>
        <div class="flex" style="gap:8px">
          <button class="btn btn-outline btn-xs" onclick="refrescarJerarquiaProyecto()">
            <i class="ph ph-arrows-clockwise"></i> Refrescar
          </button>
          <button class="btn btn-primary btn-xs" id="btnNuevaFaseJerarquia" style="display:none" onclick="crearFaseJerarquia()">
            <i class="ph ph-plus"></i> Nueva fase
          </button>
        </div>
      </div>
      <div class="frow" style="margin-bottom:10px">
        <div class="fg">
          <label class="flabel">Proyecto</label>
          <select class="fselect" id="selJerarquiaProy" onchange="seleccionarProyectoJerarquia(this.value)">
            <option value="">— Selecciona un proyecto —</option>
          </select>
        </div>
        <div class="fg" style="max-width:280px">
          <label class="flabel">Resumen</label>
          <div id="proyJerarquiaStats" class="txt3" style="font-size:12px;padding:8px 10px;border:1px solid var(--b1);border-radius:var(--r);background:var(--s2)">—</div>
        </div>
      </div>
      <div class="ferror" id="proyJerarquiaError"></div>
      <div id="proyJerarquiaArbol" class="vacío">Selecciona un proyecto para visualizar fases, etapas y subtareas.</div>
    </div>
  </div>
</div>`,
  tablero: `<div class="pantalla" id="pantalla-tablero">
  <div class="kanban-barra">
    <select class="fselect" id="selPT" style="width:220px;padding:6px 10px" onchange="cargarTablero(this.value)">
      <option value="">— Selecciona un proyecto —</option>
    </select>
    <span id="tBreadcrumb" class="txt3"></span>
    <div style="margin-left:auto;display:flex;gap:7px">
      <button class="btn btn-outline btn-sm" onclick="agregarColumna()">
        <i class="ph ph-columns-plus-right"></i> Columna
      </button>
      <button class="btn btn-primary btn-sm" onclick="abrirModalTarea()">
        <i class="ph ph-plus"></i> Tarea
      </button>
    </div>
  </div>
  <div class="kanban-shell" id="kanbanBoard">
    <div class="vacío" style="width:100%">Selecciona un proyecto para ver el tablero</div>
  </div>
</div>`,
  tareas: `<div class="pantalla" id="pantalla-tareas">
  <div class="page-wrap">
    <div class="page-head">
      <div><div class="page-title">Tareas</div><div class="page-desc">Gestión y seguimiento de tareas</div></div>
      <div class="flex" style="gap:8px;flex-wrap:wrap">
        <select class="fselect" id="selTareasProy" style="width:200px;padding:6px 10px" onchange="cargarTareasPaginadas(this.value,1)">
          <option value="">— Proyecto —</option>
        </select>
        <select class="fselect" id="fTareaFase" style="width:180px;padding:6px 10px" onchange="onCambioFiltroFaseTareas()">
          <option value="">— Fase —</option>
        </select>
        <select class="fselect" id="fTareaEtapa" style="width:180px;padding:6px 10px" onchange="onCambioFiltroEtapaTareas()">
          <option value="">— Etapa —</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="abrirModalTarea()">
          <i class="ph ph-plus"></i> Nueva
        </button>
      </div>
    </div>
    <div class="card">
      <div class="tabla-wrap">
        <table>
          <thead><tr><th>Tarea</th><th>Responsables</th><th>Estado</th><th></th></tr></thead>
          <tbody id="tbTareas"><tr><td colspan="4" class="vacío">Selecciona un proyecto para ver las tareas</td></tr></tbody>
        </table>
      </div>
      <div id="pagTareas"></div>
    </div>
  </div>
</div>`,
  usuarios: `<div class="pantalla" id="pantalla-usuarios">
  <div class="page-wrap">
    <div class="page-head">
      <div><div class="page-title">Usuarios</div><div class="page-desc">Gestión de cuentas del sistema</div></div>
      <span class="badge bi"><i class="ph ph-lock-simple"></i> Solo Admin</span>
    </div>
    <div class="card">
      <div class="tabla-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody id="tbUsuarios"><tr><td colspan="6" class="vacío">Cargando...</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</div>`,
  registro: `<div class="pantalla" id="pantalla-registro">
  <div class="registro-wrap">

    <div class="registro-left">
      <div class="registro-brand-ico"><i class="ph ph-user-plus"></i></div>
      <div class="registro-brand-title">Nuevo usuario</div>
      <div class="registro-brand-desc">Crea una cuenta para que el miembro pueda acceder al sistema con el rol asignado.</div>
      <div class="sep"></div>
      <div class="registro-roles">
        <div class="registro-rol-item">
          <div class="registro-rol-ico" style="background:var(--redbg);color:var(--red)"><i class="ph ph-shield-star"></i></div>
          <div>
            <div class="registro-rol-nombre">Admin</div>
            <div class="registro-rol-desc">Acceso total al sistema</div>
          </div>
        </div>
        <div class="registro-rol-item">
          <div class="registro-rol-ico" style="background:var(--bluebg);color:var(--blue)"><i class="ph ph-briefcase"></i></div>
          <div>
            <div class="registro-rol-nombre">Project Manager</div>
            <div class="registro-rol-desc">Gestiona proyectos y equipos</div>
          </div>
        </div>
        <div class="registro-rol-item">
          <div class="registro-rol-ico" style="background:var(--greenbg);color:var(--green)"><i class="ph ph-code"></i></div>
          <div>
            <div class="registro-rol-nombre">Developer</div>
            <div class="registro-rol-desc">Trabaja en tareas asignadas</div>
          </div>
        </div>
      </div>
    </div>

    <div class="registro-right">
      <div class="card registro-form-card">
        <div class="perfil-section-title" style="margin-bottom:20px">
          <i class="ph ph-identification-card" style="color:var(--a)"></i> Datos del nuevo usuario
        </div>

        <div class="fg">
          <label class="flabel">Nombre completo</label>
          <div style="position:relative">
            <input class="finput" id="rNombre" placeholder="Ej: María García" style="padding-left:36px">
            <i class="ph ph-user" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:15px"></i>
          </div>
        </div>

        <div class="fg">
          <label class="flabel">Correo electrónico</label>
          <div style="position:relative">
            <input class="finput" id="rEmail" type="email" placeholder="correo@empresa.com" style="padding-left:36px">
            <i class="ph ph-envelope" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:15px"></i>
          </div>
        </div>

        <div class="fg">
          <label class="flabel">Contraseña inicial</label>
          <div style="position:relative">
            <input class="finput" id="rPass" type="password" placeholder="Mínimo 6 caracteres" style="padding-left:36px;padding-right:40px">
            <i class="ph ph-lock-key" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:15px"></i>
            <button onclick="toggleVerPassReg()" tabindex="-1"
              style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--t3);padding:4px;display:flex;align-items:center">
              <i class="ph ph-eye" id="iconoVerPassReg" style="font-size:15px"></i>
            </button>
          </div>
        </div>

        <div class="fg">
          <label class="flabel">Rol del usuario</label>
          <div class="registro-rol-selector" id="rRolSelector">
            <div class="registro-rol-opt activo" data-val="DEVELOPER" onclick="seleccionarRol(this)">
              <i class="ph ph-code"></i>
              <span>Developer</span>
            </div>
            <div class="registro-rol-opt" data-val="PROJECT_MANAGER" onclick="seleccionarRol(this)">
              <i class="ph ph-briefcase"></i>
              <span>PM</span>
            </div>
            <div class="registro-rol-opt" data-val="ADMIN" onclick="seleccionarRol(this)">
              <i class="ph ph-shield-star"></i>
              <span>Admin</span>
            </div>
          </div>
          <input type="hidden" id="rRol" value="DEVELOPER">
        </div>

        <div class="ferror" id="rError"></div>

        <button class="btn btn-primary btn-w" onclick="crearUsuario()" style="height:40px;font-size:14px">
          <i class="ph ph-user-plus"></i> Crear usuario
        </button>
      </div>
    </div>
  </div>
</div>
`,
  reportes: `<div class="pantalla" id="pantalla-reportes">
  <div class="page-wrap">
    <div class="page-head">
      <div><div class="page-title">Reportes y estadísticas</div><div class="page-desc">Métricas y seguimiento del proyecto</div></div>
      <select class="fselect" id="selReporteProy" style="width:220px;padding:6px 10px" onchange="cargarReporte(this.value)">
        <option value="">— Selecciona un proyecto —</option>
      </select>
    </div>
    <div class="htabs" id="tabsReporte">
      <button class="htab activo" onclick="cambiarTabReporte('metricas',this)"><i class="ph ph-chart-pie"></i> Métricas</button>
      <button class="htab" onclick="cambiarTabReporte('sprint',this)"><i class="ph ph-lightning"></i> Sprint</button>
      <button class="htab" onclick="cambiarTabReporte('equipo',this)"><i class="ph ph-users-three"></i> Equipo</button>
      <button class="htab" id="tabAuditGlobal" onclick="cambiarTabReporte('auditoria_global',this)" style="display:none"><i class="ph ph-shield-check"></i> Auditoría global</button>
      <button class="htab" id="tabRetencion" onclick="cambiarTabReporte('retencion',this)" style="display:none"><i class="ph ph-archive"></i> Retención</button>
      <button class="htab" onclick="cambiarTabReporte('exportar',this)"><i class="ph ph-bridge"></i> Exportar</button>
    </div>
    <div class="hpanel activo" id="rpanel-metricas">
      <div class="stats-row">
        <div class="stat" style="--g:rgba(108,99,255,.3)"><div class="stat-n">Total tareas</div><div class="stat-v" id="rTotal">—</div></div>
        <div class="stat" style="--g:rgba(248,113,113,.3)"><div class="stat-n">Vencidas</div><div class="stat-v" id="rVenc" style="color:var(--red)">—</div></div>
        <div class="stat" style="--g:rgba(52,211,153,.3)"><div class="stat-n">Progreso</div><div class="stat-v" id="rProg">—</div></div>
      </div>
      <div class="card"><div class="card-t"><i class="ph ph-list-bullets"></i> Distribución por columna</div><div id="rDist" class="vacío">Selecciona un proyecto</div></div>
    </div>
    <div class="hpanel" id="rpanel-sprint">
      <div class="card">
        <div class="card-t"><i class="ph ph-lightning"></i> Reporte de sprint</div>
        <div class="flex" style="gap:8px;margin-bottom:16px">
          <input class="finput" id="sprintNombre" placeholder="Nombre del sprint (ej: Sprint 1, Q1 2026...)" style="flex:1">
          <button class="btn btn-primary btn-sm" onclick="generarReporteSprint()"><i class="ph ph-play"></i> Generar</button>
        </div>
        <div id="contenidoSprint" class="vacío">Selecciona un proyecto e ingresa el nombre del sprint</div>
      </div>
    </div>
    <div class="hpanel" id="rpanel-equipo">
      <div class="card"><div class="card-t"><i class="ph ph-users-three"></i> Estadísticas del equipo</div><div id="statsEquipo" class="vacío">Selecciona un proyecto</div></div>
    </div>
    <div class="hpanel" id="rpanel-auditoria_global">
      <div class="card"><div class="card-t"><i class="ph ph-shield-check"></i> Auditoría global del sistema</div><div id="listaAuditoriaGlobal" class="vacío">Cargando...</div></div>
    </div>
    <div class="hpanel" id="rpanel-retencion">
      <div class="card">
        <div class="card-t"><i class="ph ph-archive"></i> Política de retención de logs</div>
        <div class="fg" style="max-width:320px"><label class="flabel">Días de retención</label><input class="finput" id="diasRetencion" type="number" value="90" min="7" max="365"></div>
        <div class="fg" style="max-width:320px">
          <label class="flabel">Nivel mínimo a conservar</label>
          <select class="fselect" id="nivelRetencion">
            <option value="todos">Todos los registros</option>
            <option value="error">Solo errores</option>
            <option value="auditoria">Solo auditoría</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" onclick="aplicarPoliticaRetencion()"><i class="ph ph-check"></i> Aplicar política</button>
        <div id="retencionMensaje" class="txt3" style="margin-top:12px"></div>
      </div>
    </div>
    <div class="hpanel" id="rpanel-exportar">
      <div class="card">
        <div class="card-t"><i class="ph ph-bridge"></i> Exportación de reportes (Bridge)</div>
        <div class="frow" style="max-width:760px">
          <div class="fg">
            <label class="flabel">Tipo de reporte</label>
            <select class="fselect" id="expTipo">
              <option value="tareas">Tareas</option>
              <option value="auditoria">Auditoría</option>
              <option value="equipo">Equipo</option>
            </select>
          </div>
          <div class="fg">
            <label class="flabel">Formato de salida</label>
            <select class="fselect" id="expFormato">
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="json" selected>JSON</option>
            </select>
          </div>
        </div>
        <div class="flex" style="justify-content:flex-end;margin-top:12px">
          <button class="btn btn-primary btn-sm" onclick="exportarReporteBridgeDesdeUI()">
            <i class="ph ph-download-simple"></i> Exportar
          </button>
        </div>
      </div>
    </div>
  </div>
</div>`,
  historial: `<div class="pantalla" id="pantalla-historial">
  <div class="page-wrap">
    <div class="page-head">
      <div><div class="page-title">Historial y auditoría</div><div class="page-desc">Registro de cambios del proyecto</div></div>
      <select class="fselect" id="selHistProy" style="width:220px;padding:6px 10px" onchange="cargarHistorial(this.value)">
        <option value="">— Selecciona un proyecto —</option>
      </select>
    </div>
    <div class="htabs" id="tabsHistorial">
      <button class="htab activo" onclick="cambiarTabHist('auditoria',this)"><i class="ph ph-clock-clockwise"></i> Auditoría</button>
      <button class="htab" onclick="cambiarTabHist('tarea',this)"><i class="ph ph-file-text"></i> Por tarea</button>
      <button class="htab" onclick="cambiarTabHist('buscar',this)"><i class="ph ph-magnifying-glass"></i> Buscar</button>
      <button class="htab" onclick="cambiarTabHist('completadas',this)"><i class="ph ph-check-circle"></i> Completadas</button>
    </div>
    <div class="hpanel activo" id="hpanel-auditoria">
      <div class="card"><div class="card-t"><i class="ph ph-activity"></i> Actividad reciente</div><div id="listaHist" class="vacío">Selecciona un proyecto</div></div>
    </div>
    <div class="hpanel" id="hpanel-tarea">
      <div class="card">
        <div class="card-t"><i class="ph ph-file-magnifying-glass"></i> Historial de una tarea</div>
        <div class="flex" style="gap:8px;margin-bottom:16px">
          <input class="finput" id="histTareaId" placeholder="ID de tarea (últimos 6 caracteres)..." style="flex:1">
          <button class="btn btn-primary btn-sm" onclick="cargarHistorialTarea()"><i class="ph ph-magnifying-glass"></i> Ver</button>
        </div>
        <div id="listaHistTarea" class="vacío">Ingresa el ID de una tarea</div>
        <div id="undoZona" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--b1)">
          <div class="flex-between">
            <span class="txt2">Último cambio registrado</span>
            <button class="btn btn-outline btn-sm" onclick="deshacerUltimoCambio()" style="border-color:var(--amber);color:var(--amber)">
              <i class="ph ph-arrow-counter-clockwise"></i> Deshacer
            </button>
          </div>
          <div id="undoDetalle" class="txt3" style="margin-top:6px"></div>
        </div>
      </div>
    </div>
    <div class="hpanel" id="hpanel-buscar">
      <div class="card">
        <div class="card-t"><i class="ph ph-funnel"></i> Buscar y filtrar tareas</div>
        <div class="filtro-barra">
          <input class="finput" id="fTexto" placeholder="Título..." style="flex:2;min-width:140px">
          <select class="fselect" id="fPrioridad" style="width:120px">
            <option value="">Prioridad</option>
            <option value="BAJA">Baja</option><option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option><option value="URGENTE">Urgente</option>
          </select>
          <select class="fselect" id="fTipo" style="width:120px">
            <option value="">Tipo</option>
            <option value="TASK">Task</option><option value="BUG">Bug</option>
            <option value="FEATURE">Feature</option><option value="IMPROVEMENT">Improvement</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="buscarTareas()"><i class="ph ph-magnifying-glass"></i> Buscar</button>
          <button class="btn btn-ghost btn-sm" onclick="limpiarFiltros()"><i class="ph ph-x"></i></button>
        </div>
        <div class="tabla-wrap">
          <table>
            <thead><tr><th>Título</th><th>Tipo</th><th>Prioridad</th><th>Columna</th><th>Estado</th></tr></thead>
            <tbody id="tbBusqueda"><tr><td colspan="5" class="vacío">Aplica un filtro para buscar</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
    <div class="hpanel" id="hpanel-completadas">
      <div class="card"><div class="card-t"><i class="ph ph-check-circle"></i> Mis tareas completadas</div><div id="listaCompletadas" class="vacío">Selecciona un proyecto primero</div></div>
    </div>
  </div>
</div>
`,
  notificaciones: `<div class="pantalla" id="pantalla-notificaciones">
  <div class="page-wrap">

    <div class="page-head">
      <div>
        <div class="page-title">Notificaciones</div>
        <div class="page-desc" id="notifDesc"><i class="ph ph-bell" style="font-size:13px"></i> Alertas y avisos del sistema</div>
      </div>
      <div class="flex" style="gap:8px">
        <button class="btn btn-outline btn-sm" id="btnMarcarLeidas" onclick="marcarTodasLeidas()" style="display:none">
          <i class="ph ph-checks"></i> Marcar todas leídas
        </button>
      </div>
    </div>

    <!-- PANEL ENVÍO EXTERNO — visible para Admin y PM -->
    <div id="panelEnvioExterno" style="display:none" class="mb16">
      <div class="card">
        <div class="card-t">
          <i class="ph ph-paper-plane-tilt" style="color:var(--a)"></i>
          Enviar notificación externa
        </div>
        <div style="font-size:12px;color:var(--t3);line-height:1.6;margin-bottom:14px">
          Selecciona un canal y envía la notificación a través del servicio externo.
        </div>

        <!-- Selector de canal -->
        <div class="fg">
          <label class="flabel">Canal de envío</label>
          <div class="ncanal-grid" id="ncanalGrid">
            <div class="ncanal-opt activo" data-canal="email" onclick="notifSelCanal(this)">
              <i class="ph ph-envelope" style="font-size:22px;color:var(--blue)"></i>
              <div class="ncanal-nombre">Email</div>
              <div class="ncanal-clase">Canal Email</div>
            </div>
            <div class="ncanal-opt" data-canal="whatsapp" onclick="notifSelCanal(this)">
              <i class="ph ph-chat-circle-dots" style="font-size:22px;color:var(--green)"></i>
              <div class="ncanal-nombre">WhatsApp</div>
              <div class="ncanal-clase">Canal WhatsApp</div>
            </div>
            <div class="ncanal-opt" data-canal="sms" onclick="notifSelCanal(this)">
              <i class="ph ph-device-mobile" style="font-size:22px;color:var(--amber)"></i>
              <div class="ncanal-nombre">SMS</div>
              <div class="ncanal-clase">Canal SMS</div>
            </div>
          </div>
        </div>

        <!-- Flujo visual -->
        <div class="nflujo">
          <div class="nflujo-paso">
            <div class="nflujo-ico"><i class="ph ph-buildings"></i></div>
            <div>
              <div class="nflujo-titulo">Proveedor</div>
              <div class="nflujo-sub">get("<span id="nflujoCanal">email</span>")</div>
            </div>
          </div>
          <i class="ph ph-arrow-right" style="color:var(--t4);font-size:14px"></i>
          <div class="nflujo-paso nflujo-factory">
            <div class="nflujo-ico"><i class="ph ph-factory"></i></div>
            <div>
              <div class="nflujo-titulo">Origen</div>
              <div class="nflujo-sub" id="nflujoFabrica">Canal Email</div>
            </div>
          </div>
          <i class="ph ph-arrow-right" style="color:var(--t4);font-size:14px"></i>
          <div class="nflujo-paso nflujo-adapter">
            <div class="nflujo-ico"><i class="ph ph-plug"></i></div>
            <div>
              <div class="nflujo-titulo">Interfaz</div>
              <div class="nflujo-sub" id="nflujoAdapter">Canal Email</div>
            </div>
          </div>
          <i class="ph ph-arrow-right" style="color:var(--t4);font-size:14px"></i>
          <div class="nflujo-paso nflujo-api">
            <div class="nflujo-ico"><i class="ph ph-cloud-arrow-up"></i></div>
            <div>
              <div class="nflujo-titulo">API Externa</div>
              <div class="nflujo-sub" id="nflujoApi">Email API</div>
            </div>
          </div>
        </div>

        <!-- Formulario -->
        <div class="frow" style="margin-top:14px">
          <div class="fg">
            <label class="flabel">Destinatario</label>
            <select class="fselect" id="nDestinatario">
              <option value="">— Cargando usuarios... —</option>
            </select>
          </div>
          <div class="fg">
            <label class="flabel">Asunto</label>
            <input class="finput" id="nAsunto" value="Notificación TaskFlow" placeholder="Asunto del email">
          </div>
        </div>

        <!-- Campo de teléfono — visible solo para WhatsApp/SMS -->
        <div class="fg" id="nTelWrap" style="display:none;margin-top:10px">
          <label class="flabel" id="nTelLabel">Número de WhatsApp</label>
          <div class="nphone-row">
            <select class="fselect" id="nCodPais" title="Código de país" style="max-width:110px">
              <option value="+57" selected>🇨🇴 +57</option>
              <option value="+34">🇪🇸 +34</option>
              <option value="+52">🇲🇽 +52</option>
              <option value="+54">🇦🇷 +54</option>
              <option value="+51">🇵🇪 +51</option>
              <option value="+56">🇨🇱 +56</option>
              <option value="+58">🇻🇪 +58</option>
              <option value="+1">🇺🇸 +1</option>
            </select>
            <div style="position:relative;flex:1">
              <i class="ph ph-phone" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:15px;pointer-events:none"></i>
              <input class="finput" id="nTelefono" placeholder="300 000 0000 o +57 3000000000"
                style="padding-left:36px"
                title="Puedes escribir el número separado o completo con código país">
            </div>
          </div>
          <div style="font-size:10px;color:var(--t3);margin-top:4px;font-family:var(--mono)">
            Se normaliza automáticamente. Acepta número pegado o separado.
          </div>
        </div>

        <div class="fg" style="margin-top:10px">
          <label class="flabel">Mensaje</label>
          <textarea class="ftextarea" id="nMensaje" placeholder="Escribe el mensaje..." style="min-height:72px"></textarea>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;gap:12px;flex-wrap:wrap">
          <div id="nResultado" style="font-size:12px;font-family:var(--mono);color:var(--t3);flex:1"></div>
          <div class="flex" style="gap:8px">
            <button class="btn btn-outline btn-sm" onclick="notifProbarTodos()" id="btnProbarCanales">
              <i class="ph ph-broadcast"></i> Probar todos
            </button>
            <button class="btn btn-primary" onclick="notifEnviar()" id="btnEnviarNotif">
              <i class="ph ph-paper-plane-tilt"></i> Enviar notificación
            </button>
          </div>
        </div>
        <div class="ferror" id="nError" style="margin-top:6px"></div>
      </div>
    </div>

    <!-- VISTA ADMIN: tabla global -->
    <div id="panelAdminNotif" style="display:none" class="mb16">
      <div class="card">
        <div class="flex-between" style="margin-bottom:14px">
          <div class="card-t" style="margin-bottom:0">
            <i class="ph ph-globe"></i> Actividad reciente del sistema
          </div>
          <div class="flex" style="gap:8px">
            <span class="badge bi"><i class="ph ph-shield-star"></i> Admin</span>
            <button class="btn btn-outline btn-xs" onclick="cargarTodasNotificaciones()">
              <i class="ph ph-arrows-clockwise"></i> Actualizar
            </button>
          </div>
        </div>
        <div class="tabla-wrap">
          <table>
            <thead><tr><th>Acción</th><th>Rol</th><th>Usuario</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody id="tbTodasNotif"><tr><td colspan="5" class="vacío">Cargando...</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- VISTA USUARIO: mis notificaciones + preferencias -->
    <div id="panelMisNotif" style="display:none">
      <div class="card mb16">
        <div class="card-t"><i class="ph ph-bell-simple"></i> Mis notificaciones</div>
        <div id="listaNotifc" class="vacío">Cargando...</div>
      </div>
      <div class="card mb16">
        <div class="card-t"><i class="ph ph-broadcast"></i> Canal de notificaciones</div>
        <select class="fselect" id="canalNotif" style="margin-bottom:4px">
          <option value="IN_APP">📱 Solo en la app (In-App)</option>
          <option value="EMAIL">📧 Solo por Email</option>
          <option value="AMBOS">📱📧 Ambos (In-App + Email)</option>
        </select>
      </div>
      <div class="card">
        <div class="card-t"><i class="ph ph-sliders"></i> Preferencias de notificación</div>
        <div id="prefsNotif"></div>
        <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-outline btn-sm" onclick="cargarNotificaciones()">
            <i class="ph ph-arrow-clockwise"></i> Recargar
          </button>
          <button class="btn btn-primary btn-sm" onclick="guardarPrefs()">
            <i class="ph ph-floppy-disk"></i> Guardar preferencias
          </button>
        </div>
      </div>
    </div>

  </div>
</div>
`,
  perfil: `<div class="pantalla" id="pantalla-perfil">
  <div class="perfil-wrap">

    <!-- Columna izquierda: avatar + info -->
    <div class="perfil-sidebar">
      <div class="card perfil-avatar-card">
        <label class="avatar-upload perfil-avatar-upload" title="Cambiar foto">
          <img id="perAvatarImg" src="" alt="avatar" class="perfil-foto" style="display:none">
          <div class="perfil-avatar-inic avatar" id="perAvatarInic">--</div>
          <div class="perfil-avatar-overlay">
            <i class="ph ph-camera"></i>
            <span>Cambiar foto</span>
          </div>
          <input type="file" id="perAvatarFile" accept="image/png,image/jpeg,image/webp" onchange="previsualizarAvatar(this)">
        </label>
        <div class="perfil-nombre" id="perNombreDisplay">—</div>
        <div class="flex" style="justify-content:center;gap:6px;margin:4px 0 8px">
          <span class="badge bm" id="perRolDisplay">—</span>
        </div>
        <div class="perfil-email" id="perEmailDisplay">—</div>
        <div class="sep"></div>
        <div class="perfil-stat-row">
          <div class="perfil-stat"><div class="perfil-stat-v" id="perStProyectos">—</div><div class="perfil-stat-l">Proyectos</div></div>
          <div class="perfil-stat-div"></div>
          <div class="perfil-stat"><div class="perfil-stat-v" id="perStTareas">—</div><div class="perfil-stat-l">Tareas</div></div>
          <div class="perfil-stat-div"></div>
          <div class="perfil-stat"><div class="perfil-stat-v" id="perStAcceso">—</div><div class="perfil-stat-l">Último acceso</div></div>
        </div>
      </div>
    </div>

    <!-- Columna derecha: formulario -->
    <div class="perfil-main">

      <div class="card mb16">
        <div class="perfil-section-title"><i class="ph ph-user-circle" style="color:var(--a)"></i> Información personal</div>
        <div class="frow">
          <div class="fg">
            <label class="flabel">Nombre completo</label>
            <input class="finput" id="perNombre" placeholder="Tu nombre completo">
          </div>
          <div class="fg">
            <label class="flabel">URL de avatar (opcional)</label>
            <input class="finput" id="perAvatarUrl" placeholder="https://..." oninput="previsualizarAvatarUrl(this.value)">
          </div>
        </div>
        <div class="fg">
          <label class="flabel">Descripción / Bio</label>
          <textarea class="ftextarea" id="perDesc" placeholder="Cuéntanos algo sobre ti..." style="min-height:80px"></textarea>
        </div>
        <div class="ferror" id="perError"></div>
        <div class="flex" style="justify-content:flex-end">
          <button class="btn btn-primary" onclick="guardarPerfil()">
            <i class="ph ph-floppy-disk"></i> Guardar cambios
          </button>
        </div>
      </div>

      <div class="card">
        <div class="perfil-section-title"><i class="ph ph-shield-check" style="color:var(--green)"></i> Seguridad de cuenta</div>
        <div class="perfil-info-row"><i class="ph ph-envelope" style="color:var(--t3)"></i><div><div class="perfil-info-label">Correo electrónico</div><div class="perfil-info-val" id="perEmailSeg">—</div></div></div>
        <div class="perfil-info-row"><i class="ph ph-identification-card" style="color:var(--t3)"></i><div><div class="perfil-info-label">Rol en el sistema</div><div class="perfil-info-val" id="perRolSeg">—</div></div></div>
        <div class="perfil-info-row"><i class="ph ph-clock" style="color:var(--t3)"></i><div><div class="perfil-info-label">Miembro desde</div><div class="perfil-info-val" id="perFechaReg">—</div></div></div>
        <div class="sep"></div>
        <div class="flex-between">
          <div class="txt2" style="font-size:12px">El cambio de contraseña y correo se gestionan desde el panel de administración.</div>
          <span class="badge bg"><i class="ph ph-lock-key"></i> Cuenta activa</span>
        </div>
      </div>

    </div>
  </div>
</div>
`,
  configuracion: `<div class="pantalla" id="pantalla-configuracion">
  <div class="page-wrap" style="max-width:100%">

    <div class="page-head">
      <div>
        <div class="page-title">Configuración</div>
        <div class="page-desc">Personalización y ajustes del sistema</div>
      </div>
    </div>

    <!-- ── TEMAS VISUALES ── -->
    <div class="card mb16">
      <div class="perfil-section-title">
        <i class="ph ph-paint-brush" style="color:var(--a)"></i>
        Tema visual
      </div>
      <div class="txt3 mb8" style="font-size:12px;line-height:1.6">
        Selecciona una familia de colores. El backend genera todas las variables CSS usando la fábrica correspondiente.
        Cada tema es una implementación concreta de <code style="background:var(--s3);padding:1px 6px;border-radius:4px;font-family:var(--mono);font-size:11px">FabricaTema</code>.
      </div>

      <div class="temas-grid" id="temasGrid">
        <!-- Generado por JS -->
      </div>

      <div id="temaVariablesPanel" style="display:none;margin-top:16px">
        <div class="sep"></div>
        <div class="card-t" style="margin-bottom:10px"><i class="ph ph-code"></i> Variables generadas por la fábrica</div>
        <div id="temaVariablesContenido"></div>
      </div>
    </div>

    <!-- ── CONFIGURACIÓN GENERAL ── -->
    <div class="card mb16" id="cardConfigGeneral" style="display:none">
      <div class="perfil-section-title">
        <i class="ph ph-sliders" style="color:var(--amber)"></i>
        Configuración general del sistema
        <span class="badge bi" style="margin-left:auto">Solo Admin</span>
      </div>

      <div class="frow">
        <div class="fg">
          <label class="flabel">Nombre de la plataforma</label>
          <input class="finput" id="cfgNombre" placeholder="TaskFlow">
        </div>
        <div class="fg">
          <label class="flabel">Zona horaria</label>
          <select class="fselect" id="cfgZona">
            <option value="America/Bogota">América/Bogotá (UTC-5)</option>
            <option value="America/Lima">América/Lima (UTC-5)</option>
            <option value="America/Mexico_City">América/México (UTC-6)</option>
            <option value="America/Buenos_Aires">América/Buenos Aires (UTC-3)</option>
            <option value="America/Santiago">América/Santiago (UTC-4)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
      </div>

      <div class="fg" style="max-width:200px">
        <label class="flabel">Tamaño máximo de archivos (MB)</label>
        <input class="finput" id="cfgMaxFile" type="number" min="1" max="100" value="10">
      </div>

      <div class="ferror" id="cfgError"></div>
      <div class="flex" style="justify-content:flex-end;margin-top:4px">
        <button class="btn btn-primary" onclick="guardarConfiguracion()">
          <i class="ph ph-floppy-disk"></i> Guardar configuración
        </button>
      </div>
    </div>

    <!-- ── POLÍTICA DE CONTRASEÑAS ── -->
    <div class="card mb16" id="cardPolitica" style="display:none">
      <div class="perfil-section-title">
        <i class="ph ph-lock-key" style="color:var(--green)"></i>
        Política de contraseñas
        <span class="badge bi" style="margin-left:auto">Solo Admin</span>
      </div>

      <div class="config-politica-grid">
        <div class="config-pol-item">
          <div>
            <div class="config-pol-label">Longitud mínima</div>
            <div class="config-pol-desc">Caracteres requeridos</div>
          </div>
          <input class="finput" id="polLong" type="number" min="4" max="32" value="8"
            style="width:70px;text-align:center">
        </div>
        <div class="config-pol-item">
          <div>
            <div class="config-pol-label">Requiere mayúsculas</div>
            <div class="config-pol-desc">Al menos una letra mayúscula</div>
          </div>
          <div class="toggle on" id="polMay" onclick="this.classList.toggle('on')"></div>
        </div>
        <div class="config-pol-item">
          <div>
            <div class="config-pol-label">Requiere números</div>
            <div class="config-pol-desc">Al menos un dígito</div>
          </div>
          <div class="toggle on" id="polNum" onclick="this.classList.toggle('on')"></div>
        </div>
        <div class="config-pol-item">
          <div>
            <div class="config-pol-label">Requiere símbolos</div>
            <div class="config-pol-desc">Al menos un carácter especial</div>
          </div>
          <div class="toggle" id="polSim" onclick="this.classList.toggle('on')"></div>
        </div>
        <div class="config-pol-item">
          <div>
            <div class="config-pol-label">Caducidad (días)</div>
            <div class="config-pol-desc">0 = sin caducidad</div>
          </div>
          <input class="finput" id="polCad" type="number" min="0" max="365" value="90"
            style="width:70px;text-align:center">
        </div>
      </div>

      <div class="flex" style="justify-content:flex-end;margin-top:16px">
        <button class="btn btn-primary" onclick="guardarPolitica()">
          <i class="ph ph-floppy-disk"></i> Guardar política
        </button>
      </div>
    </div>

    <!-- ── INFO DEL SISTEMA ── -->
    <div class="card">
      <div class="perfil-section-title">
        <i class="ph ph-info" style="color:var(--blue)"></i>
        Información del sistema
      </div>
      <div class="config-info-grid">
        <div class="config-info-item">
          <i class="ph ph-factory" style="color:var(--a)"></i>
          <div>
            <div class="config-info-label">Tema visual</div>
            <div class="config-info-val">3 estilos disponibles: Oscuro, Claro, Azul</div>
          </div>
        </div>
        <div class="config-info-item">
          <i class="ph ph-database" style="color:var(--green)"></i>
          <div>
            <div class="config-info-label">Base de datos</div>
            <div class="config-info-val">MongoDB Atlas — taskflow</div>
          </div>
        </div>
        <div class="config-info-item">
          <i class="ph ph-lightning" style="color:var(--amber)"></i>
          <div>
            <div class="config-info-label">Backend</div>
            <div class="config-info-val">FastAPI 0.115 · Python 3.12</div>
          </div>
        </div>
        <div class="config-info-item">
          <i class="ph ph-users" style="color:var(--purple)"></i>
          <div>
            <div class="config-info-label">Usuarios conectados</div>
            <div class="config-info-val" id="cfgUsersOnline">—</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>
`,
};
function cargarPaginas() {
  Object.entries(PAGINAS_HTML).forEach(([n, h]) => {
    const s = document.getElementById("slot-" + n);
    if (s) s.innerHTML = h;
  });
}
document.addEventListener("DOMContentLoaded", () => {
  cargarPaginas();
  document.dispatchEvent(new Event("taskflow:ready"));
});
