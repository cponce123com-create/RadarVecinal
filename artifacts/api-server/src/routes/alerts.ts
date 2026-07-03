import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  panicAlertsTable,
  missingPersonsTable,
  notificationsTable,
  districtsTable,
  reportsTable,
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
// FIX: se añade `event: "new_alert"` para que los clientes puedan distinguir
// alertas nuevas de heartbeats/handshakes sin ambigüedad. El campo `type`
// se mantiene con el tipo de emergencia (robbery, fire, etc.) porque el hook
// global usePanicAlertStream lo usa para el título del toast.
export function broadcastPanicAlert(alert: any) {
  const alertDistrictId = Number(alert.districtId);
  const payload = {
    event: "new_alert",
    ...alert,
    id: String(alert.id),
    createdAt: alert.createdAt?.toISOString?.() ?? alert.createdAt,
  };
  const body = `data: ${JSON.stringify(payload)}\n\n`;
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

  res.write("data: " + JSON.stringify({ event: "connected" }) + "\n\n");

  const client: SseClient = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    res,
    districtId,
  };
  sseClients.push(client);

  // FIX: heartbeat cada 25s — los proxies (Render/Cloudflare) cierran
  // conexiones inactivas y el cliente quedaba "Conectando..." para siempre.
  const heartbeat = setInterval(() => {
    try {
      res.write(":hb\n\n");
    } catch {
      /* la conexión se cerró; el evento close hará la limpieza */
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c.id !== client.id);
  });
});

// ── M-01: GET /panic-alerts ─────────────────────────────────────────────────
router.get("/panic-alerts", optionalAuth, async (req, res) => {
  try {
    const { active } = req.query;
    const districtId = getDistrictId(req);
    if (!districtId) {
      // FIX: antes devolvía { panicAlerts: [] } — clave inconsistente con el
      // contrato OpenAPI (getPanicAlerts200 usa `alerts`). El frontend leía
      // data.alerts y aquí recibía otra forma.
      return res.json({ alerts: [] });
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

    // ── También crear un reporte visible en el radar, mapa y feed ─────
    // Mapeo de tipo de pánico → categoría de reporte
    const PANIC_CATEGORY_MAP: Record<string, string> = {
      robbery: "robbery",
      medical: "medical_emergency",
      fight: "fight",
      fire: "fire",
      missing_person: "missing_person",
      other: "other",
    };
    const PANIC_TITLE_MAP: Record<string, string> = {
      robbery: "🚨 Alerta de Pánico - Asalto",
      medical: "🚨 Alerta de Pánico - Emergencia Médica",
      fight: "🚨 Alerta de Pánico - Violencia Física",
      fire: "🚨 Alerta de Pánico - Incendio",
      missing_person: "🚨 Alerta de Pánico - Persona Extraviada",
      other: "🚨 Alerta de Pánico - Otra Emergencia",
    };

    const [district] = await db.select({
      name: districtsTable.name,
      province: districtsTable.province,
      department: districtsTable.department,
    }).from(districtsTable)
      .where(eq(districtsTable.id, districtId))
      .limit(1);

    await db.insert(reportsTable).values({
      title: PANIC_TITLE_MAP[data.type] ?? "🚨 Alerta de Pánico",
      description: `Alerta de pánico generada automáticamente. Tipo: ${data.type}.${data.address ? ` Ubicación: ${data.address}` : ""}`,
      category: (PANIC_CATEGORY_MAP[data.type] ?? "other") as any,
      urgency: "critical" as const,
      isAnonymous: false,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? "",
      sector: data.sector,
      districtId,
      district: district?.name ?? "San Ramón",
      province: district?.province ?? "Chanchamayo",
      department: district?.department ?? "Junín",
      authorName: data.authorName,
    }).catch((err2: any) => {
      // No crítico — no debe impedir la respuesta exitosa de la alerta
      req.log.error({ err: err2 }, "Failed to create report from panic alert");
    });

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
      return res.json({ alerts: [] });
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
