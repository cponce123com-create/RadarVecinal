import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  reportsTable,
  panicAlertsTable,
  missingPersonsTable,
} from "@workspace/db/schema";
import { desc, eq, and, sql, type SQL } from "drizzle-orm";
import { optionalAuth } from "./auth";
import { getDistrictId } from "./tenant";

const router: IRouter = Router();

// ── M-01: GET /activity — filtrado por distrito ────────────────────────────
router.get("/activity", optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const districtId = getDistrictId(req);

    const filter = districtId
      ? <T extends { districtId: SQL | unknown }>(table: T): SQL | undefined =>
          and(eq(table.districtId as any, districtId))
      : (): undefined => undefined;

    const [reports, panics, missing] = await Promise.all([
      db
        .select({
          id: reportsTable.id,
          type: sql<"report">`'report'`,
          title: reportsTable.title,
          description: reportsTable.description,
          category: reportsTable.category,
          urgency: reportsTable.urgency,
          sector: reportsTable.sector,
          authorName: reportsTable.authorName,
          createdAt: reportsTable.createdAt,
        })
        .from(reportsTable)
        .where(filter(reportsTable) ?? sql`TRUE`)
        .orderBy(desc(reportsTable.createdAt))
        .limit(limit),

      db
        .select({
          id: panicAlertsTable.id,
          type: sql<"panic">`'panic'`,
          title: panicAlertsTable.type,
          description: sql<string>`''`,
          category: sql<string | null>`NULL`,
          urgency: sql<string | null>`NULL`,
          sector: panicAlertsTable.sector,
          authorName: panicAlertsTable.authorName,
          createdAt: panicAlertsTable.createdAt,
        })
        .from(panicAlertsTable)
        .where(filter(panicAlertsTable) ?? sql`TRUE`)
        .orderBy(desc(panicAlertsTable.createdAt))
        .limit(limit),

      db
        .select({
          id: missingPersonsTable.id,
          type: sql<"missing">`'missing'`,
          title: missingPersonsTable.name,
          description: missingPersonsTable.clothing,
          category: sql<string | null>`NULL`,
          urgency: sql<string | null>`NULL`,
          sector: sql<string>`''`,
          authorName: missingPersonsTable.reportedBy,
          createdAt: missingPersonsTable.createdAt,
        })
        .from(missingPersonsTable)
        .where(filter(missingPersonsTable) ?? sql`TRUE`)
        .orderBy(desc(missingPersonsTable.createdAt))
        .limit(limit),
    ]);

    const items = [...reports, ...panics, ...missing]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);

    return res.json({
      items: items.map((i) => ({
        ...i,
        id: String(i.id),
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get activity");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
