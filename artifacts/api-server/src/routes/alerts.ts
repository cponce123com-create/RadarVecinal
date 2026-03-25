import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { panicAlertsTable, missingPersonsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

function formatPanic(a: typeof panicAlertsTable.$inferSelect) {
  return {
    id: String(a.id),
    type: a.type,
    latitude: a.latitude,
    longitude: a.longitude,
    address: a.address,
    authorName: a.authorName,
    sector: a.sector,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
  };
}

function formatMissing(m: typeof missingPersonsTable.$inferSelect) {
  return {
    id: String(m.id),
    name: m.name,
    age: m.age ?? null,
    clothing: m.clothing,
    photoUrl: m.photoUrl ?? null,
    lastSeenLatitude: m.lastSeenLatitude,
    lastSeenLongitude: m.lastSeenLongitude,
    lastSeenAddress: m.lastSeenAddress,
    lastSeenAt: m.lastSeenAt.toISOString(),
    contactInfo: m.contactInfo,
    status: m.status,
    reportedBy: m.reportedBy,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/panic-alerts", async (req, res) => {
  try {
    const conditions = [];
    if (req.query.active === "true") conditions.push(eq(panicAlertsTable.isActive, true));
    const alerts = await db.select().from(panicAlertsTable).orderBy(desc(panicAlertsTable.createdAt)).limit(50);
    res.json({ alerts: alerts.map(formatPanic) });
  } catch (err) {
    req.log.error({ err }, "Failed to get panic alerts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/panic-alerts", async (req, res) => {
  try {
    const data = req.body;
    const [alert] = await db.insert(panicAlertsTable).values({
      type: data.type,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? "",
      authorName: data.authorName,
      sector: data.sector,
      isActive: true,
    }).returning();
    res.status(201).json(formatPanic(alert));
  } catch (err) {
    req.log.error({ err }, "Failed to create panic alert");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/missing-persons", async (req, res) => {
  try {
    const persons = await db.select().from(missingPersonsTable).orderBy(desc(missingPersonsTable.createdAt));
    res.json({ alerts: persons.map(formatMissing) });
  } catch (err) {
    req.log.error({ err }, "Failed to get missing persons");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/missing-persons", async (req, res) => {
  try {
    const data = req.body;
    const [person] = await db.insert(missingPersonsTable).values({
      name: data.name,
      age: data.age ?? null,
      clothing: data.clothing,
      photoUrl: data.photoUrl ?? null,
      lastSeenLatitude: data.lastSeenLatitude,
      lastSeenLongitude: data.lastSeenLongitude,
      lastSeenAddress: data.lastSeenAddress,
      lastSeenAt: new Date(data.lastSeenAt),
      contactInfo: data.contactInfo,
      status: "active",
      reportedBy: data.reportedBy,
    }).returning();
    res.status(201).json(formatMissing(person));
  } catch (err) {
    req.log.error({ err }, "Failed to create missing person alert");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/missing-persons/:id", async (req, res) => {
  try {
    const data = req.body;
    const updates: Partial<typeof missingPersonsTable.$inferInsert> = {};
    if (data.status !== undefined) updates.status = data.status;
    if (data.clothing !== undefined) updates.clothing = data.clothing;
    if (data.photoUrl !== undefined) updates.photoUrl = data.photoUrl;

    const [person] = await db.update(missingPersonsTable).set(updates).where(eq(missingPersonsTable.id, parseInt(req.params.id))).returning();
    if (!person) return res.status(404).json({ error: "Not found" });
    res.json(formatMissing(person));
  } catch (err) {
    req.log.error({ err }, "Failed to update missing person");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
