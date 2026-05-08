"""
PATRÓN BRIDGE — Exportación de reportes
Separa la abstracción del reporte (qué exportar) de su implementación (cómo exportarlo).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from io import BytesIO, StringIO
import csv
import json
from typing import Any

from app.db.conexion import ConexionMongoDB
from app.services import servicio_reporte


class ExportadorImplementacion(ABC):
    @abstractmethod
    def exportar(self, reporte: dict[str, Any]) -> bytes:
        pass

    @abstractmethod
    def extension(self) -> str:
        pass

    @abstractmethod
    def mime_type(self) -> str:
        pass


class ReporteExportable(ABC):
    def __init__(self, exportador: ExportadorImplementacion):
        self.exportador = exportador

    def establecer_exportador(self, exportador: ExportadorImplementacion) -> None:
        self.exportador = exportador

    @abstractmethod
    async def construir_datos(self, proyecto_id: str, usuario: dict) -> dict[str, Any]:
        pass

    async def exportar(self, proyecto_id: str, usuario: dict) -> tuple[bytes, str, str]:
        datos = await self.construir_datos(proyecto_id, usuario)
        contenido = self.exportador.exportar(datos)
        return contenido, self.exportador.mime_type(), self._nombre_archivo(datos)

    def _nombre_archivo(self, datos: dict[str, Any]) -> str:
        marca = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        sufijo = datos.get("tipoReporte", "reporte")
        return f"{sufijo}_{marca}{self.exportador.extension()}"


class ReporteTareas(ReporteExportable):
    async def construir_datos(self, proyecto_id: str, usuario: dict) -> dict[str, Any]:
        db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
        proyecto = await db["proyectos"].find_one({"_id": proyecto_id})
        if not proyecto:
            raise ValueError("Proyecto no encontrado")
        if usuario.get("rol") != "ADMIN" and usuario["_id"] not in proyecto.get("miembros", []):
            raise PermissionError("Sin acceso al proyecto")

        metricas = await servicio_reporte.obtener_metricas_proyecto(proyecto_id)
        tareas = [t async for t in db["tareas"].find({"proyectoId": proyecto_id})]

        filas: list[dict[str, Any]] = []
        for tarea in tareas:
            filas.append(
                {
                    "id": tarea.get("_id"),
                    "titulo": tarea.get("titulo", ""),
                    "tipo": tarea.get("tipo", ""),
                    "prioridad": tarea.get("prioridad", ""),
                    "columnaId": tarea.get("columnaId", ""),
                    "responsables": ", ".join(tarea.get("responsables", [])),
                    "vencimiento": _formatear_fecha(tarea.get("fechaVencimiento")),
                }
            )

        return {
            "tipoReporte": "reporte_tareas",
            "titulo": f"Reporte de tareas - {proyecto.get('nombre', proyecto_id)}",
            "proyectoId": proyecto_id,
            "proyectoNombre": proyecto.get("nombre", proyecto_id),
            "generadoEn": datetime.now(timezone.utc).isoformat(),
            "resumen": {
                "totalTareas": metricas.get("totalTareas", 0),
                "tareasVencidas": metricas.get("tareasVencidas", 0),
                "tareasCompletadas": metricas.get("tareasCompletadas", 0),
                "progreso": metricas.get("progreso", 0),
            },
            "filas": filas,
        }


class ReporteAuditoria(ReporteExportable):
    async def construir_datos(self, proyecto_id: str, usuario: dict) -> dict[str, Any]:
        db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
        proyecto = await db["proyectos"].find_one({"_id": proyecto_id})
        if not proyecto:
            raise ValueError("Proyecto no encontrado")
        if usuario.get("rol") != "ADMIN" and usuario["_id"] not in proyecto.get("miembros", []):
            raise PermissionError("Sin acceso al proyecto")

        auditoria = await servicio_reporte.obtener_auditoria_proyecto(proyecto_id, pagina=1, limite=200)
        filas = []
        for r in auditoria.get("datos", []):
            filas.append(
                {
                    "accion": r.get("accion", ""),
                    "tipoEntidad": r.get("tipoEntidad", ""),
                    "entidadId": r.get("entidadId", ""),
                    "usuarioId": r.get("usuarioId", ""),
                    "marca": _formatear_fecha(r.get("marca")),
                }
            )

        return {
            "tipoReporte": "reporte_auditoria",
            "titulo": f"Reporte de auditoria - {proyecto.get('nombre', proyecto_id)}",
            "proyectoId": proyecto_id,
            "proyectoNombre": proyecto.get("nombre", proyecto_id),
            "generadoEn": datetime.now(timezone.utc).isoformat(),
            "resumen": {
                "totalRegistros": auditoria.get("total", len(filas)),
                "pagina": auditoria.get("pagina", 1),
                "limite": auditoria.get("limite", 200),
            },
            "filas": filas,
        }


class ReporteEquipo(ReporteExportable):
    async def construir_datos(self, proyecto_id: str, usuario: dict) -> dict[str, Any]:
        db = ConexionMongoDB.obtener_instancia().obtener_base_datos()
        proyecto = await db["proyectos"].find_one({"_id": proyecto_id})
        if not proyecto:
            raise ValueError("Proyecto no encontrado")
        if usuario.get("rol") != "ADMIN" and usuario["_id"] not in proyecto.get("miembros", []):
            raise PermissionError("Sin acceso al proyecto")

        metricas = await servicio_reporte.obtener_metricas_proyecto(proyecto_id)
        miembros = [u async for u in db["usuarios"].find({"_id": {"$in": proyecto.get("miembros", [])}})]
        por_usuario = metricas.get("tareasPorUsuario", {})
        filas = []
        for miembro in miembros:
            filas.append(
                {
                    "usuarioId": miembro.get("_id", ""),
                    "nombre": miembro.get("nombre", ""),
                    "email": miembro.get("email", ""),
                    "rol": miembro.get("rol", ""),
                    "tareasAsignadas": por_usuario.get(miembro.get("_id", ""), 0),
                }
            )

        return {
            "tipoReporte": "reporte_equipo",
            "titulo": f"Reporte de equipo - {proyecto.get('nombre', proyecto_id)}",
            "proyectoId": proyecto_id,
            "proyectoNombre": proyecto.get("nombre", proyecto_id),
            "generadoEn": datetime.now(timezone.utc).isoformat(),
            "resumen": {
                "totalMiembros": len(filas),
                "totalTareas": metricas.get("totalTareas", 0),
                "progreso": metricas.get("progreso", 0),
            },
            "filas": filas,
        }


class ExportadorJSON(ExportadorImplementacion):
    def exportar(self, reporte: dict[str, Any]) -> bytes:
        return json.dumps(reporte, ensure_ascii=False, indent=2, default=str).encode("utf-8")

    def extension(self) -> str:
        return ".json"

    def mime_type(self) -> str:
        return "application/json"


class ExportadorCSV(ExportadorImplementacion):
    def exportar(self, reporte: dict[str, Any]) -> bytes:
        out = StringIO()
        writer = csv.writer(out)
        writer.writerow(["titulo", reporte.get("titulo", "")])
        writer.writerow(["proyecto", reporte.get("proyectoNombre", "")])
        writer.writerow(["generadoEn", reporte.get("generadoEn", "")])
        writer.writerow([])
        for k, v in (reporte.get("resumen") or {}).items():
            writer.writerow([k, v])
        writer.writerow([])

        filas = reporte.get("filas", [])
        if filas:
            headers = list(filas[0].keys())
            writer.writerow(headers)
            for fila in filas:
                writer.writerow([fila.get(h, "") for h in headers])
        else:
            writer.writerow(["sin_datos"])

        return out.getvalue().encode("utf-8")

    def extension(self) -> str:
        return ".csv"

    def mime_type(self) -> str:
        return "text/csv; charset=utf-8"


class ExportadorPDF(ExportadorImplementacion):
    def exportar(self, reporte: dict[str, Any]) -> bytes:
        return _crear_pdf_reporte_estilizado(reporte)

    def extension(self) -> str:
        return ".pdf"

    def mime_type(self) -> str:
        return "application/pdf"


def _formatear_fecha(valor: Any) -> str:
    if not valor:
        return ""
    if isinstance(valor, datetime):
        return valor.astimezone(timezone.utc).isoformat()
    return str(valor)


"""
MEJORA: _crear_pdf_reporte_estilizado
Reemplazar la función en backend/app/patterns/bridge/puente_exportacion.py
PDF con diseño profesional: portada, paleta de colores corporativa TaskFlow,
tipografía limpia y tarjetas de datos bien estructuradas.
"""

def _crear_pdf_reporte_estilizado(reporte: dict) -> bytes:
    """
    Genera un PDF de alta calidad con:
    - Portada con degradado corporativo y logo textual
    - Sección de resumen con indicadores visuales
    - Tabla de datos con zebra striping
    - Footer con numeración de página
    """
    from io import BytesIO

    # ── Colores corporativos TaskFlow ──────────────────────────────────────
    # Azul oscuro: 0.08 0.17 0.33 (rgb 20 44 85)
    # Azul medio: 0.10 0.31 0.54 (rgb 26 79 138)
    # Acento violeta: 0.42 0.39 1.0 (rgb 108 99 255)
    # Verde: 0.24 0.81 0.56 (rgb 62 207 142)
    # Rojo: 0.97 0.27 0.27 (rgb 248 68 68)
    # Ámbar: 0.96 0.73 0.14 (rgb 245 188 36)
    # Texto oscuro: 0.09 0.09 0.10
    # Texto claro: 0.62 0.62 0.66
    # Fondo: 0.97 0.97 0.98

    def esc(s: str) -> str:
        return str(s).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").replace("\n", " ")

    def color_prioridad(prio: str) -> tuple:
        """Devuelve (r, g, b) según prioridad."""
        m = {
            "URGENTE": (0.97, 0.27, 0.27),
            "ALTA":    (0.96, 0.45, 0.18),
            "MEDIA":   (0.96, 0.73, 0.14),
            "BAJA":    (0.24, 0.81, 0.56),
        }
        return m.get(str(prio).upper(), (0.62, 0.62, 0.66))

    def color_tipo(tipo: str) -> tuple:
        m = {
            "BUG":         (0.97, 0.27, 0.27),
            "FEATURE":     (0.37, 0.65, 0.98),
            "TASK":        (0.62, 0.62, 0.66),
            "IMPROVEMENT": (0.24, 0.81, 0.56),
        }
        return m.get(str(tipo).upper(), (0.62, 0.62, 0.66))

    titulo      = str(reporte.get("titulo", "Reporte TaskFlow"))
    proyecto    = str(reporte.get("proyectoNombre", ""))
    generado    = str(reporte.get("generadoEn", ""))[:19].replace("T", " ")
    tipo_rep    = str(reporte.get("tipoReporte", "reporte"))
    resumen     = reporte.get("resumen") or {}
    filas       = reporte.get("filas", [])

    # Tipo legible
    tipo_labels = {
        "reporte_tareas":    "Reporte de Tareas",
        "reporte_auditoria": "Auditoría del Proyecto",
        "reporte_equipo":    "Métricas del Equipo",
    }
    tipo_str = tipo_labels.get(tipo_rep, tipo_rep.replace("_", " ").title())

    cmds: list[str] = []

    # ── PORTADA / HEADER ─────────────────────────────────────────────────
    # Fondo completo de página
    cmds += ["q", "0.97 0.97 0.98 rg", "0 0 595 842 re f", "Q"]

    # Banda superior con degradado simulado (bloques de color)
    for i, alpha in enumerate([1.0, 0.92, 0.85, 0.78, 0.70, 0.62, 0.54, 0.46, 0.38, 0.30]):
        y = 750 + i * 9.2
        h = 9.5
        # Mezcla de azul oscuro y violeta
        r = 0.08 + i * 0.034
        g = 0.17 + i * 0.022
        b = 0.33 + i * 0.067
        cmds += ["q", f"{r:.3f} {g:.3f} {b:.3f} rg", f"0 {y:.1f} 595 {h:.1f} re f", "Q"]

    # Banda sólida superior
    cmds += ["q", "0.08 0.17 0.33 rg", "0 800 595 42 re f", "Q"]

    # Línea de acento violeta
    cmds += ["q", "0.42 0.39 1.0 rg", "0 798 595 3 re f", "Q"]

    # Logo textual en banda
    cmds += [
        "BT", "/F2 15 Tf", "1 1 1 rg",
        "38 817 Td", f"(TaskFlow) Tj", "ET",
    ]
    # Subtítulo tipo en banda
    cmds += [
        "BT", "/F1 8 Tf", "0.62 0.72 0.90 rg",
        "38 808 Td", f"({esc(tipo_str)}) Tj", "ET",
    ]
    # Fecha en banda (derecha)
    cmds += [
        "BT", "/F1 7 Tf", "0.62 0.72 0.90 rg",
        "430 817 Td", f"(Generado: {esc(generado)}) Tj", "ET",
    ]

    # ── TÍTULO PRINCIPAL ─────────────────────────────────────────────────
    titulo_short = titulo[:68] if len(titulo) > 68 else titulo
    cmds += [
        "BT", "/F2 16 Tf", "0.08 0.17 0.33 rg",
        "38 756 Td", f"({esc(titulo_short)}) Tj", "ET",
    ]
    if proyecto:
        cmds += [
            "BT", "/F1 9 Tf", "0.42 0.42 0.50 rg",
            "38 742 Td", f"(Proyecto: {esc(proyecto)}) Tj", "ET",
        ]

    # Línea divisoria
    cmds += ["q", "0.88 0.88 0.92 RG", "0.5 w",
             "38 735 m", "557 735 l", "S", "Q"]

    # ── RESUMEN ───────────────────────────────────────────────────────────
    y = 718
    cmds += [
        "BT", "/F2 9 Tf", "0.42 0.42 0.50 rg",
        f"38 {y} Td", "(RESUMEN EJECUTIVO) Tj", "ET",
    ]
    y -= 12

    resumen_items = list(resumen.items())
    # Dibuja los KPI como "chips" en fila
    chip_x = 38
    chip_y = y
    chip_h = 40
    chip_gap = 8
    chip_w = min(120, max(80, (519 - chip_gap * (len(resumen_items) - 1)) // max(1, len(resumen_items))))

    # Colores para chips de KPI
    kpi_colors = [
        (0.42, 0.39, 1.0),   # violeta
        (0.24, 0.81, 0.56),  # verde
        (0.96, 0.73, 0.14),  # ámbar
        (0.37, 0.65, 0.98),  # azul
        (0.97, 0.27, 0.27),  # rojo
    ]
    for idx, (k, v) in enumerate(resumen_items[:5]):
        cx = chip_x + idx * (chip_w + chip_gap)
        cr, cg, cb = kpi_colors[idx % len(kpi_colors)]
        # Fondo del chip
        cmds += [
            "q",
            f"{cr:.3f} {cg:.3f} {cb:.3f} rg",
            f"{cx} {chip_y} {chip_w} {chip_h} re f",
            "Q",
        ]
        # Franja inferior más oscura
        cmds += [
            "q",
            f"{cr*0.7:.3f} {cg*0.7:.3f} {cb*0.7:.3f} rg",
            f"{cx} {chip_y} {chip_w} 5 re f",
            "Q",
        ]
        # Valor
        val_str = str(v)[:8]
        cmds += [
            "BT", "/F2 13 Tf", "1 1 1 rg",
            f"{cx+8} {chip_y+22} Td", f"({esc(val_str)}) Tj", "ET",
        ]
        # Label
        label_str = str(k)[:16]
        cmds += [
            "BT", "/F1 7 Tf", "0.90 0.90 0.95 rg",
            f"{cx+8} {chip_y+10} Td", f"({esc(label_str)}) Tj", "ET",
        ]

    y = chip_y - 18

    # Línea divisoria
    cmds += ["q", "0.88 0.88 0.92 RG", "0.5 w",
             "38 " + str(y + 4) + " m", "557 " + str(y + 4) + " l", "S", "Q"]
    y -= 8

    # ── SECCIÓN DETALLE ──────────────────────────────────────────────────
    cmds += [
        "BT", "/F2 9 Tf", "0.42 0.42 0.50 rg",
        f"38 {y} Td", "(DETALLE DE REGISTROS) Tj", "ET",
    ]
    y -= 14

    if not filas:
        cmds += [
            "BT", "/F1 9 Tf", "0.62 0.62 0.66 rg",
            f"38 {y} Td", "(Sin registros disponibles para este reporte.) Tj", "ET",
        ]
    else:
        # Cabecera de tabla
        headers = list(filas[0].keys()) if filas else []
        # Calcular anchos de columna
        n_cols = len(headers)
        table_w = 519
        col_w = table_w // max(1, n_cols)

        # Header row
        cmds += [
            "q", "0.08 0.17 0.33 rg",
            f"38 {y-3} {table_w} 16 re f", "Q",
        ]
        for ci, h in enumerate(headers[:8]):
            hx = 38 + ci * col_w
            cmds += [
                "BT", "/F2 7 Tf", "0.85 0.90 0.98 rg",
                f"{hx+4} {y+1} Td", f"({esc(str(h)[:14])}) Tj", "ET",
            ]
        y -= 18

        # Filas de datos
        for ri, fila in enumerate(filas[:26]):
            if y < 60:
                break
            # Zebra
            if ri % 2 == 0:
                cmds += [
                    "q", "0.94 0.94 0.96 rg",
                    f"38 {y-3} {table_w} 14 re f", "Q",
                ]

            vals = list(fila.values())
            for ci, val in enumerate(vals[:8]):
                vx = 38 + ci * col_w
                val_str = str(val or "")[:18]
                # Color especial para prioridad
                col_key = str(headers[ci]).lower() if ci < len(headers) else ""
                if "prioridad" in col_key or "priority" in col_key:
                    r2, g2, b2 = color_prioridad(val_str)
                    cmds += [
                        "q",
                        f"{r2:.3f} {g2:.3f} {b2:.3f} rg",
                        f"{vx+3} {y-1} {min(col_w-6, len(val_str)*5+8)} 11 re f",
                        "Q",
                        "BT", "/F2 6.5 Tf", "1 1 1 rg",
                        f"{vx+6} {y+1} Td", f"({esc(val_str)}) Tj", "ET",
                    ]
                elif "tipo" in col_key or "type" in col_key:
                    r2, g2, b2 = color_tipo(val_str)
                    cmds += [
                        "q",
                        f"{r2:.3f} {g2:.3f} {b2:.3f} rg",
                        f"{vx+3} {y-1} {min(col_w-6, len(val_str)*5+8)} 11 re f",
                        "Q",
                        "BT", "/F2 6.5 Tf", "1 1 1 rg",
                        f"{vx+6} {y+1} Td", f"({esc(val_str)}) Tj", "ET",
                    ]
                else:
                    cmds += [
                        "BT", "/F1 7.5 Tf", "0.15 0.15 0.18 rg",
                        f"{vx+4} {y+1} Td", f"({esc(val_str)}) Tj", "ET",
                    ]
            y -= 14

        if len(filas) > 26 and y > 50:
            resto = len(filas) - 26
            cmds += [
                "BT", "/F1 7 Tf", "0.62 0.62 0.66 rg",
                f"38 {y-4} Td", f"(... y {resto} registro(s) adicional(es) omitidos para mantener legibilidad.) Tj",
                "ET",
            ]

    # ── FOOTER ───────────────────────────────────────────────────────────
    cmds += [
        "q", "0.08 0.17 0.33 rg", "0 0 595 28 re f", "Q",
        "q", "0.42 0.39 1.0 rg", "0 28 595 2 re f", "Q",
        "BT", "/F1 7 Tf", "0.62 0.72 0.90 rg",
        "38 10 Td", "(TaskFlow — Documento generado automaticamente. No requiere firma.) Tj",
        "ET",
        "BT", "/F1 7 Tf", "0.62 0.72 0.90 rg",
        "510 10 Td", "(Pag. 1) Tj",
        "ET",
    ]

    # ── ENSAMBLAR PDF ────────────────────────────────────────────────────
    stream = "\n".join(cmds).encode("latin-1", errors="replace")

    objects: list[bytes] = []
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objects.append(
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n"
    )
    objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    objects.append(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")
    objects.append(
        f"6 0 obj\n<< /Length {len(stream)} >>\nstream\n".encode("ascii")
        + stream
        + b"\nendstream\nendobj\n"
    )

    output = BytesIO()
    output.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for obj in objects:
        offsets.append(output.tell())
        output.write(obj)

    xref_start = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    output.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        output.write(f"{off:010d} 00000 n \n".encode("ascii"))
    output.write(
        (
            "trailer\n"
            f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref_start}\n"
            "%%EOF\n"
        ).encode("ascii")
    )
    return output.getvalue()


def _envolver_texto(texto: str, ancho: int) -> list[str]:
    if len(texto) <= ancho:
        return [texto]
    palabras = texto.split(" ")
    lineas: list[str] = []
    actual = ""
    for palabra in palabras:
        candidato = palabra if not actual else f"{actual} {palabra}"
        if len(candidato) <= ancho:
            actual = candidato
            continue
        if actual:
            lineas.append(actual)
        actual = palabra
    if actual:
        lineas.append(actual)
    return lineas

