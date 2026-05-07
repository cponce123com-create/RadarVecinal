import { Router, type IRouter, type Response } from "express";
import { db } from "@workspace/db";
import { panicAlertsTable, missingPersonsTable, notificationsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// ── B-13: SSE client registry for real-time panic alerts ───────────────────
const sseClients = new Set<Response>();

export function broadcastPanicAlert(payload: object) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { sseClients.delete(res); }
  }
}

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

// B-13: SSE stream endpoint for real-time panic alerts
router.get("/panic-alerts/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(": connected\n\n");

  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(keepAlive); }
  }, 25000);

  sseClients.add(res);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

router.get("/panic-alerts", async (req, res) => {
  try {
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
    const formatted = formatPanic(alert);
    // B-13: Broadcast new alert to all SSE subscribers in real time
    broadcastPanicAlert({ type: "new_alert", alert: formatted });

    // B-16: Create notification for the new panic alert
    const typeLabels: Record<string, string> = {
      robbery: "Robo en curso",
      medical: "Emergencia médica",
      fight: "Pelea callejera",
      fire: "Incendio",
      missing_person: "Persona extraviada",
      other: "Alerta de pánico",
    };
    const label = typeLabels[data.type] ?? "Alerta de pánico";
    await db.insert(notificationsTable).values({
      type: "panic_alert",
      title: label,
      body: `${data.authorName} reportó: ${data.address || `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`}`,
      referenceId: String(alert.id),
      referenceType: "panic_alert",
      isRead: false,
    }).execute();

    res.status(201).json(formatted);
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
