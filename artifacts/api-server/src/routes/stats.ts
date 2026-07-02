import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reportsTable, panicAlertsTable, missingPersonsTable } from "@workspace/db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { optionalAuth } from "./auth";

const router: IRouter = Router();

// ── Helper: obtener districtId del request ──────────────────────────────────
function getDistrictId(req: any): number | null {
  const user = req.jwtUser;
  if (user?.districtId && user.role !== "super_admin") return Number(user.districtId);
  const q = req.query.districtId;
  if (q) return Number(q);
  return null;
}

// ── M-01/M-10: GET /stats — filtrado por distrito ──────────────────────────
router.get("/stats", optionalAuth, async (req, res) => {
  try {
    const districtId = getDistrictId(req);
    const baseFilter = districtId
      ? and(eq(reportsTable.districtId, districtId))
      : undefined;

    const panicFilter = districtId
      ? and(eq(panicAlertsTable.districtId, districtId))
      : undefined;

    const missingFilter = districtId
      ? and(eq(missingPersonsTable.districtId, districtId))
      : undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      [{ count: totalReports }],
      [{ count: activeAlerts }],
      [{ count: todayIncidents }],
      [{ count: resolvedToday }],
      reportsByCategory,
      reportsByStatus,
      topSectors,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(baseFilter ?? sql`TRUE`),
      db.select({ count: sql<number>`count(*)` }).from(reportsTable)
        .where(and(baseFilter ?? sql`TRUE`, eq(reportsTable.status, "active"))),
      db.select({ count: sql<number>`count(*)` }).from(reportsTable)
        .where(and(baseFilter ?? sql`TRUE`, gte(reportsTable.createdAt, today))),
      db.select({ count: sql<number>`count(*)` }).from(reportsTable)
        .where(and(baseFilter ?? sql`TRUE`, eq(reportsTable.status, "resolved"), gte(reportsTable.updatedAt, today))),
      db.select({ category: reportsTable.category, count: sql<number>`count(*)` })
        .from(reportsTable)
        .where(baseFilter ?? sql`TRUE`)
        .groupBy(reportsTable.category)
        .orderBy(sql`count(*) desc`),
      db.select({ status: reportsTable.status, count: sql<number>`count(*)` })
        .from(reportsTable)
        .where(baseFilter ?? sql`TRUE`)
        .groupBy(reportsTable.status)
        .orderBy(sql`count(*) desc`),
      db.select({ sector: reportsTable.sector, count: sql<number>`count(*)` })
        .from(reportsTable)
        .where(baseFilter ?? sql`TRUE`)
        .groupBy(reportsTable.sector)
        .orderBy(sql`count(*) desc`)
        .limit(5),
    ]);

    // M-10: Cache-friendly: weekly trend con una sola query agrupada por día
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const weeklyRaw = await db.select({
      day: sql<string>`to_char(${reportsTable.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
      .from(reportsTable)
      .where(and(baseFilter ?? sql`TRUE`, gte(reportsTable.createdAt, sevenDaysAgo)))
      .groupBy(sql`to_char(${reportsTable.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${reportsTable.createdAt}, 'YYYY-MM-DD')`);

    // Rellenar días sin reportes con 0
    const weeklyTrend: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dayStr = d.toISOString().slice(0, 10);
      const found = weeklyRaw.find(w => w.day === dayStr);
      weeklyTrend.push({ day: dayStr, count: found ? Number(found.count) : 0 });
    }

    // Determinar zona crítica
    const topCat = reportsByCategory[0];
    const criticalZone = topCat ? `${topCat.category} (${topCat.count})` : "Ninguna";

    return res.json({
      totalReports: Number(totalReports),
      activeAlerts: Number(activeAlerts),
      todayIncidents: Number(todayIncidents),
      resolvedToday: Number(resolvedToday),
      criticalZone,
      reportsByCategory: reportsByCategory.map(r => ({ category: r.category, count: Number(r.count) })),
      reportsByStatus: reportsByStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      weeklyTrend,
      topSectors: topSectors.map(r => ({ sector: r.sector, count: Number(r.count) })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
