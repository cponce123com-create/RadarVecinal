import { Router, type IRouter, type Response } from "express";
import { db } from "@workspace/db";
import {
  panicAlertsTable,
  missingPersonsTable,
  notificationsTable,
  districtsTable,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, optionalAuth } from "./auth";
import { getDistrictId } from "./tenant";

const router: IRouter = Router();

// ── Almacenar clientes SSE con su districtId ────────────────────────────────
interface SseClient {
  id: string;
  res: Response;
  districtId: number;
}

let sseClients: SseClient[] = [];

// ── M-02: Broadcast de alerta solo a clientes del mismo distrito ────────────
export function broadcastPanicAlert(alert: any) {
  const alertDistrictId = Number(alert.districtId);
  const body = `data: ${JSON.stringify({ ...alert, id: String(alert.id), createdAt: alert.createdAt?.toISO?.() ?? alert.createdAt })}

`;
  sseClients.forEach(client => {
    if (client.districtId === alertDistrictId) {
      client.res.write(body);
    }
  });
}

// ── GET /panic-alerts/stream — M-02: SSE filtrado por distrito ──────────────
router.get("/panic-alerts/stream", (req, res) => {
  const districtId = parseInt(req.query.districtId as string);
  if (!districtId) {
    res.status(400).json({ error: "Se requiere districtId para conectar al stream." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write("data: " + JSON.stringify({ connected: true }) + "\n\n");

  const client: SseClient = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    res,
    districtId,
  };
  sseClients.push(client);

  req.on("close", () => {
    sseClients = sseClients.filter(c => c.id !== client.id);
  });
});

// ── M-01: GET /panic-alerts ─────────────────────────────────────────────────
router.get("/panic-alerts", optionalAuth, async (req, res) => {
  try {
    const { active } = req.query;
    const districtId = getDistrictId(req);
    if (!districtId) {
      return res.status(400).json({ error: "Se requiere distrito (districtId)." });
    }

    const conditions = [eq(panicAlertsTable.districtId, districtId)];
    if (active !== undefined) {
      conditions.push(eq(panicAlertsTable.isActive, active === "true"));
    }

    const alerts = await db.select()
      .from(panicAlertsTable)
      .where(and(...conditions))
      .orderBy(desc(panicAlertsTable.createdAt))
      .limit(50);

    return res.json({
      alerts: alerts.map(a => ({
        ...a,
        id: String(a.id),
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get panic alerts");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /panic-alerts ─────────────────────────────────────────────────────
router.post("/panic-alerts", optionalAuth, async (req, res) => {
  const { type, latitude, longitude, address, authorName, sector, districtId: bodyDistrictId } = req.body;
  const user = (req as any).jwtUser;

  let districtId: number;
  if (user?.districtId && user.role !== "super_admin") {
    districtId = Number(user.districtId);
  } else if (bodyDistrictId) {
    districtId = Number(bodyDistrictId);
  } else {
    return res.status(400).json({ error: "Se requiere distrito (districtId)." });
  }

  if (!type || !latitude || !longitude || !authorName || !sector) {
    return res.status(400).json({ error: "Faltan campos requeridos: type, latitude, longitude, authorName, sector." });
  }

  try {
    const [alert] = await db.insert(panicAlertsTable).values({
      districtId,
      type,
      latitude,
      longitude,
      address: address ?? "",
      authorName,
      sector,
    }).returning();

    // Broadcast SSE solo a clientes del mismo distrito
    broadcastPanicAlert(alert);

    return res.status(201).json({
      ...alert,
      id: String(alert.id),
      createdAt: alert.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create panic alert");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── M-01: GET /missing-persons ──────────────────────────────────────────────
router.get("/missing-persons", optionalAuth, async (req, res) => {
  try {
    const { active } = req.query;
    const districtId = getDistrictId(req);
    if (!districtId) {
      return res.status(400).json({ error: "Se requiere distrito (districtId)." });
    }

    const conditions = [eq(missingPersonsTable.districtId, districtId)];
    if (active !== undefined) {
      conditions.push(eq(missingPersonsTable.status, active === "true" ? "active" : "found"));
    }

    const alerts = await db.select()
      .from(missingPersonsTable)
      .where(and(...conditions))
      .orderBy(desc(missingPersonsTable.createdAt));

    return res.json({
      alerts: alerts.map(a => ({
        ...a,
        id: String(a.id),
        createdAt: a.createdAt.toISOString(),
        lastSeenAt: a.lastSeenAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get missing persons");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /missing-persons ──────────────────────────────────────────────────
router.post("/missing-persons", optionalAuth, async (req, res) => {
  const { name, age, clothing, photoUrl, lastSeenLatitude, lastSeenLongitude, lastSeenAddress, lastSeenAt, contactInfo, reportedBy, districtId: bodyDistrictId } = req.body;
  const user = (req as any).jwtUser;

  let districtId: number;
  if (user?.districtId && user.role !== "super_admin") {
    districtId = Number(user.districtId);
  } else if (bodyDistrictId) {
    districtId = Number(bodyDistrictId);
  } else {
    return res.status(400).json({ error: "Se requiere distrito (districtId)." });
  }

  if (!name || !clothing || !lastSeenLatitude || !lastSeenLongitude || !lastSeenAddress || !lastSeenAt || !contactInfo || !reportedBy) {
    return res.status(400).json({ error: "Faltan campos requeridos." });
  }

  try {
    const [alert] = await db.insert(missingPersonsTable).values({
      districtId,
      name,
      age: age ?? null,
      clothing,
      photoUrl: photoUrl ?? null,
      lastSeenLatitude,
      lastSeenLongitude,
      lastSeenAddress,
      lastSeenAt: new Date(lastSeenAt),
      contactInfo,
      reportedBy,
    }).returning();

    return res.status(201).json({
      ...alert,
      id: String(alert.id),
      createdAt: alert.createdAt.toISOString(),
      lastSeenAt: alert.lastSeenAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create missing person");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── M-06: PATCH /missing-persons/:id — AHORA CON AUTH ──────────────────────
router.patch("/missing-persons/:id", requireAuth, async (req, res) => {
  const user = (req as any).jwtUser;

  try {
    const [person] = await db.select()
      .from(missingPersonsTable)
      .where(eq(missingPersonsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!person) return res.status(404).json({ error: "Persona no encontrada." });

    // M-04: Chequeo de tenant
    if (user.role !== "super_admin" && Number(user.districtId) !== Number(person.districtId)) {
      return res.status(403).json({ error: "No puedes modificar registros de otro distrito." });
    }

    const { status, clothing: newClothing, photoUrl: newPhotoUrl } = req.body;

    const [updated] = await db.update(missingPersonsTable)
      .set({
        ...(status ? { status } : {}),
        ...(newClothing ? { clothing: newClothing } : {}),
        ...(newPhotoUrl !== undefined ? { photoUrl: newPhotoUrl } : {}),
      })
      .where(eq(missingPersonsTable.id, parseInt(req.params.id as string)))
      .returning();

    return res.json({
      ...updated,
      id: String(updated.id),
      createdAt: updated.createdAt.toISOString(),
      lastSeenAt: updated.lastSeenAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update missing person");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
