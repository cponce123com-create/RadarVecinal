import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
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
import { sendPanicAlertPush } from "../lib/fcm";

const router: IRouter = Router();

// ── Zod schemas ─────────────────────────────────────────────────────────────
const panicAlertSchema = z.object({
  type: z.enum(["robbery", "medical", "fight", "fire", "missing_person", "other"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional().default(""),
  authorName: z.string().min(1, "Nombre del autor requerido"),
  sector: z.string().min(1, "Sector requerido"),
  districtId: z.number().optional(),
});

const missingPersonSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  age: z.number().int().positive().optional().nullable(),
  clothing: z.string().min(1, "Descripción de vestimenta requerida"),
  photoUrl: z.string().optional().nullable(),
  lastSeenLatitude: z.number().min(-90).max(90),
  lastSeenLongitude: z.number().min(-180).max(180),
  lastSeenAddress: z.string().min(1, "Dirección requerida"),
  lastSeenAt: z.string().min(1, "Fecha/hora requerida"),
  contactInfo: z.string().min(1, "Información de contacto requerida"),
  reportedBy: z.string().min(1, "Nombre del reportante requerido"),
  districtId: z.number().optional(),
});

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
      return res.json({ panicAlerts: [] });
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
  const parsed = panicAlertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
  }

  const data = parsed.data;
  const user = (req as any).jwtUser;

  let districtId: number;
  if (user?.districtId && user.role !== "super_admin") {
    districtId = Number(user.districtId);
  } else if (data.districtId) {
    districtId = Number(data.districtId);
  } else {
    return res.status(400).json({ error: "Se requiere distrito (districtId)." });
  }

  try {
    const [alert] = await db.insert(panicAlertsTable).values({
      districtId,
      type: data.type as any,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? "",
      authorName: data.authorName,
      sector: data.sector,
    }).returning();

    // Broadcast SSE solo a clientes del mismo distrito
    broadcastPanicAlert(alert);

    // FCM push nativo a dispositivos Android — best-effort, no await
    sendPanicAlertPush(alert).catch(() => {});

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
      return res.json({ missingPersons: [] });
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
  const parsed = missingPersonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
  }

  const data = parsed.data;
  const user = (req as any).jwtUser;

  let districtId: number;
  if (user?.districtId && user.role !== "super_admin") {
    districtId = Number(user.districtId);
  } else if (data.districtId) {
    districtId = Number(data.districtId);
  } else {
    return res.status(400).json({ error: "Se requiere distrito (districtId)." });
  }

  try {
    const [alert] = await db.insert(missingPersonsTable).values({
      districtId,
      name: data.name,
      age: data.age ?? null,
      clothing: data.clothing,
      photoUrl: data.photoUrl ?? null,
      lastSeenLatitude: data.lastSeenLatitude,
      lastSeenLongitude: data.lastSeenLongitude,
      lastSeenAddress: data.lastSeenAddress,
      lastSeenAt: new Date(data.lastSeenAt),
      contactInfo: data.contactInfo,
      reportedBy: data.reportedBy,
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
