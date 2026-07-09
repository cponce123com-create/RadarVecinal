import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  panicAlertsTable,
  missingPersonsTable,
  notificationsTable,
  districtsTable,
  reportsTable,
  auditLogTable,
  reportMessagesTable,
  votesTable,
  resolutionConfirmationsTable,
  communityFlagsTable,
  userStrikesTable,
} from "@workspace/db/schema";
import { eq, desc, and, lt, gt, sql, inArray, isNull } from "drizzle-orm";
import { requireAuth, requireAdmin, optionalAuth } from "./auth";
import { getDistrictId, checkTenant } from "./tenant";
import { isMunicipalityLevel, isModeratorLevel } from "../lib/roles";
import { sendPanicAlertPush } from "../lib/fcm";

const router: IRouter = Router();

// ── Zod schemas ─────────────────────────────────────────────────────────────
const panicAlertSchema = z.object({
  type: z.enum([
    "robbery",
    "medical",
    "fight",
    "fire",
    "missing_person",
    "other",
  ]),
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
  ip: string;
}

export let sseClients: SseClient[] = [];

// ── expireStaleAlerts — Expiración lazy ──────────────────────────────────────
async function expireStaleAlerts() {
  await db
    .update(panicAlertsTable)
    .set({ status: "expired", isActive: false })
    .where(
      and(
        eq(panicAlertsTable.status, "active"),
        lt(panicAlertsTable.expiresAt, new Date()),
      ),
    );

  await db
    .update(panicAlertsTable)
    .set({ status: "expired", isActive: false })
    .where(
      and(
        eq(panicAlertsTable.status, "attending"),
        lt(panicAlertsTable.expiresAt, new Date()),
      ),
    );
}

// ── M-02: Broadcast de alerta solo a clientes del mismo distrito ────────────
export function broadcastPanicAlert(alert: any) {
  const alertDistrictId = Number(alert.districtId);
  const payload = {
    event: "new_alert",
    ...alert,
    id: String(alert.id),
    createdAt: alert.createdAt?.toISOString?.() ?? alert.createdAt,
  };
  const body = "data: " + JSON.stringify(payload) + "\n\n";
  sseClients.forEach((client) => {
    if (client.districtId === alertDistrictId) {
      client.res.write(body);
    }
  });
}

// ── broadcastAlertResolved — Notifica resolución por SSE ────────────────────
export function broadcastAlertResolved(alertId: string) {
  const body = `event: alert_resolved
data: ${JSON.stringify({ alertId })}

`;
  sseClients.forEach((client) => client.res.write(body));
}

// ── GET /panic-alerts/stream — M-02: SSE filtrado por distrito ──────────────
const SSE_GLOBAL_MAX = 100;
const SSE_MAX_PER_IP = 5;

router.get("/panic-alerts/stream", optionalAuth, async (req, res) => {
  const districtId = parseInt(req.query.districtId as string);
  if (!districtId) {
    res
      .status(400)
      .json({ error: "Se requiere districtId para conectar al stream." });
    return;
  }

  const userIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  // Límite global
  if (sseClients.length >= SSE_GLOBAL_MAX) {
    res
      .status(503)
      .json({ error: "Servidor saturado. Intenta de nuevo más tarde." });
    return;
  }

  // Límite por IP
  const ipCount = sseClients.filter((c) => c.ip === userIp).length;
  if (ipCount >= SSE_MAX_PER_IP) {
    res.status(429).json({ error: "Demasiadas conexiones desde esta IP." });
    return;
  }

  // Expirar alertas stale al conectar
  expireStaleAlerts().catch(() => {});

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
    ip: userIp,
  };
  sseClients.push(client);

  const heartbeat = setInterval(() => {
    try {
      res.write(":hb\n\n");
    } catch {
      /* la conexión se cerró; el evento close hará la limpieza */
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter((c) => c.id !== client.id);
  });
});

// ── M-01: GET /panic-alerts ─────────────────────────────────────────────────
router.get("/panic-alerts", optionalAuth, async (req, res) => {
  try {
    // Expirar alertas stale al listar
    await expireStaleAlerts();

    const { active } = req.query;
    const districtId = getDistrictId(req);
    const conditions: any[] = [];
    if (districtId) {
      conditions.push(eq(panicAlertsTable.districtId, districtId));
    }
    if (active !== undefined) {
      conditions.push(eq(panicAlertsTable.isActive, active === "true"));
    }

    const alerts = await db
      .select()
      .from(panicAlertsTable)
      .where(and(...conditions))
      .orderBy(desc(panicAlertsTable.createdAt))
      .limit(50);

    return res.json({
      alerts: alerts.map((a) => ({
        ...a,
        id: String(a.id),
        createdAt: a.createdAt.toISOString(),
        resolvedAt: a.resolvedAt?.toISOString?.() ?? a.resolvedAt ?? null,
        expiresAt: a.expiresAt?.toISOString?.() ?? a.expiresAt ?? null,
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
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }

  const data = parsed.data;
  const user = (req as any).jwtUser;

  let districtId: number;
  if (user?.districtId && user.role !== "super_admin") {
    districtId = Number(user.districtId);
  } else if (data.districtId) {
    districtId = Number(data.districtId);
  } else {
    return res
      .status(400)
      .json({ error: "Se requiere distrito (districtId)." });
  }

  // ── Anti-spam ────────────────────────────────────────────────────
  const userIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (user?.sub) {
    // Validar authorName contra blacklist de palabras ofensivas
    const BLACKLIST = [
      /put[aeo]/i,
      /mierda/i,
      /coño/i,
      /pendejo/i,
      /hue[vs]/i,
      /ctm/i,
      /la[ck]s?[ao]s/i,
    ];
    for (const pattern of BLACKLIST) {
      if (pattern.test(data.authorName)) {
        return res.status(400).json({
          error: "El nombre del autor contiene términos no permitidos.",
        });
      }
    }

    // Autenticado: máximo 2 activas simultáneas (por authorName + districtId)
    const [{ count: activeCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(panicAlertsTable)
      .where(
        and(
          eq(panicAlertsTable.authorName, data.authorName),
          eq(panicAlertsTable.districtId, districtId),
          eq(panicAlertsTable.isActive, true),
        ),
      );
    if (Number(activeCount) >= 2) {
      return res.status(429).json({
        error: "Ya tienes 2 alertas activas. Espera a que se resuelvan.",
      });
    }

    // Mismo tipo en últimos 5 min
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [{ count: recentCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(panicAlertsTable)
      .where(
        and(
          eq(panicAlertsTable.authorName, data.authorName),
          eq(panicAlertsTable.districtId, districtId),
          eq(panicAlertsTable.type, data.type as any),
          gt(panicAlertsTable.createdAt, fiveMinAgo),
        ),
      );
    if (Number(recentCount) >= 1) {
      return res.status(429).json({
        error: "Ya enviaste una alerta del mismo tipo hace menos de 5 minutos.",
      });
    }
  } else {
    // Anónimo: máximo 3 alertas por IP en 10 minutos
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [{ count: ipCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(panicAlertsTable)
      .where(
        and(
          eq(panicAlertsTable.sector, data.sector),
          eq(panicAlertsTable.districtId, districtId),
          gt(panicAlertsTable.createdAt, tenMinAgo),
        ),
      );
    // Nota: no tenemos campo IP en panic_alerts, usamos sector+authorName como aproximación
    if (Number(ipCount) >= 3) {
      return res.status(429).json({
        error: "Demasiadas alertas desde este sector. Espera 10 minutos.",
      });
    }
  }

  try {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

    const [alert] = await db
      .insert(panicAlertsTable)
      .values({
        districtId,
        type: data.type as any,
        latitude: data.latitude,
        longitude: data.longitude,
        address: data.address ?? "",
        authorName: data.authorName,
        sector: data.sector,
        expiresAt,
      })
      .returning();

    // ── También crear un reporte visible en el radar, mapa y feed ─────
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

    const [district] = await db
      .select({
        name: districtsTable.name,
        province: districtsTable.province,
        department: districtsTable.department,
      })
      .from(districtsTable)
      .where(eq(districtsTable.id, districtId))
      .limit(1);

    // Nota: .catch() puede devolver null; se evita desestructurar null
    // directamente (lanzaría "null is not iterable" en runtime si falla el insert).
    const mirrorRows = await db
      .insert(reportsTable)
      .values({
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
        panicAlertId: alert.id,
      })
      .returning()
      .catch((err2: any) => {
        req.log.error(
          { err: err2 },
          "Failed to create report from panic alert",
        );
        return null;
      });
    const mirrorReport = mirrorRows?.[0] ?? null;

    // ── Sync bidireccional linkedReportId / panicAlertId ──────────
    if (mirrorReport) {
      await db
        .update(panicAlertsTable)
        .set({ linkedReportId: mirrorReport.id })
        .where(eq(panicAlertsTable.id, alert.id));

      await db
        .update(reportsTable)
        .set({ panicAlertId: alert.id })
        .where(eq(reportsTable.id, mirrorReport.id));
    }

    // Broadcast SSE solo a clientes del mismo distrito
    broadcastPanicAlert(alert);

    // FCM push nativo a dispositivos Android — best-effort, no await
    sendPanicAlertPush(alert).catch(() => {});

    return res.status(201).json({
      ...alert,
      id: String(alert.id),
      createdAt: alert.createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create panic alert");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── PATCH /panic-alerts/:id — Gestionar estado ──────────────────────────────
const manageAlertSchema = z.object({
  status: z.enum(["attending", "resolved", "false_alarm"]),
  resolutionNote: z.string().max(500).optional(),
});

router.patch(
  "/panic-alerts/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const parsed = manageAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const { status: newStatus, resolutionNote } = parsed.data;
    const user = (req as any).jwtUser;

    try {
      const alertId = parseInt(req.params.id as string);
      const [alert] = await db
        .select()
        .from(panicAlertsTable)
        .where(eq(panicAlertsTable.id, alertId))
        .limit(1);

      if (!alert)
        return res.status(404).json({ error: "Alerta no encontrada." });

      // Tenant check: admin/moderator solo su distrito; super_admin cualquiera
      if (
        user.role !== "super_admin" &&
        Number(user.districtId) !== Number(alert.districtId)
      ) {
        return res
          .status(403)
          .json({ error: "No puedes gestionar alertas de otro distrito." });
      }

      const isResolved =
        newStatus === "resolved" || newStatus === "false_alarm";
      const updates: Record<string, any> = {
        status: newStatus,
        isActive: newStatus === "attending",
      };

      if (isResolved) {
        updates.resolvedAt = new Date();
        updates.resolvedById = Number(user.sub);
        if (resolutionNote) {
          updates.resolutionNote = resolutionNote;
        }
      }

      const [updated] = await db
        .update(panicAlertsTable)
        .set(updates)
        .where(eq(panicAlertsTable.id, alertId))
        .returning();

      // ── Sincronizar reporte espejo ────────────────────────────────
      if (alert.linkedReportId) {
        let reportStatus: string;
        if (newStatus === "false_alarm") {
          reportStatus = "archived";
        } else if (newStatus === "resolved") {
          reportStatus = "resolved";
        } else {
          reportStatus = "active";
        }

        await db
          .update(reportsTable)
          .set({ status: reportStatus as any, updatedAt: new Date() })
          .where(eq(reportsTable.id, alert.linkedReportId));
      }

      // ── Audit log ─────────────────────────────────────────────────
      await db
        .insert(auditLogTable)
        .values({
          districtId: alert.districtId,
          entityType: "panic_alert",
          entityId: alert.id,
          action: newStatus,
          previousValue: alert.status,
          newValue: newStatus,
          changedBy: user?.email ?? "unknown",
          changedById: user ? Number(user.sub) : undefined,
        })
        .catch(() => {});

      // Broadcast SSE
      broadcastAlertResolved(String(alert.id));

      return res.json({
        ...updated,
        id: String(updated.id),
        createdAt: updated.createdAt.toISOString(),
        resolvedAt:
          updated.resolvedAt?.toISOString?.() ?? updated.resolvedAt ?? null,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to manage panic alert");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── DELETE /panic-alerts/:id — Solo super_admin ────────────────────────────
router.delete(
  "/panic-alerts/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const user = (req as any).jwtUser;
    if (user.role !== "super_admin") {
      return res
        .status(403)
        .json({ error: "Solo super_admin puede eliminar alertas." });
    }

    try {
      const alertId = parseInt(req.params.id as string);
      const [alert] = await db
        .select()
        .from(panicAlertsTable)
        .where(eq(panicAlertsTable.id, alertId))
        .limit(1);

      if (!alert)
        return res.status(404).json({ error: "Alerta no encontrada." });

      await db.transaction(async (tx) => {
        // Eliminar hijos del linkedReport si existe
        if (alert.linkedReportId) {
          await tx
            .delete(reportMessagesTable)
            .where(eq(reportMessagesTable.reportId, alert.linkedReportId));
          await tx
            .delete(votesTable)
            .where(eq(votesTable.reportId, alert.linkedReportId));
          await tx
            .delete(resolutionConfirmationsTable)
            .where(
              eq(resolutionConfirmationsTable.reportId, alert.linkedReportId),
            );
          await tx
            .delete(communityFlagsTable)
            .where(eq(communityFlagsTable.reportId, alert.linkedReportId));
          await tx
            .delete(userStrikesTable)
            .where(eq(userStrikesTable.reportId, alert.linkedReportId));
          await tx
            .delete(reportsTable)
            .where(eq(reportsTable.id, alert.linkedReportId));
        }

        // Eliminar audit logs de la alerta
        await tx
          .delete(auditLogTable)
          .where(
            and(
              eq(auditLogTable.entityType, "panic_alert"),
              eq(auditLogTable.entityId, alert.id),
            ),
          );

        // Eliminar la alerta
        await tx
          .delete(panicAlertsTable)
          .where(eq(panicAlertsTable.id, alert.id));
      });

      // Audit log de eliminación (después de la tx para no complicar)
      await db
        .insert(auditLogTable)
        .values({
          districtId: alert.districtId,
          entityType: "panic_alert",
          entityId: alert.id,
          action: "deleted",
          changedBy: user?.email ?? "unknown",
          changedById: user ? Number(user.sub) : undefined,
        })
        .catch(() => {});

      return res.json({
        success: true,
        message: "Alerta eliminada permanentemente.",
      });
    } catch (err) {
      req.log.error({ err }, "Failed to delete panic alert");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── POST /panic-alerts/purge — Solo super_admin limpiar historial ──────────
const purgeSchema = z.object({
  confirm: z.literal("ELIMINAR_TODO"),
  districtId: z.number().optional(),
});

router.post(
  "/panic-alerts/purge",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const user = (req as any).jwtUser;
    if (user.role !== "super_admin") {
      return res
        .status(403)
        .json({ error: "Solo super_admin puede purgar alertas." });
    }

    const parsed = purgeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Debes escribir ELIMINAR_TODO para confirmar." });
    }

    const { districtId: filterDistrictId } = parsed.data;

    try {
      const conditions: any[] = [];
      if (filterDistrictId) {
        conditions.push(eq(panicAlertsTable.districtId, filterDistrictId));
      }

      const alertsToDelete = await db
        .select({
          id: panicAlertsTable.id,
          linkedReportId: panicAlertsTable.linkedReportId,
        })
        .from(panicAlertsTable)
        .where(and(...conditions));

      const alertIds = alertsToDelete.map((a) => a.id);
      const reportIds = alertsToDelete
        .map((a) => a.linkedReportId)
        .filter(Boolean) as number[];

      if (alertIds.length === 0) {
        return res.json({
          success: true,
          message: "No hay alertas para purgar.",
          deletedCount: 0,
        });
      }

      await db.transaction(async (tx) => {
        // Eliminar hijos de los linkedReports
        if (reportIds.length > 0) {
          await tx
            .delete(reportMessagesTable)
            .where(inArray(reportMessagesTable.reportId, reportIds));
          await tx
            .delete(votesTable)
            .where(inArray(votesTable.reportId, reportIds));
          await tx
            .delete(resolutionConfirmationsTable)
            .where(inArray(resolutionConfirmationsTable.reportId, reportIds));
          await tx
            .delete(communityFlagsTable)
            .where(inArray(communityFlagsTable.reportId, reportIds));
          await tx
            .delete(userStrikesTable)
            .where(inArray(userStrikesTable.reportId, reportIds));
          await tx
            .delete(reportsTable)
            .where(inArray(reportsTable.id, reportIds));
        }

        // Eliminar audit logs
        await tx
          .delete(auditLogTable)
          .where(
            and(
              eq(auditLogTable.entityType, "panic_alert"),
              inArray(auditLogTable.entityId, alertIds),
            ),
          );

        // Eliminar alertas
        await tx
          .delete(panicAlertsTable)
          .where(inArray(panicAlertsTable.id, alertIds));
      });

      return res.json({
        success: true,
        message: `${alertIds.length} alerta(s) purgada(s).`,
        deletedCount: alertIds.length,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to purge panic alerts");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── M-01: GET /missing-persons ──────────────────────────────────────────────
router.get("/missing-persons", optionalAuth, async (req, res) => {
  try {
    const { active } = req.query;
    const districtId = getDistrictId(req);
    const conditions: any[] = [isNull(missingPersonsTable.deletedAt)];
    if (districtId) {
      conditions.push(eq(missingPersonsTable.districtId, districtId));
    }
    if (active !== undefined) {
      conditions.push(
        eq(missingPersonsTable.status, active === "true" ? "active" : "found"),
      );
    }

    const user = (req as any).jwtUser;
    const isBackofficeSameDistrict =
      !!user &&
      !!districtId &&
      isModeratorLevel(user.role) &&
      checkTenant(req, districtId);

    const alerts = await db
      .select({
        id: missingPersonsTable.id,
        name: missingPersonsTable.name,
        age: missingPersonsTable.age,
        clothing: missingPersonsTable.clothing,
        photoUrl: missingPersonsTable.photoUrl,
        lastSeenLatitude: missingPersonsTable.lastSeenLatitude,
        lastSeenLongitude: missingPersonsTable.lastSeenLongitude,
        lastSeenAddress: missingPersonsTable.lastSeenAddress,
        lastSeenAt: missingPersonsTable.lastSeenAt,
        status: missingPersonsTable.status,
        districtId: missingPersonsTable.districtId,
        // F2: el teléfono de contacto es PÚBLICO (una alerta "se busca" necesita
        // que cualquiera pueda avisar). El NOMBRE del reportante queda reservado
        // al backoffice del distrito por privacidad.
        contactInfo: missingPersonsTable.contactInfo,
        ...(isBackofficeSameDistrict
          ? { reportedBy: missingPersonsTable.reportedBy }
          : {}),
        createdAt: missingPersonsTable.createdAt,
      })
      .from(missingPersonsTable)
      .where(and(...conditions))
      .orderBy(desc(missingPersonsTable.createdAt));

    return res.json({
      alerts: alerts.map((a) => ({
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
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }

  const data = parsed.data;
  const user = (req as any).jwtUser;

  let districtId: number;
  if (user?.districtId && user.role !== "super_admin") {
    districtId = Number(user.districtId);
  } else if (data.districtId) {
    districtId = Number(data.districtId);
  } else {
    return res
      .status(400)
      .json({ error: "Se requiere distrito (districtId)." });
  }

  try {
    const [alert] = await db
      .insert(missingPersonsTable)
      .values({
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
        reportedById: user?.sub ? Number(user.sub) : null,
      })
      .returning();

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

// ── PATCH /missing-persons/:id — Autor, admin del distrito, o super_admin ──
router.patch("/missing-persons/:id", requireAuth, async (req, res) => {
  const user = (req as any).jwtUser;

  try {
    const personId = parseInt(req.params.id as string);
    const [person] = await db
      .select()
      .from(missingPersonsTable)
      .where(eq(missingPersonsTable.id, personId))
      .limit(1);

    if (!person)
      return res.status(404).json({ error: "Persona no encontrada." });

    // Permisos para EDITAR (sin eliminar): autor, o nivel moderador (viewer+)
    // del mismo distrito (super_admin en cualquier distrito).
    // Migración 0024: la autoría se determina por `reportedById` (user id).
    const isAuthor =
      !!user.sub &&
      person.reportedById != null &&
      Number(user.sub) === person.reportedById;
    const canModerate =
      isModeratorLevel(user.role) && checkTenant(req, person.districtId);

    if (!isAuthor && !canModerate) {
      return res.status(403).json({
        error: "No tienes permiso para modificar esta persona desaparecida.",
      });
    }

    // Edición completa: los campos ausentes se dejan sin cambios.
    const b = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (b.status !== undefined) patch.status = b.status;
    if (b.name !== undefined) patch.name = b.name;
    if (b.age !== undefined) patch.age = b.age === null ? null : Number(b.age);
    if (b.clothing !== undefined) patch.clothing = b.clothing;
    if (b.photoUrl !== undefined) patch.photoUrl = b.photoUrl;
    if (b.lastSeenAddress !== undefined)
      patch.lastSeenAddress = b.lastSeenAddress;
    if (b.contactInfo !== undefined) patch.contactInfo = b.contactInfo;

    const [updated] = await db
      .update(missingPersonsTable)
      .set(patch)
      .where(eq(missingPersonsTable.id, personId))
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

// ── DELETE /missing-persons/:id — municipalidad (mismo distrito) o super_admin ─
// ELIMINAR es nivel municipalidad+ (los moderadores no eliminan). Borrado suave.
router.delete("/missing-persons/:id", requireAuth, async (req, res) => {
  const user = (req as any).jwtUser;
  try {
    const personId = parseInt(req.params.id as string);
    const [person] = await db
      .select({
        id: missingPersonsTable.id,
        districtId: missingPersonsTable.districtId,
      })
      .from(missingPersonsTable)
      .where(eq(missingPersonsTable.id, personId))
      .limit(1);

    if (!person)
      return res.status(404).json({ error: "Persona no encontrada." });

    if (
      !isMunicipalityLevel(user.role) ||
      !checkTenant(req, person.districtId)
    ) {
      return res.status(403).json({
        error: "No tienes permiso para eliminar esta persona desaparecida.",
      });
    }

    await db
      .update(missingPersonsTable)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(missingPersonsTable.id, personId));

    return res.json({ success: true, id: String(personId) });
  } catch (err) {
    req.log.error({ err }, "Failed to delete missing person");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
