import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reportsTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const router: IRouter = Router();

function formatReport(r: typeof reportsTable.$inferSelect) {
  return {
    id: String(r.id),
    title: r.title,
    description: r.description,
    category: r.category,
    urgency: r.urgency,
    status: r.status,
    isAnonymous: r.isAnonymous,
    latitude: r.latitude,
    longitude: r.longitude,
    address: r.address,
    sector: r.sector,
    imageUrl: r.imageUrl ?? null,
    authorName: r.authorName,
    confirmedCount: r.confirmedCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/reports", async (req, res) => {
  try {
    const conditions = [];
    if (req.query.category) conditions.push(eq(reportsTable.category, req.query.category as string));
    if (req.query.status) conditions.push(eq(reportsTable.status, req.query.status as string));
    if (req.query.urgency) conditions.push(eq(reportsTable.urgency, req.query.urgency as string));
    if (req.query.sector) conditions.push(eq(reportsTable.sector, req.query.sector as string));

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const reports = await db.select().from(reportsTable).where(where).orderBy(desc(reportsTable.createdAt)).limit(limit).offset(offset);
    const total = await db.select({ count: sql<number>`count(*)` }).from(reportsTable).where(where);

    res.json({ reports: reports.map(formatReport), total: Number(total[0]?.count ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to get reports");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reports", async (req, res) => {
  try {
    const data = req.body;
    const [report] = await db.insert(reportsTable).values({
      title: data.title,
      description: data.description,
      category: data.category,
      urgency: data.urgency,
      isAnonymous: data.isAnonymous ?? false,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? "",
      sector: data.sector,
      imageUrl: data.imageUrl ?? null,
      authorName: data.authorName,
      confirmedCount: 0,
    }).returning();
    res.status(201).json(formatReport(report));
  } catch (err) {
    req.log.error({ err }, "Failed to create report");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reports/:id", async (req, res) => {
  try {
    const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, parseInt(req.params.id)));
    if (!report) return res.status(404).json({ error: "Not found" });
    res.json(formatReport(report));
  } catch (err) {
    req.log.error({ err }, "Failed to get report");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/reports/:id", async (req, res) => {
  try {
    const data = req.body;
    const updates: Partial<typeof reportsTable.$inferInsert> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.title !== undefined) updates.title = data.title;
    if (data.description !== undefined) updates.description = data.description;
    updates.updatedAt = new Date();

    const [report] = await db.update(reportsTable).set(updates).where(eq(reportsTable.id, parseInt(req.params.id))).returning();
    if (!report) return res.status(404).json({ error: "Not found" });
    res.json(formatReport(report));
  } catch (err) {
    req.log.error({ err }, "Failed to update report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
