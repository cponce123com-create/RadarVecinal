import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reportsTable, panicAlertsTable, missingPersonsTable } from "@workspace/db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalRow] = await db.select({ count: sql<number>`count(*)` }).from(reportsTable);
    const [activeAlertsRow] = await db.select({ count: sql<number>`count(*)` }).from(panicAlertsTable).where(eq(panicAlertsTable.isActive, true));
    const [todayRow] = await db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(gte(reportsTable.createdAt, today));
    const [resolvedTodayRow] = await db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(and(eq(reportsTable.status, "resolved"), gte(reportsTable.updatedAt, today)));

    const byCategory = await db.select({
      category: reportsTable.category,
      count: sql<number>`count(*)`
    }).from(reportsTable).groupBy(reportsTable.category);

    const byStatus = await db.select({
      status: reportsTable.status,
      count: sql<number>`count(*)`
    }).from(reportsTable).groupBy(reportsTable.status);

    const topSectors = await db.select({
      sector: reportsTable.sector,
      count: sql<number>`count(*)`
    }).from(reportsTable).groupBy(reportsTable.sector).orderBy(desc(sql`count(*)`)).limit(5);

    const criticalZone = topSectors[0]?.sector ?? "Sin datos";

    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const [row] = await db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(and(gte(reportsTable.createdAt, dayStart)));
      const dayName = dayStart.toLocaleDateString("es-PE", { weekday: "short" });
      weeklyTrend.push({ day: dayName, count: Number(row?.count ?? 0) });
    }

    res.json({
      totalReports: Number(totalRow?.count ?? 0),
      activeAlerts: Number(activeAlertsRow?.count ?? 0),
      todayIncidents: Number(todayRow?.count ?? 0),
      resolvedToday: Number(resolvedTodayRow?.count ?? 0),
      criticalZone,
      reportsByCategory: byCategory.map(r => ({ category: r.category, count: Number(r.count) })),
      reportsByStatus: byStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      weeklyTrend,
      topSectors: topSectors.map(r => ({ sector: r.sector, count: Number(r.count) })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
