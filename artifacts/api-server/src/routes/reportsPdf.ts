/**
 * reports-pdf.ts — Exportar reportes a PDF (inspirado en Tancítaro)
 * Usa pdfkit para generar PDF server-side, sin dependencias de browser.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { reportsTable, districtsTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "./auth";
import { getDistrictId } from "./tenant";
import PDFDocument from "pdfkit";

const router = Router();

const CAT_LABELS: Record<string, string> = {
  robbery: "Robo", fight: "Pelea", suspicious: "Sospechoso", water_cut: "Corte de agua",
  garbage: "Basura", noise: "Ruido", missing_person: "Desaparecido", fire: "Incendio",
  medical_emergency: "Emergencia médica", other: "Otro",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Activo", reviewing: "En Revisión", resolved: "Resuelto", archived: "Archivado",
};

// ── GET /reports/export/pdf — descargar PDF con reportes del distrito ──────
router.get("/reports/export/pdf", requireAuth, requireAdmin, async (req, res) => {
  try {
    const districtId = getDistrictId(req);
    let districtName = "Todos los distritos";
    let districtSlug = "todos";

    if (districtId) {
      const [district] = await db.select().from(districtsTable).where(eq(districtsTable.id, districtId)).limit(1);
      if (district) {
        districtName = district.name;
        districtSlug = district.slug;
      }
    }

    const reports = await db.select().from(reportsTable)
      .where(districtId ? eq(reportsTable.districtId, districtId) : undefined)
      .orderBy(desc(reportsTable.createdAt))
      .limit(100);

    // Stats
    const total = reports.length;
    const resolved = reports.filter(r => r.status === "resolved").length;
    const byCategory: Record<string, number> = {};
    reports.forEach(r => { byCategory[r.category] = (byCategory[r.category] || 0) + 1; });

    // Generar PDF
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"reportes-${districtSlug}-${new Date().toISOString().slice(0, 10)}.pdf\"`);
    doc.pipe(res);

    // Header
    doc.fontSize(18).font("Helvetica-Bold").text(`Reportes Ciudadanos - ${districtName}`, { align: "center" });
    doc.fontSize(9).font("Helvetica").fillColor("#64748b").text(`Generado el ${new Date().toLocaleDateString("es-PE")} · ${total} reportes`, { align: "center" });
    doc.moveDown(0.8);

    // Resumen
    doc.fillColor("#1e293b").fontSize(11).font("Helvetica-Bold").text("Resumen");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#334155");
    doc.text(`Total: ${total}  |  Resueltos: ${resolved}  |  Pendientes: ${total - resolved}`);
    doc.moveDown(0.3);
    doc.text("Por categoría:");
    Object.entries(byCategory)
      .sort(([,a], [,b]) => b - a)
      .forEach(([cat, count]) => {
        const pct = Math.round((count / total) * 100);
        doc.text(`  • ${CAT_LABELS[cat] ?? cat}: ${count} (${pct}%)`);
      });
    doc.moveDown(0.8);

    // Listado de reportes
    doc.fillColor("#1e293b").fontSize(11).font("Helvetica-Bold").text("Detalle de reportes");
    doc.moveDown(0.3);

    reports.forEach((r, i) => {
      // Check page break
      if (doc.y > 680) {
        doc.addPage();
      }

      doc.fillColor("#1e293b").fontSize(10).font("Helvetica-Bold")
        .text(`${i + 1}. ${r.title}`);
      doc.fontSize(8.5).font("Helvetica").fillColor("#64748b");
      doc.text(`${CAT_LABELS[r.category] ?? r.category} · ${r.sector} · ${STATUS_LABELS[r.status] ?? r.status} · ${new Date(r.createdAt).toLocaleDateString("es-PE")}`);
      if (r.description) {
        doc.fillColor("#475569").text(r.description.slice(0, 200), { indent: 10 });
      }
      doc.moveDown(0.4);
    });

    // Footer
    doc.fontSize(8).fillColor("#94a3b8").text("— Radar Vecinal · radarvecinal.pe —", { align: "center" });

    doc.end();
  } catch (err) {
    req.log.error({ err }, "Failed to export PDF");
    res.status(500).json({ error: "Error al generar PDF" });
  }
});

export default router;
