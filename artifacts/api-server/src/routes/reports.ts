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
  userStrikesTable,
  communityFlagsTable,
  reportMessagesTable,
} from "@workspace/db/schema";
import {
  eq,
  desc,
  and,
  or,
  ilike,
  sql,
  isNull,
  gte,
  lte,
  inArray,
} from "drizzle-orm";
import {
  requireAuth,
  requireAdmin,
  requireViewerOrAbove,
  optionalAuth,
} from "./auth";
import { getDistrictId, checkTenant } from "./tenant";
import { sendStatusChangeEmail } from "../lib/email";
import { notifyReportToTelegram } from "../lib/telegram";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

// ── M-05/M-14: Validación con districtId en vez de district string ──────────
const createReportSchema = z.object({
  title: z.string().min(3, "Título muy corto").max(200),
  description: z.string().min(10, "Descripción muy corta").max(2000),
  category: z.enum([
    "robbery",
    "fight",
    "suspicious",
    "water_cut",
    "garbage",
    "informal_commerce",
    "noise",
    "missing_person",
    "fire",
    "medical_emergency",
    "prostitution",
    "drug_point",
    "bar_trouble",
    "other",
    "lost_pet",
    "power_outage",
    "street_damage",
    "stray_dogs",
    "flooding",
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
  audioUrl: z.string().url().optional().nullable(),
  authorName: z.string().optional(),
  contactPhone: z
    .string()
    .regex(/^[+\d\s\-()]{7,15}$/, "Teléfono inválido")
    .optional()
    .nullable(),
  contactEmail: z.string().email("Correo inválido").optional().nullable(),
});

const updateReportSchema = z.object({
  status: z.enum(["active", "reviewing", "resolved", "archived"]).optional(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(2000).optional(),
});

// ── B-12, M-01: GET /reports (with district filter) ───────────────────────
const VALID_CATEGORIES = [
  "robbery",
  "fight",
  "suspicious",
  "water_cut",
  "garbage",
  "informal_commerce",
  "noise",
  "missing_person",
  "fire",
  "medical_emergency",
  "prostitution",
  "drug_point",
  "bar_trouble",
  "other",
  "lost_pet",
  "power_outage",
  "street_damage",
  "stray_dogs",
  "flooding",
] as const;

const VALID_STATUSES = ["active", "reviewing", "resolved", "archived"] as const;
const VALID_URGENCIES = ["low", "medium", "high", "critical"] as const;

router.get("/reports", optionalAuth, async (req, res) => {
  try {
    const { category, status, urgency, sector, limit, offset } = req.query;
    // B-03: Validar category contra enum antes de pasarlo a Drizzle
    if (category && !VALID_CATEGORIES.includes(category as any)) {
      return res.status(400).json({
        error: `Categoría inválida: "${category}". Valores válidos: ${VALID_CATEGORIES.join(", ")}`,
      });
    }
    if (status && !VALID_STATUSES.includes(status as any)) {
      return res.status(400).json({ error: `Estado inválido: "${status}".` });
    }
    if (urgency && !VALID_URGENCIES.includes(urgency as any)) {
      return res
        .status(400)
        .json({ error: `Urgencia inválida: "${urgency}".` });
    }
    const districtId = getDistrictId(req);
    const conditions: any[] = [isNull(reportsTable.deletedAt)];
    if (districtId) {
      conditions.push(eq(reportsTable.districtId, districtId));
    }
    if (category) conditions.push(eq(reportsTable.category, category as any));
    if (status) conditions.push(eq(reportsTable.status, status as any));
    if (urgency) conditions.push(eq(reportsTable.urgency, urgency as any));
    if (sector) conditions.push(eq(reportsTable.sector, sector as string));

    // Búsqueda de texto (moderación): título/descripción/dirección/zona
    const q = String(req.query.q ?? "").trim();
    if (q) {
      const like = `%${q}%`;
      conditions.push(
        or(
          ilike(reportsTable.title, like),
          ilike(reportsTable.description, like),
          ilike(reportsTable.address, like),
          ilike(reportsTable.sector, like),
        ),
      );
    }
    // Rango de fechas (createdAt) — ISO o YYYY-MM-DD
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) conditions.push(gte(reportsTable.createdAt, d));
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) conditions.push(lte(reportsTable.createdAt, d));
    }

    const limitNum = Math.min(Number(limit) || 50, 200);
    const offsetNum = Number(offset) || 0;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reportsTable)
      .where(and(...conditions));

    const reports = await db
      .select({
        id: reportsTable.id,
        title: reportsTable.title,
        description: reportsTable.description,
        category: reportsTable.category,
        urgency: reportsTable.urgency,
        status: reportsTable.status,
        isAnonymous: reportsTable.isAnonymous,
        latitude: reportsTable.latitude,
        longitude: reportsTable.longitude,
        address: reportsTable.address,
        sector: reportsTable.sector,
        district: reportsTable.district,
        districtId: reportsTable.districtId,
        imageUrl: reportsTable.imageUrl,
        audioUrl: reportsTable.audioUrl,
        authorName: reportsTable.authorName,
        authorUserId: reportsTable.authorUserId,
        confirmedCount: reportsTable.confirmedCount,
        createdAt: reportsTable.createdAt,
        updatedAt: reportsTable.updatedAt,
      })
      .from(reportsTable)
      .where(and(...conditions))
      .orderBy(desc(reportsTable.createdAt))
      .limit(limitNum)
      .offset(offsetNum);

    const user = (req as any).jwtUser;
    const userId = user?.sub ? parseInt(user.sub) : null;

    return res.json({
      reports: reports.map((r) => {
        // Anonimizar: solo el autor del reporte ve su nombre real
        const isOwner = userId && r.authorUserId === userId;
        return {
          ...r,
          id: String(r.id),
          contactPhone: isOwner ? (r as any).contactPhone : undefined,
          contactEmail: isOwner ? (r as any).contactEmail : undefined,
          authorName: r.authorName,
          createdAt:
            typeof r.createdAt === "object" &&
            "toISOString" in (r.createdAt as any)
              ? (r.createdAt as Date).toISOString()
              : String(r.createdAt),
          updatedAt:
            typeof r.updatedAt === "object" &&
            "toISOString" in (r.updatedAt as any)
              ? (r.updatedAt as Date).toISOString()
              : String(r.updatedAt),
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
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
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
    return res
      .status(400)
      .json({ error: "Se requiere distrito (districtId)." });
  }

  // B-12: Forzar anonimato para categorías sensibles
  const SENSITIVE = [
    "informal_commerce",
    "prostitution",
    "drug_point",
    "bar_trouble",
  ];
  const isAnonymous = SENSITIVE.includes(data.category)
    ? true
    : data.isAnonymous;

  try {
    // Obtener/crear vecinoId para el usuario
    let vecinoId: number | null = null;
    let authorName = "Anónimo";
    let authorUserId: number | null = null;
    if (user && user.sub) {
      // Usuario autenticado: obtener su vecinoId/alias o crear vecinoId
      const [dbUser] = await db
        .select({
          vecinoId: usersTable.vecinoId,
          id: usersTable.id,
          alias: usersTable.alias,
          isActive: usersTable.isActive,
          suspendedUntil: usersTable.suspendedUntil,
        })
        .from(usersTable)
        .where(eq(usersTable.id, parseInt(user.sub)))
        .limit(1);
      // Hacer cumplir las sanciones también aquí: esta ruta usa optionalAuth
      // (permite anónimos), por lo que NO pasa por requireAuth y un usuario
      // baneado/suspendido con token vigente podría seguir publicando.
      if (dbUser && !dbUser.isActive) {
        return res.status(403).json({
          error: "Tu cuenta está desactivada y no puede crear reportes.",
        });
      }
      if (
        dbUser?.suspendedUntil &&
        dbUser.suspendedUntil.getTime() > Date.now()
      ) {
        return res.status(403).json({
          error: "Tu cuenta está suspendida temporalmente por reportes falsos.",
          suspendedUntil: dbUser.suspendedUntil.toISOString(),
        });
      }
      if (dbUser) {
        authorUserId = dbUser.id;
        vecinoId = dbUser.vecinoId;
        if (!vecinoId) {
          // Generar vecinoId determinista de 6 dígitos
          vecinoId = (dbUser.id * 982451653 + 1610612741) % 1000000;
          // Asegurar 6 dígitos (entre 100000 y 999999)
          vecinoId = vecinoId < 100000 ? vecinoId + 100000 : vecinoId;
          await db
            .update(usersTable)
            .set({ vecinoId })
            .where(eq(usersTable.id, dbUser.id));
        }
        if (!isAnonymous) {
          // El alias personalizado del vecino tiene prioridad sobre el código autogenerado
          const customAlias = dbUser.alias?.trim();
          authorName =
            customAlias && customAlias.length > 0
              ? customAlias
              : `Vecino ${String(vecinoId).padStart(6, "0")}`;
        }
      }
    } else if (!isAnonymous) {
      // Usuario no autenticado: se publica con identidad genérica
      authorName = data.authorName?.trim() || "Vecino";
    }
    const [report] = await db
      .insert(reportsTable)
      .values({
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
        audioUrl: data.audioUrl ?? null,
      })
      .returning();

    // B-15: Incrementar reportsCount del autor
    if (authorUserId) {
      await db
        .update(usersTable)
        .set({ reportsCount: sql<number>`${usersTable.reportsCount} + 1` })
        .where(eq(usersTable.id, authorUserId))
        .catch(() => {}); // non-critical
    }

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
      lost_pet: "serenazgo",
      power_outage: "servicios-publicos",
      street_damage: "servicios-publicos",
      stray_dogs: "serenazgo",
      flooding: "servicios-publicos",
    };
    const deptSlug = CATEGORY_TO_DEPT[data.category];
    if (deptSlug) {
      const { departmentsTable } = await import("@workspace/db/schema");
      const [dept] = await db
        .select({ id: departmentsTable.id })
        .from(departmentsTable)
        .where(
          and(
            eq(departmentsTable.slug, deptSlug),
            eq(departmentsTable.districtId, districtId),
          ),
        )
        .limit(1);
      if (dept) {
        await db
          .update(reportsTable)
          .set({ assignedTo: dept.id })
          .where(eq(reportsTable.id, report.id));
        report.assignedTo = dept.id;
      }
    }

    // Notificar al canal de Telegram DEL DISTRITO (best-effort, no bloquea la
    // respuesta ni hace fallar el reporte si Telegram está caído o sin
    // configurar). Cada distrito tiene su propio canal; si no, cae al global.
    (async () => {
      const [d] = await db
        .select({ chatId: districtsTable.telegramChatId })
        .from(districtsTable)
        .where(eq(districtsTable.id, districtId))
        .limit(1);
      await notifyReportToTelegram(
        {
          id: report.id,
          title: report.title,
          description: report.description,
          category: report.category,
          urgency: report.urgency,
          latitude: report.latitude,
          longitude: report.longitude,
          address: report.address,
          sector: report.sector,
          districtName: report.district,
          authorName: report.authorName,
          isAnonymous: report.isAnonymous,
          imageUrl: report.imageUrl,
          audioUrl: report.audioUrl,
          createdAt: report.createdAt,
        },
        d?.chatId ?? null,
      );
    })().catch((err) => req.log.error({ err }, "Telegram notify failed"));

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
    radius: z.coerce
      .number()
      .min(1, "Radio debe ser ≥ 1m")
      .max(50000, "Radio máximo 50 km"),
    category: z.string().optional(),
    districtId: z.coerce.number().optional(),
  });

  const parsed = nearbySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Parámetros inválidos",
    });
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
    return res
      .status(400)
      .json({ error: "Se requiere distrito (districtId)." });
  }

  try {
    // M-08: Bounding box pre-filtro SQL para reducir dataset antes de haversine
    const LAT_DEG = radius / 111000;
    const LNG_DEG = radius / (111000 * Math.cos((lat * Math.PI) / 180));

    const bboxConditions = [
      eq(reportsTable.districtId, districtId),
      sql`${reportsTable.latitude} BETWEEN ${lat - LAT_DEG} AND ${lat + LAT_DEG}`,
      sql`${reportsTable.longitude} BETWEEN ${lng - LNG_DEG} AND ${lng + LNG_DEG}`,
    ];
    if (category)
      bboxConditions.push(eq(reportsTable.category, category as any));

    const candidates = await db
      .select()
      .from(reportsTable)
      .where(and(...bboxConditions));

    // Haversine preciso en JS sobre dataset reducido
    const R = 6371000;
    function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const nearby = candidates
      .map((r) => ({
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
      .filter((r) => r.distance <= radius)
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
// Item 3: Explicit column projection — contactPhone/contactEmail only for author
router.get("/reports/:id", optionalAuth, async (req, res) => {
  try {
    const [report] = await db
      .select({
        id: reportsTable.id,
        title: reportsTable.title,
        description: reportsTable.description,
        category: reportsTable.category,
        urgency: reportsTable.urgency,
        status: reportsTable.status,
        isAnonymous: reportsTable.isAnonymous,
        latitude: reportsTable.latitude,
        longitude: reportsTable.longitude,
        address: reportsTable.address,
        sector: reportsTable.sector,
        district: reportsTable.district,
        districtId: reportsTable.districtId,
        imageUrl: reportsTable.imageUrl,
        audioUrl: reportsTable.audioUrl,
        authorName: reportsTable.authorName,
        authorUserId: reportsTable.authorUserId,
        contactPhone: reportsTable.contactPhone,
        contactEmail: reportsTable.contactEmail,
        confirmedCount: reportsTable.confirmedCount,
        resolutionConfirmedCount: reportsTable.resolutionConfirmedCount,
        assignedTo: reportsTable.assignedTo,
        createdAt: reportsTable.createdAt,
        updatedAt: reportsTable.updatedAt,
      })
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report)
      return res.status(404).json({ error: "Reporte no encontrado." });

    // M-04: Si el usuario está autenticado, verificar que pertenezca al mismo distrito
    const user = (req as any).jwtUser;
    if (user && !checkTenant(req, report.districtId)) {
      return res
        .status(403)
        .json({ error: "No puedes ver reportes de otro distrito." });
    }

    const userId = user?.sub ? parseInt(user.sub) : null;
    const isOwner = userId && report.authorUserId === userId;

    return res.json({
      ...report,
      contactPhone: isOwner ? report.contactPhone : undefined,
      contactEmail: isOwner ? report.contactEmail : undefined,
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
// Moderar/editar (estado, título, descripción): nivel moderador+ del distrito.
// Eliminar sigue siendo requireAdmin (municipalidad+). Chequeo de tenant abajo.
router.patch(
  "/reports/:id",
  requireAuth,
  requireViewerOrAbove,
  async (req, res) => {
    const parsed = updateReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    try {
      const [report] = await db
        .select({ id: reportsTable.id, districtId: reportsTable.districtId })
        .from(reportsTable)
        .where(eq(reportsTable.id, parseInt(req.params.id as string)))
        .limit(1);

      if (!report)
        return res.status(404).json({ error: "Reporte no encontrado." });

      // M-04: Chequeo de tenant
      if (!checkTenant(req, report.districtId)) {
        return res
          .status(403)
          .json({ error: "No puedes modificar reportes de otro distrito." });
      }

      const [updated] = await db
        .update(reportsTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(reportsTable.id, parseInt(req.params.id as string)))
        .returning();

      // Audit log para cambios de estado
      const user = (req as any).jwtUser;
      if (parsed.data.status) {
        await db
          .insert(auditLogTable)
          .values({
            districtId: updated.districtId,
            entityType: "report",
            entityId: updated.id,
            action: "status_changed",
            previousValue: report.districtId ? "active" : undefined,
            newValue: parsed.data.status,
            changedBy: user?.email ?? "unknown",
            changedById: user ? Number(user.sub) : undefined,
          })
          .catch(() => {}); // non-critical

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
  },
);

// ── DELETE /reports/:id — M-04: con chequeo de tenant ───────────────────────
router.delete("/reports/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [report] = await db
      .select({
        id: reportsTable.id,
        districtId: reportsTable.districtId,
        title: reportsTable.title,
      })
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report)
      return res.status(404).json({ error: "Reporte no encontrado." });

    if (!checkTenant(req, report.districtId)) {
      return res
        .status(403)
        .json({ error: "No puedes eliminar reportes de otro distrito." });
    }

    // Soft delete: marcar como eliminado en lugar de borrar físicamente
    const user = (req as any).jwtUser;
    const now = new Date().toISOString();
    await db
      .update(reportsTable)
      .set({ deletedAt: now as any, deletedBy: user?.sub ?? "unknown" })
      .where(eq(reportsTable.id, parseInt(req.params.id as string)));

    // Audit log de eliminación
    await db
      .insert(auditLogTable)
      .values({
        districtId: report.districtId,
        entityType: "report",
        entityId: report.id,
        action: "deleted",
        previousValue: "active",
        newValue: "soft_deleted",
        changedBy: user?.email ?? "unknown",
        changedById: user ? Number(user.sub) : undefined,
      })
      .catch(() => {});

    return res.json({ success: true, id: req.params.id, softDeleted: true });
  } catch (err) {
    req.log.error({ err }, "Failed to soft-delete report");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /reports/:id/confirm — M-04: con auth opcional + tenant filter ──
// Item 3: Explicit column projection
// FASE 5: También incrementa trustScore del autor en +1
router.post("/reports/:id/confirm", optionalAuth, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id as string);
    const [report] = await db
      .select({
        id: reportsTable.id,
        districtId: reportsTable.districtId,
        authorUserId: reportsTable.authorUserId,
        status: reportsTable.status,
      })
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId))
      .limit(1);

    if (!report)
      return res.status(404).json({ error: "Reporte no encontrado." });

    // M-04: Verificar tenant si el usuario está autenticado
    if ((req as any).jwtUser && !checkTenant(req, report.districtId)) {
      return res
        .status(403)
        .json({ error: "No puedes confirmar reportes de otro distrito." });
    }

    const user = (req as any).jwtUser;
    const userId = user?.sub ? Number(user.sub) : null;
    const userIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    // Deduplicación: verificar si ya confirmó la VALIDEZ de este reporte
    // (kind="validity"; independiente de la confirmación de resolución)
    const dupConditions = userId
      ? and(
          eq(resolutionConfirmationsTable.reportId, reportId),
          eq(resolutionConfirmationsTable.userId, userId),
          eq(resolutionConfirmationsTable.kind, "validity"),
        )
      : and(
          eq(resolutionConfirmationsTable.reportId, reportId),
          isNull(resolutionConfirmationsTable.userId),
          eq(resolutionConfirmationsTable.userIp, userIp ?? ""),
          eq(resolutionConfirmationsTable.kind, "validity"),
        );
    const [existing] = await db
      .select({ id: resolutionConfirmationsTable.id })
      .from(resolutionConfirmationsTable)
      .where(dupConditions)
      .limit(1);
    if (existing) {
      return res
        .status(409)
        .json({ error: "Ya confirmaste este reporte. ¡Gracias!" });
    }

    // Registrar confirmación de validez
    try {
      await db.insert(resolutionConfirmationsTable).values({
        reportId,
        userId: userId ?? null,
        userIp,
        kind: "validity",
      });
    } catch (insertErr: any) {
      // Violación de unique = confirmación duplicada concurrente
      return res
        .status(409)
        .json({ error: "Ya confirmaste este reporte. ¡Gracias!" });
    }

    // Recontar desde la tabla (fuente de verdad), solo confirmaciones de validez
    const [{ count: confCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(resolutionConfirmationsTable)
      .where(
        and(
          eq(resolutionConfirmationsTable.reportId, reportId),
          eq(resolutionConfirmationsTable.kind, "validity"),
        ),
      );

    const totalConfirmed = Number(confCount);

    const [updated] = await db
      .update(reportsTable)
      .set({ confirmedCount: totalConfirmed, updatedAt: new Date() })
      .where(eq(reportsTable.id, reportId))
      .returning({
        id: reportsTable.id,
        confirmedCount: reportsTable.confirmedCount,
        status: reportsTable.status,
        updatedAt: reportsTable.updatedAt,
      });

    // Aumentar trustScore del autor en +1
    if (report.authorUserId) {
      await db
        .update(usersTable)
        .set({
          trustScore: sql`GREATEST(0, LEAST(100, ${usersTable.trustScore} + 1))`,
        })
        .where(eq(usersTable.id, report.authorUserId));
    }

    return res.json({
      id: String(updated.id),
      confirmedCount: updated.confirmedCount,
      status: updated.status,
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

router.post(
  "/reports/:id/confirm-resolution",
  optionalAuth,
  async (req, res) => {
    try {
      const reportId = parseInt(req.params.id as string);
      if (!Number.isFinite(reportId)) {
        return res.status(400).json({ error: "ID de reporte inválido." });
      }

      const [report] = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.id, reportId))
        .limit(1);

      if (!report)
        return res.status(404).json({ error: "Reporte no encontrado." });

      if (report.status !== "resolved") {
        return res.status(400).json({
          error:
            "Solo puedes confirmar la solución de reportes que la municipalidad ya marcó como resueltos.",
        });
      }

      const user = (req as any).jwtUser;
      if (user && !checkTenant(req, report.districtId)) {
        return res
          .status(403)
          .json({ error: "No puedes confirmar reportes de otro distrito." });
      }

      const userId = user?.sub ? parseInt(user.sub) : null;
      const userIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        null;

      // Verificar si ya confirmó la RESOLUCIÓN (kind="resolution"; separado de
      // la confirmación de validez)
      const dupConditions = userId
        ? and(
            eq(resolutionConfirmationsTable.reportId, reportId),
            eq(resolutionConfirmationsTable.userId, userId),
            eq(resolutionConfirmationsTable.kind, "resolution"),
          )
        : and(
            eq(resolutionConfirmationsTable.reportId, reportId),
            isNull(resolutionConfirmationsTable.userId),
            eq(resolutionConfirmationsTable.userIp, userIp ?? ""),
            eq(resolutionConfirmationsTable.kind, "resolution"),
          );

      const [existing] = await db
        .select({ id: resolutionConfirmationsTable.id })
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

      // Registrar la confirmación de resolución (los índices únicos protegen carreras)
      try {
        await db.insert(resolutionConfirmationsTable).values({
          reportId,
          userId: userId ?? null,
          userIp,
          kind: "resolution",
        });
      } catch (insertErr: any) {
        // Violación de índice único = confirmación duplicada concurrente
        return res.status(409).json({
          error: "Ya confirmaste la solución de este reporte. ¡Gracias!",
          resolutionConfirmedCount: report.resolutionConfirmedCount,
          status: report.status,
        });
      }

      // Recontar solo confirmaciones de RESOLUCIÓN (fuente de verdad)
      const [{ count: confCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(resolutionConfirmationsTable)
        .where(
          and(
            eq(resolutionConfirmationsTable.reportId, reportId),
            eq(resolutionConfirmationsTable.kind, "resolution"),
          ),
        );

      const total = Number(confCount);
      const reachedThreshold = total >= RESOLUTION_THRESHOLD;

      const [updated] = await db
        .update(reportsTable)
        .set({
          resolutionConfirmedCount: total,
          ...(reachedThreshold ? { status: "archived" as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(reportsTable.id, reportId))
        .returning();

      if (reachedThreshold) {
        await db
          .insert(auditLogTable)
          .values({
            districtId: updated.districtId,
            entityType: "report",
            entityId: updated.id,
            action: "archived_by_community",
            previousValue: "resolved",
            newValue: "archived",
            changedBy: user?.email ?? `ip:${userIp ?? "unknown"}`,
            changedById: userId ?? undefined,
          })
          .catch(() => {});
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
  },
);

// ── POST /reports/:id/resolve — Admin resuelve con mensaje al vecino ──────
router.post(
  "/reports/:id/resolve",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const resolveSchema = z.object({
      message: z.string().min(1, "El mensaje es obligatorio").max(500),
    });
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Mensaje inválido" });
    }

    try {
      const [report] = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.id, parseInt(req.params.id as string)))
        .limit(1);

      if (!report)
        return res.status(404).json({ error: "Reporte no encontrado." });

      if (!checkTenant(req, report.districtId)) {
        return res
          .status(403)
          .json({ error: "No puedes resolver reportes de otro distrito." });
      }

      const user = (req as any).jwtUser;
      const resolutionMsg = `🟢 RESUELTO — ${parsed.data.message}`;
      const updatedDescription = report.description
        ? `${report.description}\n\n---\n${resolutionMsg}\n— ${user?.name ?? "Administrador municipal"}`
        : `${resolutionMsg}\n— ${user?.name ?? "Administrador municipal"}`;

      const [updated] = await db
        .update(reportsTable)
        .set({
          status: "resolved" as const,
          description: updatedDescription,
          updatedAt: new Date(),
        })
        .where(eq(reportsTable.id, parseInt(req.params.id as string)))
        .returning();

      // Guardar en audit log
      await db
        .insert(auditLogTable)
        .values({
          districtId: updated.districtId,
          entityType: "report",
          entityId: updated.id,
          action: "resolved_with_message",
          previousValue: report.status,
          newValue: "resolved",
          changedBy: user?.email ?? "unknown",
          changedById: user ? Number(user.sub) : undefined,
        })
        .catch(() => {});

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
  },
);

// ── Item 1: POST /reports/:id/mark-found — Vecino marca mascota como encontrada ─
// Solo para categoría lost_pet. Solo el autor puede marcarla como encontrada.
router.post("/reports/:id/mark-found", requireAuth, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id as string);
    const user = (req as any).jwtUser;
    const userId = parseInt(user.sub);

    const [report] = await db
      .select({
        id: reportsTable.id,
        authorUserId: reportsTable.authorUserId,
        category: reportsTable.category,
        status: reportsTable.status,
        description: reportsTable.description,
        districtId: reportsTable.districtId,
        createdAt: reportsTable.createdAt,
        updatedAt: reportsTable.updatedAt,
      })
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId))
      .limit(1);

    if (!report)
      return res.status(404).json({ error: "Reporte no encontrado." });

    if (report.category !== "lost_pet") {
      return res.status(400).json({
        error:
          "Solo puedes marcar como encontrado un reporte de mascota perdida.",
      });
    }

    if (report.authorUserId !== userId) {
      return res.status(403).json({
        error: "Solo el autor del reporte puede marcarlo como encontrado.",
      });
    }

    if (report.status === "resolved" || report.status === "archived") {
      return res.status(400).json({
        error: "Este reporte ya fue marcado como encontrado o archivado.",
      });
    }

    const foundNote = `\n\n---\n✅ ENCONTRADO — El autor ha marcado esta mascota como encontrada.`;
    const updatedDescription = report.description
      ? `${report.description}${foundNote}`
      : foundNote.trim();

    const [updated] = await db
      .update(reportsTable)
      .set({
        status: "resolved" as const,
        description: updatedDescription,
        updatedAt: new Date(),
      })
      .where(eq(reportsTable.id, reportId))
      .returning();

    // Audit log
    await db
      .insert(auditLogTable)
      .values({
        districtId: report.districtId,
        entityType: "report",
        entityId: report.id,
        action: "pet_marked_found",
        previousValue: report.status,
        newValue: "resolved",
        changedBy: user?.email ?? "unknown",
        changedById: userId,
      })
      .catch(() => {});

    return res.json({
      ...updated,
      id: String(updated.id),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      message: "¡Mascota marcada como encontrada!",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to mark pet as found");
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
    // Seguridad: seed deshabilitado permanentemente en producción
    if (process.env.NODE_ENV === "production") {
      return res
        .status(403)
        .json({ error: "Seed deshabilitado en producción." });
    }
    // Verificar seed key
    const seedKey = req.headers["x-seed-key"];
    if (
      process.env.NODE_ENV === "production" &&
      seedKey !== process.env.SEED_KEY
    ) {
      return res.status(403).json({ error: "No autorizado." });
    }

    // M-12: Obtener districtId del slug o usar San Ramón por defecto
    const districtSlug = req.body?.districtSlug ?? "san-ramon";
    const [district] = await db
      .select()
      .from(districtsTable)
      .where(eq(districtsTable.slug, districtSlug))
      .limit(1);

    if (!district) {
      return res
        .status(400)
        .json({ error: `Distrito "${districtSlug}" no encontrado.` });
    }

    // ── Siempre crear/asegurar los 2 usuarios demo ─────────────────────
    await db
      .insert(usersTable)
      .values([
        {
          name: `Admin ${district.name}`,
          email: `admin-${district.slug}@radarvecinal.app`,
          passwordHash:
            "$2b$10$Wn2fesNFZ.uIZXJaAuqD/es0aN2TF5jB0EHT4ksFpSzgI5R/xiwqW",
          role: "admin" as const,
          sector: `${district.name} Centro`,
          districtId: district.id,
          district: district.name,
        },
        {
          name: `Vecino Demo ${district.name}`,
          email: `vecino-${district.slug}@radarvecinal.app`,
          passwordHash:
            "$2b$10$Wn2fesNFZ.uIZXJaAuqD/eHX8WJvdv.Ap52KR3WmrudFwXjqTgbGy",
          role: "user" as const,
          sector: `${district.name} Centro`,
          districtId: district.id,
          district: district.name,
        },
      ])
      .onConflictDoNothing();

    // Verificar si ya hay reportes
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
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
    const j = (v: number, r = 0.0025) =>
      parseFloat((v + (Math.random() * 2 - 1) * r).toFixed(6));
    const ts = (daysAgo: number, hrsAgo = 0) =>
      new Date(Date.now() - daysAgo * 86400000 - hrsAgo * 3600000);

    // Reports for this district
    const reports = Array.from({ length: 20 }, (_, i) => ({
      title: `Reporte demo ${i + 1} - ${district.name}`,
      description: `Reporte generado automáticamente para el distrito ${district.name}.`,
      category: (
        ["robbery", "fight", "suspicious", "noise", "garbage"] as const
      )[i % 5],
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
      contactPhone:
        i % 4 === 0 ? null : `987-${String(654 - i).padStart(3, "0")}`,
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

// ═════════════════════════════════════════════════════════════════════════════
// FASE 5: Strike system and community flagging
// ═════════════════════════════════════════════════════════════════════════════

// ── POST /reports/:id/flag-fake — Admin marca reporte falso (strike system) ──
// FASE 5: Ya NO banea inmediatamente. Crea un strike progresivo:
//   Strike 1 → solo advertencia
//   Strike 2 → suspensión 7 días
//   Strike 3+ → ban permanente (isActive = false)
//   Siempre: baja trustScore en 20
router.post(
  "/reports/:id/flag-fake",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const flagFakeSchema = z.object({
      reason: z.string().min(1, "Motivo requerido").max(500),
    });
    const parsed = flagFakeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Motivo inválido" });
    }

    try {
      const [report] = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.id, parseInt(req.params.id as string)))
        .limit(1);

      if (!report)
        return res.status(404).json({ error: "Reporte no encontrado." });

      if (!checkTenant(req, report.districtId)) {
        return res
          .status(403)
          .json({ error: "No puedes moderar reportes de otro distrito." });
      }

      const adminUser = (req as any).jwtUser;
      const adminId = adminUser ? Number(adminUser.sub) : 0;

      // Archivar el reporte
      await db
        .update(reportsTable)
        .set({ status: "archived" as const, updatedAt: new Date() })
        .where(eq(reportsTable.id, report.id));

      let actionTaken = "strike_added";
      let message = "Reporte marcado como falso.";

      if (report.authorUserId) {
        const authorId = report.authorUserId;

        // 1. Crear el strike
        const ninetyDaysFromNow = new Date(
          Date.now() + 90 * 24 * 60 * 60 * 1000,
        );
        await db.insert(userStrikesTable).values({
          userId: authorId,
          reportId: report.id,
          motivo: parsed.data.reason,
          adminId,
          expiresAt: ninetyDaysFromNow,
        });

        // 2. Contar strikes activos del usuario
        const [{ count: strikeCount }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(userStrikesTable)
          .where(
            and(
              eq(userStrikesTable.userId, authorId),
              eq(userStrikesTable.activo, true),
            ),
          );

        const totalStrikes = Number(strikeCount);

        // 3. Aplicar acción según cantidad de strikes
        if (totalStrikes >= 3) {
          // Ban permanente
          await db
            .update(usersTable)
            .set({
              bannedAt: sql`NOW()`,
              banReason: parsed.data.reason,
              banReportedById: adminId,
              isActive: false,
              trustScore: sql`GREATEST(0, ${usersTable.trustScore} - 20)`,
            })
            .where(eq(usersTable.id, authorId));
          actionTaken = "banned";
          message = `Reporte falso (strike #${totalStrikes}). Usuario baneado permanentemente.`;
        } else if (totalStrikes === 2) {
          // Suspensión 7 días
          const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await db
            .update(usersTable)
            .set({
              suspendedUntil: sevenDays,
              trustScore: sql`GREATEST(0, ${usersTable.trustScore} - 20)`,
            })
            .where(eq(usersTable.id, authorId));
          actionTaken = "suspended";
          message = `Reporte falso (strike #2). Usuario suspendido por 7 días.`;
        } else {
          // Strike 1: solo advertencia, baja trustScore
          await db
            .update(usersTable)
            .set({
              trustScore: sql`GREATEST(0, ${usersTable.trustScore} - 20)`,
            })
            .where(eq(usersTable.id, authorId));
          actionTaken = "warning";
          message = `Reporte falso (strike #1). Advertencia registrada. TrustScore: -20.`;
        }
      }

      // Audit log
      await db
        .insert(auditLogTable)
        .values({
          districtId: report.districtId,
          entityType: "report",
          entityId: report.id,
          action: "flagged_fake",
          previousValue: report.status,
          newValue: "archived",
          changedBy: adminUser?.email ?? "unknown",
          changedById: adminUser ? Number(adminUser.sub) : undefined,
        })
        .catch(() => {});

      return res.json({
        success: true,
        message,
        actionTaken,
        reportId: String(report.id),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to flag report as fake");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── POST /reports/:id/flag-community — Vecino reporta reporte como falso ─────
// Community flagging: N (3) flags de distintos usuarios → status = "reviewing"
const COMMUNITY_FLAG_THRESHOLD = 3;

router.post("/reports/:id/flag-community", requireAuth, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id as string);
    const user = (req as any).jwtUser;
    const userId = parseInt(user.sub);

    const [report] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId))
      .limit(1);

    if (!report)
      return res.status(404).json({ error: "Reporte no encontrado." });

    // No permitir que el autor se auto-flagge
    if (report.authorUserId === userId) {
      return res
        .status(403)
        .json({ error: "No puedes reportar tu propio reporte." });
    }

    // Verificar que el usuario pertenece al mismo distrito
    if (!checkTenant(req, report.districtId)) {
      return res
        .status(403)
        .json({ error: "No puedes reportar reportes de otro distrito." });
    }

    // Verificar si ya flaggeó este reporte
    const [existing] = await db
      .select({ id: communityFlagsTable.id })
      .from(communityFlagsTable)
      .where(
        and(
          eq(communityFlagsTable.reportId, reportId),
          eq(communityFlagsTable.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      return res
        .status(409)
        .json({ error: "Ya reportaste este reporte como falso." });
    }

    // Insertar flag
    await db.insert(communityFlagsTable).values({
      reportId,
      userId,
    });

    // Contar flags totales para este reporte
    const [{ count: flagCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityFlagsTable)
      .where(eq(communityFlagsTable.reportId, reportId));

    const totalFlags = Number(flagCount);
    let thresholdReached = false;

    // Si alcanzó el umbral, marcar como "reviewing"
    if (totalFlags >= COMMUNITY_FLAG_THRESHOLD && report.status === "active") {
      await db
        .update(reportsTable)
        .set({ status: "reviewing" as const, updatedAt: new Date() })
        .where(eq(reportsTable.id, reportId));
      thresholdReached = true;

      await db
        .insert(auditLogTable)
        .values({
          districtId: report.districtId,
          entityType: "report",
          entityId: report.id,
          action: "community_flagged",
          previousValue: report.status,
          newValue: "reviewing",
          changedBy: `community (${totalFlags} flags)`,
        })
        .catch(() => {});
    }

    return res.json({
      success: true,
      message: thresholdReached
        ? "Reporte enviado a revisión por la comunidad."
        : `Reporte marcado (${totalFlags}/${COMMUNITY_FLAG_THRESHOLD}). Se necesita ${COMMUNITY_FLAG_THRESHOLD} reportes para revisión.`,
      flagsCount: totalFlags,
      threshold: COMMUNITY_FLAG_THRESHOLD,
      underReview: thresholdReached,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to community flag report");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /reports/strikes/:id/revoke — Admin revoca un strike ────────────────
router.post(
  "/reports/strikes/:id/revoke",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const strikeId = parseInt(req.params.id as string);
      const adminUser = (req as any).jwtUser;

      const [strike] = await db
        .select()
        .from(userStrikesTable)
        .where(eq(userStrikesTable.id, strikeId))
        .limit(1);

      if (!strike)
        return res.status(404).json({ error: "Strike no encontrado." });

      if (!strike.activo) {
        return res.status(400).json({ error: "Este strike ya fue revocado." });
      }

      // Revocar strike
      await db
        .update(userStrikesTable)
        .set({ activo: false })
        .where(eq(userStrikesTable.id, strikeId));

      // Restaurar trustScore en +20 (sin exceder 100)
      await db
        .update(usersTable)
        .set({ trustScore: sql`LEAST(100, ${usersTable.trustScore} + 20)` })
        .where(eq(usersTable.id, strike.userId));

      // Si el usuario estaba suspendido y ahora tiene < 2 strikes activos, levantar suspensión
      const [{ count: activeStrikes }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userStrikesTable)
        .where(
          and(
            eq(userStrikesTable.userId, strike.userId),
            eq(userStrikesTable.activo, true),
          ),
        );

      if (Number(activeStrikes) < 2) {
        await db
          .update(usersTable)
          .set({ suspendedUntil: null })
          .where(eq(usersTable.id, strike.userId));
      }

      // Audit log
      const [strikeReport] = await db
        .select({ districtId: reportsTable.districtId })
        .from(reportsTable)
        .where(eq(reportsTable.id, strike.reportId))
        .limit(1);

      await db
        .insert(auditLogTable)
        .values({
          districtId: strikeReport?.districtId ?? 0,
          entityType: "strike",
          entityId: strikeId,
          action: "strike_revoked",
          previousValue: "activo",
          newValue: "revocado",
          changedBy: adminUser?.email ?? "unknown",
          changedById: adminUser ? Number(adminUser.sub) : undefined,
        })
        .catch(() => {});

      return res.json({
        success: true,
        message: "Strike revocado. TrustScore restaurado en +20.",
        strikeId: String(strikeId),
        userId: String(strike.userId),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to revoke strike");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── Item 7: POST /reports/strikes/:id/appeal — Vecino apela un strike ──────
// Crea un report_message sobre este strike para que el admin lo revise.
router.post("/reports/strikes/:id/appeal", requireAuth, async (req, res) => {
  const appealSchema = z.object({
    reason: z
      .string()
      .min(10, "Explica tu apelación (mín. 10 caracteres)")
      .max(1000),
  });
  const parsed = appealSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Motivo inválido" });
  }

  try {
    const strikeId = parseInt(req.params.id as string);
    const user = (req as any).jwtUser;
    const userId = parseInt(user.sub);

    const [strike] = await db
      .select()
      .from(userStrikesTable)
      .where(eq(userStrikesTable.id, strikeId))
      .limit(1);

    if (!strike)
      return res.status(404).json({ error: "Strike no encontrado." });

    if (strike.userId !== userId) {
      return res
        .status(403)
        .json({ error: "Solo puedes apelar tus propios strikes." });
    }

    if (!strike.activo) {
      return res
        .status(400)
        .json({ error: "Este strike ya fue resuelto o revocado." });
    }

    // Crear un mensaje en el hilo del reporte asociado al strike
    const [message] = await db
      .insert(reportMessagesTable)
      .values({
        reportId: strike.reportId,
        sender: "vecino",
        channel: "app",
        content: `⚠️ APELACIÓN DE STRIKE #${strike.id}:\n\n${parsed.data.reason}`,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Apelación enviada. Un administrador revisará tu caso.",
      strikeId: String(strikeId),
      messageId: String(message.id),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to appeal strike");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /reports/reviewing — Moderación: reportes en revisión ────────────────
router.get(
  "/reports/reviewing",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const districtId = getDistrictId(req);
      const conditions = [
        eq(reportsTable.status, "reviewing"),
        isNull(reportsTable.deletedAt),
      ];
      if (districtId) {
        conditions.push(eq(reportsTable.districtId, districtId));
      }

      const reports = await db
        .select()
        .from(reportsTable)
        .where(and(...conditions))
        .orderBy(desc(reportsTable.updatedAt))
        .limit(50);

      // Enriquecer con autor, strikes activos y flags en 3 consultas agrupadas
      // (antes: hasta 3 consultas POR reporte — N+1).
      const authorIds = [
        ...new Set(
          reports
            .map((r) => r.authorUserId)
            .filter((x): x is number => x != null),
        ),
      ];
      const reportIds = reports.map((r) => r.id);

      const authors = authorIds.length
        ? await db
            .select({
              id: usersTable.id,
              trustScore: usersTable.trustScore,
              name: usersTable.name,
            })
            .from(usersTable)
            .where(inArray(usersTable.id, authorIds))
        : [];
      const strikeRows = authorIds.length
        ? await db
            .select({
              userId: userStrikesTable.userId,
              count: sql<number>`count(*)`,
            })
            .from(userStrikesTable)
            .where(
              and(
                inArray(userStrikesTable.userId, authorIds),
                eq(userStrikesTable.activo, true),
              ),
            )
            .groupBy(userStrikesTable.userId)
        : [];
      const flagRows = reportIds.length
        ? await db
            .select({
              reportId: communityFlagsTable.reportId,
              count: sql<number>`count(*)`,
            })
            .from(communityFlagsTable)
            .where(inArray(communityFlagsTable.reportId, reportIds))
            .groupBy(communityFlagsTable.reportId)
        : [];

      const authorById = new Map(authors.map((a) => [a.id, a]));
      const strikesByUser = new Map(
        strikeRows.map((s) => [s.userId, Number(s.count)]),
      );
      const flagsByReport = new Map(
        flagRows.map((f) => [f.reportId, Number(f.count)]),
      );

      const enriched = reports.map((r) => {
        const author = r.authorUserId
          ? authorById.get(r.authorUserId)
          : undefined;
        return {
          id: String(r.id),
          title: r.title,
          description: r.description,
          category: r.category,
          urgency: r.urgency,
          status: r.status,
          sector: r.sector,
          district: r.district,
          districtId: r.districtId,
          authorName: author?.name ?? r.authorName,
          authorUserId: r.authorUserId ? String(r.authorUserId) : null,
          strikeCount: author ? (strikesByUser.get(r.authorUserId!) ?? 0) : 0,
          trustScore: author?.trustScore ?? 50,
          communityFlagCount: flagsByReport.get(r.id) ?? 0,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      });

      return res.json({ reports: enriched });
    } catch (err) {
      req.log.error({ err }, "Failed to get reviewing reports");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── POST /reports/:id/approve — Admin aprueba reporte en revisión ────────────
router.post(
  "/reports/:id/approve",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const [report] = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.id, parseInt(req.params.id as string)))
        .limit(1);

      if (!report)
        return res.status(404).json({ error: "Reporte no encontrado." });

      if (report.status !== "reviewing") {
        return res
          .status(400)
          .json({ error: "Solo se pueden aprobar reportes en revisión." });
      }

      if (!checkTenant(req, report.districtId)) {
        return res
          .status(403)
          .json({ error: "No puedes aprobar reportes de otro distrito." });
      }

      const adminUser = (req as any).jwtUser;

      // Volver a activo
      const [updated] = await db
        .update(reportsTable)
        .set({ status: "active" as const, updatedAt: new Date() })
        .where(eq(reportsTable.id, report.id))
        .returning();

      // Aumentar trustScore del autor en +5
      if (report.authorUserId) {
        await db
          .update(usersTable)
          .set({ trustScore: sql`LEAST(100, ${usersTable.trustScore} + 5)` })
          .where(eq(usersTable.id, report.authorUserId));
      }

      // Audit log
      await db
        .insert(auditLogTable)
        .values({
          districtId: report.districtId,
          entityType: "report",
          entityId: report.id,
          action: "approved_after_review",
          previousValue: "reviewing",
          newValue: "active",
          changedBy: adminUser?.email ?? "unknown",
          changedById: adminUser ? Number(adminUser.sub) : undefined,
        })
        .catch(() => {});

      return res.json({
        ...updated,
        id: String(updated.id),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        message: "Reporte aprobado y reactivado. TrustScore del autor +5.",
      });
    } catch (err) {
      req.log.error({ err }, "Failed to approve report");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── POST /reports/:id/static-info — Obtener info de punto estático ───────────
router.post("/reports/:id/static-info", optionalAuth, async (req, res) => {
  try {
    const [report] = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!report)
      return res.status(404).json({ error: "Reporte no encontrado." });

    // Buscar punto estático cercano (radio 50m)
    const LAT_DEG = 50 / 111000;
    const LNG_DEG = 50 / (111000 * Math.cos((report.latitude * Math.PI) / 180));

    const [staticPoint] = await db
      .select()
      .from(staticPointsTable)
      .where(
        and(
          eq(staticPointsTable.districtId, report.districtId),
          sql`${staticPointsTable.latitude} BETWEEN ${report.latitude - LAT_DEG} AND ${report.latitude + LAT_DEG}`,
          sql`${staticPointsTable.longitude} BETWEEN ${report.longitude - LNG_DEG} AND ${report.longitude + LNG_DEG}`,
        ),
      )
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
