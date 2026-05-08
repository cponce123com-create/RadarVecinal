import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reportsTable, panicAlertsTable, missingPersonsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/activity", async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit)) || 20;

    const reports = await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt)).limit(limit);
    const panics = await db.select().from(panicAlertsTable).orderBy(desc(panicAlertsTable.createdAt)).limit(5);
    const missing = await db.select().from(missingPersonsTable).orderBy(desc(missingPersonsTable.createdAt)).limit(5);

    const items = [
      ...reports.map(r => ({
        id: `report-${r.id}`,
        type: r.status === "resolved" ? "resolved" : "report",
        title: r.title,
        description: r.description.substring(0, 100),
        category: r.category,
        urgency: r.urgency,
        sector: r.sector,
        authorName: r.authorName,
        createdAt: r.createdAt.toISOString(),
      })),
      ...panics.map(a => ({
        id: `panic-${a.id}`,
        type: "panic",
        title: "Alerta de pánico",
        description: `Emergencia tipo: ${a.type}`,
        category: null,
        urgency: "critical",
        sector: a.sector,
        authorName: a.authorName,
        createdAt: a.createdAt.toISOString(),
      })),
      ...missing.map(m => ({
        id: `missing-${m.id}`,
        type: "missing",
        title: `Menor perdido: ${m.name}`,
        description: `Visto por última vez en ${m.lastSeenAddress}`,
        category: null,
        urgency: "high",
        sector: "Desconocido",
        authorName: m.reportedBy,
        createdAt: m.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "Failed to get activity");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
