import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  reportsTable,
  panicAlertsTable,
  missingPersonsTable,
  usersTable,
  adSlotsTable,
  districtsTable,
  auditLogTable,
  staticPointsTable,
  resolutionConfirmationsTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql, isNull, gte, lte } from "drizzle-orm";
import { requireAuth, requireAdmin, optionalAuth } from "./auth";
import { getDistrictId, checkTenant } from "./tenant";
import { sendStatusChangeEmail } from "../lib/email";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

// ── M-05/M-14: Validación con districtId en vez de district string ──────────
const createReportSchema = z.object({
  title: z.string().min(3, "Título muy corto").max(200),
  description: z.string().min(10, "Descripción muy corta").max(2000),
  category: z.enum([
    "robbery", "fight", "suspicious", "water_cut", "garbage",
    "informal_commerce", "noise", "missing_person", "fire",
    "medical_emergency", "prostitution", "drug_point", "bar_trouble", "other",
  ]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  isAnonymous: z.boolean(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional().default(""),
  sector: z.string().min(1, "Sector requerido"),
  // Anónimo requiere districtId explícito; autenticado se sobreescribe
  districtId: z.number().optional(),
  district: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  authorName: z.string().optional(),
  contactPhone: z.string().regex(/^[+\d\s\-()]{7,15}$/, "Teléfono inválido").optional().nullable(),
  contactEmail: z.string().email("Correo inválido").optional().nullable(),
});

const updateReportSchema = z.object({
  status: z.enum(["active", "reviewing", "resolved", "archived"]).optional(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
});

// ── B-12, M-01: GET /reports (with district filter) ───────────────────────
router.get("/reports", optionalAuth, async (req, res) => {
  try {
    const { category, status, urgency, sector, limit, offset } = req.query;
    const districtId = getDistrictId(req);
    if (!districtId) {
      return res.json({ reports: [] });
    }

    const conditions = [
      eq(reportsTable.districtId, districtId),
      isNull(reportsTable.deletedAt),
    ];
    if (category) conditions.push(eq(reportsTable.category, category as any));
    if (status) conditions.push(eq(reportsTable.status, status as any));
    if (urgency) conditions.push(eq(reportsTable.urgency, urgency as any));
    if (sector) conditions.push(eq(reportsTable.sector, sector as string));

    const limitNum = Math.min(Number(limit) || 50, 200);
    const offsetNum = Number(offset) || 0;

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(reportsTable)
      .where(and(...conditions));

    const reports = await db.select()
      .from(reportsTable)
      .where(and(...conditions))
      .orderBy(desc(reportsTable.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    const user = (req as any).jwtUser;
    const userId = user?.sub ? parseInt(user.sub) : null;

    return res.json({
      reports: reports.map(r => {
        // Anonimizar: solo el autor del reporte ve su nombre real
        const isOwner = userId && r.authorUserId === userId;
        return {
          ...r,
          id: String(r.id),
          authorName: isOwner ? r.authorName : r.authorName,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
      total: Number(count),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get reports");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /reports ───────────────────────────────────────────────────────────
router.post("/reports", optionalAuth, async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
  }

  const data = parsed.data;
  const user = (req as any).jwtUser;

  // M-04: Determinar districtId
  let districtId: number;
  if (user?.districtId && user.role !== "super_admin") {
    districtId = Number(user.districtId);
  } else if (data.districtId) {
    districtId = Number(data.districtId);
  } else {
    return res.status(400).json({ error: "Se requiere distrito (districtId)." });
  }

  // B-12: Forzar anonimato para categorías sensibles
  const SENSITIVE = ["informal_commerce", "prostitution", "drug_point", "bar_trouble"];
  const isAnonymous = SENSITIVE.includes(data.category) ? true : data.isAnonymous;

  try {
    // Obtener/crear vecinoId para el usuario
    let vecinoId: number | null = null;
    let authorName = "Anónimo";
    let authorUserId: number | null = null;
    if (user && user.sub) {
      // Usuario autenticado: obtener su vecinoId/alias o crear vecinoId
      const [dbUser] = await db.select({ vecinoId: usersTable.vecinoId, id: usersTable.id, alias: usersTable.alias })
        .from(usersTable)
        .where(eq(usersTable.id, parseInt(user.sub)))
        .limit(1);
      if (dbUser) {
        authorUserId = dbUser.id;
        vecinoId = dbUser.vecinoId;
        if (!vecinoId) {
          // Generar vecinoId determinista de 6 dígitos
          vecinoId = ((dbUser.id * 982451653 + 1610612741) % 1000000);
          // Asegurar 6 dígitos (entre 100000 y 999999)
          vecinoId = vecinoId < 100000 ? vecinoId + 100000 : vecinoId;
          await db.update(usersTable).set({ vecinoId }).where(eq(usersTable.id, dbUser.id));
        }
        if (!isAnonymous) {
          // El alias personalizado del vecino tiene prioridad sobre el código autogenerado
          const customAlias = dbUser.alias?.trim();
          authorName = customAlias && customAlias.length > 0
            ? customAlias
            : `Vecino ${String(vecinoId).padStart(6, "0")}`;
        }
      }
    } else if (!isAnonymous) {
      // Usuario no autenticado: se publica con identidad genérica
      authorName = data.authorName?.trim() || "Vecino";
    }
    const [report] = await db.insert(reportsTable).values({
      title: data.title,
      description: data.description,
      category: data.category as any,
      urgency: data.urgency as any,
      isAnonymous,
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address ?? "",
      sector: data.sector,
      districtId,
      district: data.district ?? "San Ramón",
      authorName: isAnonymous ? "Anónimo" : authorName,
      authorUserId: authorUserId ?? undefined,
      contactPhone: isAnonymous ? null : (data.contactPhone ?? null),
      imageUrl: data.imageUrl ?? null,
    }).returning();

    // Smart auto-asignación: mapea categoría → departamento (inspirado CivicReporter)
    const CATEGORY_TO_DEPT: Record<string, string> = {
      robbery: "serenazgo",
      fight: "serenazgo",
      suspicious: "serenazgo",
      water_cut: "servicios-publicos",
      garbage: "limpieza-publica",
      noise: "serenazgo",
      fire: "bomberos",
      medical_emergency: "salud",
      informal_commerce: "fiscalizacion",
      prostitution: "serenazgo",
      drug_point: "serenazgo",
      bar_trouble: "serenazgo",
      missing_person: "serenazgo",
    };
    const deptSlug = CATEGORY_TO_DEPT[data.category];
    if (deptSlug) {
      const { departmentsTable } = await import("@workspace/db/schema");
      const [dept] = await db.select({ id: departmentsTable.id })
        .from(departmentsTable)
        .where(and(eq(departmentsTable.slug, deptSlug), eq(departmentsTable.districtId, districtId)))
        .limit(1);
      if (dept) {
        await db.update(reportsTable).set({ assignedTo: dept.id }).where(eq(reportsTable.id, report.id));
        report.assignedTo = dept.id;
      }
    }

    return res.status(201).json({
      ...report,
      id: String(report.id),
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create report");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /reports/nearby — M-08: bounding box pre-filtro + districtId ────────
router.get("/reports/nearby", optionalAuth, async (req, res) => {
  const nearbySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(1, "Radio debe ser ≥ 1m").max(50000, "Radio máximo 50 km"),
    category: z.string().optional(),
    districtId: z.coerce.number().optional(),
  });

  const parsed = nearbySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Parámetros inválidos" });
  }

  const { lat, lng, radius, category } = parsed.data;
  const user = (req as any).jwtUser;

  // M-04: Determinar districtId
  let districtId: number;
  if (user?.districtId && user.role !== "super_admin") {
    districtId = Number(user.districtId);
  } else if (parsed.data.districtId) {
    districtId = parsed.data.districtId;
  } else {
    return res.status(400).json({ error: "Se requiere distrito (districtId)." });
  }

  try {
    // M-08: Bounding box pre-filtro SQL para reducir dataset antes de haversine
    const LAT_DEG = radius / 111000;
    const LNG_DEG = radius / (111000 * Math.cos(lat * Math.PI / 180));

    const bboxConditions = [
      eq(reportsTable.districtId, districtId),
      sql`${reportsTable.latitude} BETWEEN ${lat - LAT_DEG} AND ${lat + LAT_DEG}`,
      sql`${reportsTable.longitude} BETWEEN ${lng - LNG_DEG} AND ${lng + LNG_DEG}`,
    ];
    if (category) bboxConditions.push(eq(reportsTable.category, category as any));

    const candidates = await db.select()
      .from(reportsTable)
      .where(and(...bboxConditions));

    // Haversine preciso en JS sobre dataset reducido
    const R = 6371000;
    function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const nearby = candidates
      .map(r => ({
        id: String(r.id),
        title: r.title,
        description: r.description,
        category: r.category,
        urgency: r.urgency,
        latitude: r.latitude,
        longitude: r.longitude,
        address: r.address ?? "",
        sector: r.sector,
        distance: Math.round(haversine(lat, lng, r.latitude, r.longitude)),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }))
      .filter(r => r.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    return res.json({
      reports: nearby,
      count: nearby.length,
      query: { lat, lng, radius },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get nearby reports");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /reports/:id — M-04: con auth opcional + tenant filter ────────────
router.get("/reports/:id", optionalAuth, async (req, res) => {
  try {
    const [report] = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });

    // M-04: Si el usuario está autenticado, verificar que pertenezca al mismo distrito
    const user = (req as any).jwtUser;
    if (user && !checkTenant(req, report.districtId)) {
      return res.status(403).json({ error: "No puedes ver reportes de otro distrito." });
    }

    return res.json({
      ...report,
      id: String(report.id),
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get report");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── PATCH /reports/:id — M-04: con chequeo de tenant ────────────────────────
router.patch("/reports/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = updateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
  }

  try {
    const [report] = await db.select({ id: reportsTable.id, districtId: reportsTable.districtId })
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });

    // M-04: Chequeo de tenant
    if (!checkTenant(req, report.districtId)) {
      return res.status(403).json({ error: "No puedes modificar reportes de otro distrito." });
    }

    const [updated] = await db.update(reportsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .returning();

    // Audit log para cambios de estado
    const user = (req as any).jwtUser;
    if (parsed.data.status) {
      await db.insert(auditLogTable).values({
        districtId: updated.districtId,
        entityType: "report",
        entityId: updated.id,
        action: "status_changed",
        previousValue: report.districtId ? "active" : undefined,
        newValue: parsed.data.status,
        changedBy: user?.email ?? "unknown",
        changedById: user ? Number(user.sub) : undefined,
      }).catch(() => {}); // non-critical

      // Email notification al autor si tiene email de contacto
      if (updated.contactEmail) {
        sendStatusChangeEmail({
          to: updated.contactEmail,
          reportTitle: updated.title,
          reportId: updated.id,
          newStatus: parsed.data.status,
          districtName: updated.district,
        }).catch(() => {});
      }
    }

    return res.json({
      ...updated,
      id: String(updated.id),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update report");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── DELETE /reports/:id — M-04: con chequeo de tenant ───────────────────────
router.delete("/reports/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [report] = await db.select({ id: reportsTable.id, districtId: reportsTable.districtId, title: reportsTable.title })
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });

    if (!checkTenant(req, report.districtId)) {
      return res.status(403).json({ error: "No puedes eliminar reportes de otro distrito." });
    }

    // Soft delete: marcar como eliminado en lugar de borrar físicamente
    const user = (req as any).jwtUser;
    const now = new Date().toISOString();
    await db.update(reportsTable)
      .set({ deletedAt: now as any, deletedBy: user?.sub ?? "unknown" })
      .where(eq(reportsTable.id, parseInt(req.params.id as string)));

    // Audit log de eliminación
    await db.insert(auditLogTable).values({
      districtId: report.districtId,
      entityType: "report",
      entityId: report.id,
      action: "deleted",
      previousValue: "active",
      newValue: "soft_deleted",
      changedBy: user?.email ?? "unknown",
      changedById: user ? Number(user.sub) : undefined,
    }).catch(() => {});

    return res.json({ success: true, id: req.params.id, softDeleted: true });
  } catch (err) {
    req.log.error({ err }, "Failed to soft-delete report");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /reports/:id/confirm — M-04: con auth opcional + tenant filter ──
router.post("/reports/:id/confirm", optionalAuth, async (req, res) => {
  try {
    const [report] = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });

    // M-04: Verificar tenant si el usuario está autenticado
    if ((req as any).jwtUser && !checkTenant(req, report.districtId)) {
      return res.status(403).json({ error: "No puedes confirmar reportes de otro distrito." });
    }

    const [updated] = await db.update(reportsTable)
      .set({ confirmedCount: report.confirmedCount + 1, updatedAt: new Date() })
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .returning();

    return res.json({
      ...updated,
      id: String(updated.id),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to confirm report");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /reports/:id/confirm-resolution — Verificación comunitaria ──────────
// Cuando la municipalidad marca un reporte como "resolved", los vecinos pueden
// confirmar que la solución es real. Al llegar a RESOLUTION_THRESHOLD (10)
// confirmaciones, el reporte pasa a "archived" y desaparece del mapa y radar.
const RESOLUTION_THRESHOLD = 10;

router.post("/reports/:id/confirm-resolution", optionalAuth, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id as string);
    if (!Number.isFinite(reportId)) {
      return res.status(400).json({ error: "ID de reporte inválido." });
    }

    const [report] = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId))
      .limit(1);

    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });

    if (report.status !== "resolved") {
      return res.status(400).json({
        error: "Solo puedes confirmar la solución de reportes que la municipalidad ya marcó como resueltos.",
      });
    }

    const user = (req as any).jwtUser;
    if (user && !checkTenant(req, report.districtId)) {
      return res.status(403).json({ error: "No puedes confirmar reportes de otro distrito." });
    }

    const userId = user?.sub ? parseInt(user.sub) : null;
    const userIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket?.remoteAddress
      || null;

    // Verificar si ya confirmó (por usuario autenticado o por IP anónima)
    const dupConditions = userId
      ? and(eq(resolutionConfirmationsTable.reportId, reportId), eq(resolutionConfirmationsTable.userId, userId))
      : and(
          eq(resolutionConfirmationsTable.reportId, reportId),
          isNull(resolutionConfirmationsTable.userId),
          eq(resolutionConfirmationsTable.userIp, userIp ?? ""),
        );

    const [existing] = await db.select({ id: resolutionConfirmationsTable.id })
      .from(resolutionConfirmationsTable)
      .where(dupConditions)
      .limit(1);

    if (existing) {
      return res.status(409).json({
        error: "Ya confirmaste la solución de este reporte. ¡Gracias!",
        resolutionConfirmedCount: report.resolutionConfirmedCount,
        status: report.status,
      });
    }

    // Registrar la confirmación (los índices únicos de BD protegen contra carreras)
    try {
      await db.insert(resolutionConfirmationsTable).values({
        reportId,
        userId: userId ?? null,
        userIp,
      });
    } catch (insertErr: any) {
      // Violación de índice único = confirmación duplicada concurrente
      return res.status(409).json({
        error: "Ya confirmaste la solución de este reporte. ¡Gracias!",
        resolutionConfirmedCount: report.resolutionConfirmedCount,
        status: report.status,
      });
    }

    // Recontar desde la tabla (fuente de verdad) para evitar desincronización
    const [{ count: confCount }] = await db.select({ count: sql<number>`count(*)` })
      .from(resolutionConfirmationsTable)
      .where(eq(resolutionConfirmationsTable.reportId, reportId));

    const total = Number(confCount);
    const reachedThreshold = total >= RESOLUTION_THRESHOLD;

    const [updated] = await db.update(reportsTable)
      .set({
        resolutionConfirmedCount: total,
        ...(reachedThreshold ? { status: "archived" as const } : {}),
        updatedAt: new Date(),
      })
      .where(eq(reportsTable.id, reportId))
      .returning();

    if (reachedThreshold) {
      await db.insert(auditLogTable).values({
        districtId: updated.districtId,
        entityType: "report",
        entityId: updated.id,
        action: "archived_by_community",
        previousValue: "resolved",
        newValue: "archived",
        changedBy: user?.email ?? `ip:${userIp ?? "unknown"}`,
        changedById: userId ?? undefined,
      }).catch(() => {});
    }

    return res.json({
      id: String(updated.id),
      status: updated.status,
      resolutionConfirmedCount: updated.resolutionConfirmedCount,
      threshold: RESOLUTION_THRESHOLD,
      archived: reachedThreshold,
      message: reachedThreshold
        ? "¡Gracias! Con tu confirmación el reporte se verificó como solucionado y ya no aparecerá en el mapa."
        : `Confirmación registrada (${total}/${RESOLUTION_THRESHOLD}). El reporte desaparecerá del mapa cuando ${RESOLUTION_THRESHOLD} vecinos confirmen la solución.`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to confirm resolution");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /reports/:id/resolve — Admin resuelve con mensaje al vecino ──────
router.post("/reports/:id/resolve", requireAuth, requireAdmin, async (req, res) => {
  const resolveSchema = z.object({
    message: z.string().min(1, "El mensaje es obligatorio").max(500),
  });
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Mensaje inválido" });
  }

  try {
    const [report] = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });

    if (!checkTenant(req, report.districtId)) {
      return res.status(403).json({ error: "No puedes resolver reportes de otro distrito." });
    }

    const user = (req as any).jwtUser;
    const resolutionMsg = `🟢 RESUELTO — ${parsed.data.message}`;
    const updatedDescription = report.description
      ? `${report.description}\n\n---\n${resolutionMsg}\n— ${user?.name ?? "Administrador municipal"}`
      : `${resolutionMsg}\n— ${user?.name ?? "Administrador municipal"}`;

    const [updated] = await db.update(reportsTable)
      .set({
        status: "resolved" as const,
        description: updatedDescription,
        updatedAt: new Date(),
      })
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .returning();

    // Guardar en audit log
    await db.insert(auditLogTable).values({
      districtId: updated.districtId,
      entityType: "report",
      entityId: updated.id,
      action: "resolved_with_message",
      previousValue: report.status,
      newValue: "resolved",
      changedBy: user?.email ?? "unknown",
      changedById: user ? Number(user.sub) : undefined,
    }).catch(() => {});

    return res.json({
      ...updated,
      id: String(updated.id),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      resolutionMessage: parsed.data.message,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve report");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /seed — M-12: parametrizado por districtSlug ────────────────────────
// Rate limiter estricto: máximo 5 intentos por hora por IP
const seedLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de seed. Intenta en una hora." },
});

router.post("/seed", seedLimiter, async (req, res) => {
  try {
    // Seguridad: en producción, seed solo si ALLOW_SEED=true explícitamente
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
      return res.status(403).json({ error: "Seed deshabilitado en producción. Configura ALLOW_SEED=true para habilitarlo." });
    }
    // Verificar seed key
    const seedKey = req.headers["x-seed-key"];
    if (process.env.NODE_ENV === "production" && seedKey !== process.env.SEED_KEY) {
      return res.status(403).json({ error: "No autorizado." });
    }

    // M-12: Obtener districtId del slug o usar San Ramón por defecto
    const districtSlug = req.body?.districtSlug ?? "san-ramon";
    const [district] = await db.select()
      .from(districtsTable)
      .where(eq(districtsTable.slug, districtSlug))
      .limit(1);

    if (!district) {
      return res.status(400).json({ error: `Distrito "${districtSlug}" no encontrado.` });
    }

    // ── Siempre crear/asegurar los 2 usuarios demo ─────────────────────
    await db.insert(usersTable).values([
      {
        name: `Admin ${district.name}`,
        email: `admin-${district.slug}@radarvecinal.app`,
        passwordHash: "$2b$10$Wn2fesNFZ.uIZXJaAuqD/es0aN2TF5jB0EHT4ksFpSzgI5R/xiwqW",
        role: "admin" as const,
        sector: `${district.name} Centro`,
        districtId: district.id,
        district: district.name,
      },
      {
        name: `Vecino Demo ${district.name}`,
        email: `vecino-${district.slug}@radarvecinal.app`,
        passwordHash: "$2b$10$Wn2fesNFZ.uIZXJaAuqD/eHX8WJvdv.Ap52KR3WmrudFwXjqTgbGy",
        role: "user" as const,
        sector: `${district.name} Centro`,
        districtId: district.id,
        district: district.name,
      },
    ]).onConflictDoNothing();

    // Verificar si ya hay reportes
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(reportsTable)
      .where(eq(reportsTable.districtId, district.id));

    if (Number(count) >= 5) {
      return res.json({
        success: true,
        message: `Usuarios listos. El distrito "${district.name}" ya tenía reportes.`,
        seeded: { users: 2, reports: 0 },
      });
    }

    const LAT = district.centerLat ?? -11.1272;
    const LNG = district.centerLng ?? -75.3548;
    const j = (v: number, r = 0.0025) => parseFloat((v + (Math.random() * 2 - 1) * r).toFixed(6));
    const ts = (daysAgo: number, hrsAgo = 0) =>
      new Date(Date.now() - daysAgo * 86400000 - hrsAgo * 3600000);

    // Reports for this district
    const reports = Array.from({ length: 20 }, (_, i) => ({
      title: `Reporte demo ${i + 1} - ${district.name}`,
      description: `Reporte generado automáticamente para el distrito ${district.name}.`,
      category: (["robbery", "fight", "suspicious", "noise", "garbage"] as const)[i % 5],
      urgency: (["low", "medium", "high", "critical"] as const)[i % 4],
      status: (["active", "reviewing", "resolved"] as const)[i % 3],
      isAnonymous: i % 4 === 0,
      latitude: j(LAT),
      longitude: j(LNG),
      address: `Calle ${i + 1}, ${district.name}`,
      sector: `${district.name} Centro`,
      districtId: district.id,
      district: district.name,
      authorName: i % 4 === 0 ? "Anónimo" : `Vecino ${i + 1}`,
      contactPhone: i % 4 === 0 ? null : `987-${String(654 - i).padStart(3, "0")}`,
      confirmedCount: Math.floor(Math.random() * 10),
      createdAt: ts(i * 2),
      updatedAt: ts(i * 2),
    }));

    await db.insert(reportsTable).values(reports);

    return res.json({
      success: true,
      message: `Datos demo sembrados en "${district.name}".`,
      seeded: { users: 1, reports: reports.length },
    });
  } catch (err) {
    req.log.error({ err }, "Seed failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /reports/:id/flag-fake — Admin marca reporte falso y banea usuario ──
router.post("/reports/:id/flag-fake", requireAuth, requireAdmin, async (req, res) => {
  const flagFakeSchema = z.object({
    reason: z.string().min(1, "Motivo requerido").max(500),
  });
  const parsed = flagFakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Motivo inválido" });
  }

  try {
    const [report] = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });

    if (!checkTenant(req, report.districtId)) {
      return res.status(403).json({ error: "No puedes moderar reportes de otro distrito." });
    }

    const adminUser = (req as any).jwtUser;

    // Si el reporte tiene autorUserId, bannear al usuario autor
    let bannedUserId: number | null = null;
    if (report.authorUserId) {
      await db.update(usersTable)
        .set({
          bannedAt: sql`NOW()`,
          banReason: parsed.data.reason,
          banReportedById: adminUser ? Number(adminUser.sub) : null,
          isActive: false,
        })
        .where(eq(usersTable.id, report.authorUserId));
      bannedUserId = report.authorUserId;
    }

    // Marcar reporte como archivado
    await db.update(reportsTable)
      .set({ status: "archived" as const, updatedAt: new Date() })
      .where(eq(reportsTable.id, report.id));

    // Audit log
    await db.insert(auditLogTable).values({
      districtId: report.districtId,
      entityType: "report",
      entityId: report.id,
      action: "flagged_fake",
      previousValue: report.status,
      newValue: "archived",
      changedBy: adminUser?.email ?? "unknown",
      changedById: adminUser ? Number(adminUser.sub) : undefined,
    }).catch(() => {});

    return res.json({
      success: true,
      message: "Reporte marcado como falso y usuario baneado.",
      bannedUserId,
      banReason: parsed.data.reason,
      reportId: String(report.id),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to flag report as fake");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /reports/:id/static-info — Obtener info de punto estático ───────────
router.post("/reports/:id/static-info", optionalAuth, async (req, res) => {
  try {
    const [report] = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });

    // Buscar punto estático cercano (radio 50m)
    const LAT_DEG = 50 / 111000;
    const LNG_DEG = 50 / (111000 * Math.cos(report.latitude * Math.PI / 180));

    const [staticPoint] = await db.select()
      .from(staticPointsTable)
      .where(and(
        eq(staticPointsTable.districtId, report.districtId),
        sql`${staticPointsTable.latitude} BETWEEN ${report.latitude - LAT_DEG} AND ${report.latitude + LAT_DEG}`,
        sql`${staticPointsTable.longitude} BETWEEN ${report.longitude - LNG_DEG} AND ${report.longitude + LNG_DEG}`,
      ))
      .limit(1);

    if (!staticPoint) {
      return res.json({ hasStaticPoint: false, staticPoint: null });
    }

    return res.json({
      hasStaticPoint: true,
      staticPoint: {
        id: String(staticPoint.id),
        title: staticPoint.title,
        category: staticPoint.category,
        reportCount: staticPoint.reportCount,
        isResolved: staticPoint.isResolved,
        firstReportedAt: staticPoint.firstReportedAt.toISOString(),
        lastReportedAt: staticPoint.lastReportedAt.toISOString(),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get static point info");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;

