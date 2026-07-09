import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  usersTable,
  adSlotsTable,
  notificationsTable,
  panicAlertsTable,
  reportsTable,
  auditLogTable,
  licensesTable,
  userStrikesTable,
} from "@workspace/db/schema";
import { desc, eq, and, sql, count } from "drizzle-orm";
import { requireAuth, requireAdmin, requireMunicipal } from "./auth";
import { isMunicipalityLevel } from "../lib/roles";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

// ── GET /users — listar usuarios (super_admin ve todos, admin/moderator ve su distrito) ──
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = (req as any).jwtUser;
    const canSeeEmails = user.role === "super_admin";

    const users =
      user.role === "super_admin"
        ? await db
            .select()
            .from(usersTable)
            .orderBy(desc(usersTable.createdAt))
            .limit(200)
        : await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.districtId, Number(user.districtId)))
            .orderBy(desc(usersTable.createdAt))
            .limit(200);

    return res.json({
      users: users.map((u) => ({
        id: String(u.id),
        name: u.name,
        // Solo super_admin ve emails de vecinos; admins ven emails de backoffice
        email: canSeeEmails || u.role !== "user" ? u.email : undefined,
        role: u.role,
        sector: u.sector,
        district: u.district,
        districtId: u.districtId,
        isActive: u.isActive,
        reportsCount: u.reportsCount,
        trustScore: u.trustScore ?? 50,
        suspendedUntil: u.suspendedUntil?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get users");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /users/manage — crear usuario (super_admin crea cualquiera, admin crea solo en su distrito) ──
router.post("/users/manage", requireAuth, requireAdmin, async (req, res) => {
  const createUserSchema = z.object({
    name: z.string().min(2, "Nombre muy corto").max(100),
    email: z.string().email("Email inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
      .regex(/[a-z]/, "Debe contener al menos una minúscula")
      .regex(/[0-9]/, "Debe contener al menos un número"),
    role: z.enum(["admin", "moderator", "user"]).default("user"),
    sector: z.string().min(1, "Sector requerido").max(100),
    district: z.string().min(1).max(100).optional(),
    districtId: z.number().optional(),
  });

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }

  const authUser = (req as any).jwtUser;
  const { name, email, password, role, sector, district, districtId } =
    parsed.data;

  // Validar permisos: super_admin puede crear cualquier rol
  // Admin/moderator solo puede crear "user" en su distrito
  if (authUser.role !== "super_admin" && role !== "user") {
    return res.status(403).json({
      error: "Solo el superadmin puede crear cuentas de administrador.",
    });
  }

  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: "Ya existe un usuario con ese correo." });
    }

    const finalDistrictId = districtId ?? Number(authUser.districtId);
    const finalDistrict = district ?? authUser.district ?? "San Ramón";

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role: role as any,
        sector,
        districtId: finalDistrictId,
        district: finalDistrict,
        isActive: true,
        reportsCount: 0,
      })
      .returning();

    return res.status(201).json({
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      sector: user.sector,
      district: user.district,
      districtId: user.districtId,
      isActive: user.isActive,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create user");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /users/:id/stats — estadísticas de desempeño de un usuario admin ──
router.get("/users/:id/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const authUser = (req as any).jwtUser;
    const targetId = parseInt(req.params.id as string);

    const [target] = await db
      .select({
        id: usersTable.id,
        districtId: usersTable.districtId,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(eq(usersTable.id, targetId))
      .limit(1);
    if (!target)
      return res.status(404).json({ error: "Usuario no encontrado." });

    // super_admin ve stats de cualquiera; admin solo ve los de su distrito
    if (
      authUser.role !== "super_admin" &&
      Number(authUser.districtId) !== Number(target.districtId)
    ) {
      return res.status(403).json({
        error: "No puedes ver estadísticas de usuarios de otro distrito.",
      });
    }

    // Obtener métricas de este usuario desde audit_log
    const [{ totalActions }] = await db
      .select({ totalActions: sql<number>`count(*)` })
      .from(auditLogTable)
      .where(eq(auditLogTable.changedById, targetId));

    const [{ resolvedBy }] = await db
      .select({ resolvedBy: sql<number>`count(*)` })
      .from(auditLogTable)
      .where(
        and(
          eq(auditLogTable.changedById, targetId),
          eq(auditLogTable.action, "resolved_with_message"),
        ),
      );

    const [{ messagesSent }] = await db
      .select({ messagesSent: sql<number>`count(*)` })
      .from(auditLogTable)
      .where(
        and(
          eq(auditLogTable.changedById, targetId),
          eq(auditLogTable.action, "message_sent"),
        ),
      );

    return res.json({
      userId: String(target.id),
      totalActions: Number(totalActions),
      resolvedReports: Number(resolvedBy),
      messagesSent: Number(messagesSent),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user stats");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── PATCH /users/:id/status — activar/desactivar usuario ─────────────────────
router.patch(
  "/users/:id/status",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    }

    try {
      const authUser = (req as any).jwtUser;
      const targetId = parseInt(req.params.id as string);

      const [target] = await db
        .select({
          id: usersTable.id,
          districtId: usersTable.districtId,
          role: usersTable.role,
        })
        .from(usersTable)
        .where(eq(usersTable.id, targetId))
        .limit(1);
      if (!target)
        return res.status(404).json({ error: "Usuario no encontrado." });

      // super_admin puede desactivar cualquiera; admin solo los de su distrito
      if (
        authUser.role !== "super_admin" &&
        Number(authUser.districtId) !== Number(target.districtId)
      ) {
        return res
          .status(403)
          .json({ error: "No puedes modificar usuarios de otro distrito." });
      }

      // No permitir desactivarse a sí mismo
      if (authUser.sub === String(targetId)) {
        return res
          .status(400)
          .json({ error: "No puedes desactivar tu propia cuenta." });
      }

      const [updated] = await db
        .update(usersTable)
        .set({ isActive: parsed.data.isActive })
        .where(eq(usersTable.id, targetId))
        .returning();

      return res.json({
        id: String(updated.id),
        name: updated.name,
        isActive: updated.isActive,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to update user status");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── PATCH /users/:id — actualizar perfil ─────────────────────────────────────
router.patch("/users/:id", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    sector: z.string().optional(),
    district: z.string().optional(),
    dni: z.string().nullable().optional(),
    // Nombre en clave editable: reemplaza al "Vecino XXXXXX" autogenerado.
    // Se permite vaciar (null) para volver al código autogenerado.
    alias: z
      .string()
      .trim()
      .min(3, "El nombre en clave debe tener al menos 3 caracteres")
      .max(30, "El nombre en clave no puede superar 30 caracteres")
      .regex(
        /^[\p{L}\p{N} _.\-]+$/u,
        "Solo letras, números, espacios, guiones, puntos y guion bajo",
      )
      .nullable()
      .optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }

  try {
    const authUser = (req as any).jwtUser;
    const targetId = parseInt(req.params.id as string);

    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, targetId))
      .limit(1);

    if (!target)
      return res.status(404).json({ error: "Usuario no encontrado." });

    const isSelf = authUser.sub === String(targetId);
    const isAdmin = isMunicipalityLevel(authUser.role);

    if (!isSelf && !isAdmin) {
      return res
        .status(403)
        .json({ error: "No tienes permiso para editar este usuario." });
    }

    if (
      isAdmin &&
      authUser.role !== "super_admin" &&
      Number(authUser.districtId) !== Number(target.districtId)
    ) {
      return res
        .status(403)
        .json({ error: "No puedes editar usuarios de otro distrito." });
    }

    // El alias solo lo puede cambiar el propio usuario (o un admin del distrito)
    const updateData: Record<string, unknown> = { ...parsed.data };
    if ("alias" in updateData) {
      if (!isSelf && !isAdmin) {
        delete updateData.alias;
      } else if (typeof updateData.alias === "string") {
        // Evitar alias que suplanten identidades del sistema
        const lowered = (updateData.alias as string).toLowerCase();
        if (
          lowered.includes("admin") ||
          lowered.includes("municipal") ||
          lowered.includes("serenazgo") ||
          lowered === "anónimo" ||
          lowered === "anonimo"
        ) {
          return res.status(400).json({
            error: "Ese nombre en clave no está permitido. Elige otro.",
          });
        }
        // Verificar que otro vecino no use ya ese alias
        const [taken] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.alias, updateData.alias as string))
          .limit(1);
        if (taken && taken.id !== targetId) {
          return res
            .status(409)
            .json({ error: "Ese nombre en clave ya está en uso. Elige otro." });
        }
      }
    }

    const [updated] = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, targetId))
      .returning();

    return res.json({
      id: String(updated.id),
      name: updated.name,
      email: updated.email,
      role: updated.role,
      sector: updated.sector,
      district: updated.district,
      districtId: updated.districtId,
      isActive: updated.isActive,
      reportsCount: updated.reportsCount,
      alias: updated.alias ?? null,
      vecinoId: updated.vecinoId ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /notifications — notificaciones del usuario autenticado ─────────────
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const user = (req as any).jwtUser;
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, parseInt(user.sub)),
          eq(notificationsTable.districtId, Number(user.districtId)),
        ),
      )
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    return res.json({
      notifications: notifications.map((n) => ({
        ...n,
        id: String(n.id),
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get notifications");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /ad-slots ───────────────────────────────────────────────────────────
router.get("/ad-slots", async (req, res) => {
  try {
    const districtId = req.query.districtId
      ? Number(req.query.districtId as string)
      : null;
    const query = districtId
      ? db
          .select()
          .from(adSlotsTable)
          .where(eq(adSlotsTable.districtId, districtId))
      : db.select().from(adSlotsTable);

    const ads = await query;
    return res.json({
      ads: ads.map((ad) => ({
        id: String(ad.id),
        businessName: ad.businessName,
        tagline: ad.tagline,
        imageUrl: ad.imageUrl,
        targetUrl: ad.targetUrl,
        isActive: ad.isActive,
        sector: ad.sector ?? null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get ad slots");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /ad-slots ──────────────────────────────────────────────────────────
router.post("/ad-slots", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    businessName: z.string().min(1),
    tagline: z.string().min(1),
    imageUrl: z.string().optional().nullable(),
    targetUrl: z.string().min(1),
    sector: z.string().optional().nullable(),
    districtId: z.number().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }

  const user = (req as any).jwtUser;
  let districtId: number;
  if (user.role === "super_admin" && parsed.data.districtId) {
    districtId = parsed.data.districtId;
  } else {
    districtId = Number(user.districtId);
  }

  try {
    const [ad] = await db
      .insert(adSlotsTable)
      .values({
        districtId,
        businessName: parsed.data.businessName,
        tagline: parsed.data.tagline,
        imageUrl: parsed.data.imageUrl ?? null,
        targetUrl: parsed.data.targetUrl,
        sector: parsed.data.sector ?? null,
      })
      .returning();

    return res.status(201).json({
      id: String(ad.id),
      businessName: ad.businessName,
      tagline: ad.tagline,
      imageUrl: ad.imageUrl,
      targetUrl: ad.targetUrl,
      isActive: ad.isActive,
      sector: ad.sector ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create ad slot");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── PATCH /ad-slots/:id ─────────────────────────────────────────────────────
router.patch("/ad-slots/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [ad] = await db
      .select()
      .from(adSlotsTable)
      .where(eq(adSlotsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!ad) return res.status(404).json({ error: "Ad slot no encontrado." });

    const user = (req as any).jwtUser;
    if (
      user.role !== "super_admin" &&
      Number(user.districtId) !== Number(ad.districtId)
    ) {
      return res
        .status(403)
        .json({ error: "No puedes modificar slots de otro distrito." });
    }

    const schema = z.object({
      businessName: z.string().optional(),
      tagline: z.string().optional(),
      imageUrl: z.string().optional().nullable(),
      targetUrl: z.string().optional(),
      isActive: z.boolean().optional(),
      sector: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const [updated] = await db
      .update(adSlotsTable)
      .set(parsed.data)
      .where(eq(adSlotsTable.id, parseInt(req.params.id as string)))
      .returning();

    return res.json({
      id: String(updated.id),
      businessName: updated.businessName,
      tagline: updated.tagline,
      imageUrl: updated.imageUrl,
      targetUrl: updated.targetUrl,
      isActive: updated.isActive,
      sector: updated.sector ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update ad slot");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// VIEWERS — Gestión de usuarios visores (solo municipal)
// ═════════════════════════════════════════════════════════════════════════════

// ── POST /users/viewers — Crear viewer (municipal, máx 10) ────────────────
const createViewerSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(100),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  displayName: z
    .string()
    .min(1, "Nombre para mostrar requerido (ej: Claudia Meza)")
    .max(200),
  sector: z.string().min(1, "Sector requerido").max(100).default("General"),
});

router.post(
  "/users/viewers",
  requireAuth,
  requireMunicipal,
  async (req, res) => {
    const parsed = createViewerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const authUser = (req as any).jwtUser;
    const { name, email, password, displayName, sector } = parsed.data;

    try {
      // 1. Verificar que el municipal tenga licencia activa
      const [license] = await db
        .select()
        .from(licensesTable)
        .where(
          and(
            eq(licensesTable.municipalUserId, Number(authUser.sub)),
            eq(licensesTable.isActive, true),
          ),
        )
        .limit(1);

      if (!license) {
        return res.status(403).json({
          error:
            "No tienes una licencia activa. Actívala en /licenses/activate.",
        });
      }

      // 2. Contar viewers actuales del municipal
      const [{ count: currentViewers }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.role, "viewer"),
            eq(usersTable.districtId, Number(authUser.districtId)),
          ),
        );

      if (Number(currentViewers) >= license.maxViewers) {
        return res.status(409).json({
          error: `Has alcanzado el límite de ${license.maxViewers} visores. Contacta al superadmin para aumentarlo.`,
        });
      }

      // 3. Verificar email único
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email.toLowerCase().trim()))
        .limit(1);
      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: "Ya existe un usuario con ese correo." });
      }

      // 4. Crear viewer
      const passwordHash = await bcrypt.hash(password, 10);
      const [viewer] = await db
        .insert(usersTable)
        .values({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash,
          role: "viewer" as any,
          sector: sector.trim(),
          districtId: Number(authUser.districtId),
          district: authUser.district ?? "San Ramón",
          province: authUser.province ?? "Chanchamayo",
          department: authUser.department ?? "Junín",
          displayName: displayName.trim(),
          isActive: true,
          reportsCount: 0,
        })
        .returning();

      return res.status(201).json({
        success: true,
        message: `Visor ${email} creado. DisplayName: ${displayName}`,
        user: {
          id: String(viewer.id),
          name: viewer.name,
          email: viewer.email,
          role: viewer.role,
          displayName: viewer.displayName,
          sector: viewer.sector,
        },
        viewersUsed: Number(currentViewers) + 1,
        viewersLimit: license.maxViewers,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to create viewer");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── GET /users/viewers — Listar viewers del municipal ──────────────────────
router.get(
  "/users/viewers",
  requireAuth,
  requireMunicipal,
  async (req, res) => {
    const authUser = (req as any).jwtUser;

    try {
      const viewers = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.role, "viewer"),
            eq(usersTable.districtId, Number(authUser.districtId)),
          ),
        )
        .orderBy(desc(usersTable.createdAt));

      // Obtener info de la licencia
      const [license] = await db
        .select()
        .from(licensesTable)
        .where(eq(licensesTable.municipalUserId, Number(authUser.sub)))
        .limit(1);

      return res.json({
        viewers: viewers.map((v) => ({
          id: String(v.id),
          name: v.name,
          email: v.email,
          displayName: v.displayName,
          isActive: v.isActive,
          createdAt: v.createdAt.toISOString(),
        })),
        viewersUsed: viewers.length,
        viewersLimit: license?.maxViewers ?? 10,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to list viewers");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── PATCH /users/viewers/:id — Desactivar/activar viewer ──────────────────
router.patch(
  "/users/viewers/:id",
  requireAuth,
  requireMunicipal,
  async (req, res) => {
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    }

    const authUser = (req as any).jwtUser;
    const targetId = parseInt(req.params.id as string);

    try {
      const [target] = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, targetId),
            eq(usersTable.role, "viewer"),
            eq(usersTable.districtId, Number(authUser.districtId)),
          ),
        )
        .limit(1);

      if (!target) {
        return res
          .status(404)
          .json({ error: "Visor no encontrado o no pertenece a tu distrito." });
      }

      const [updated] = await db
        .update(usersTable)
        .set({ isActive: parsed.data.isActive })
        .where(eq(usersTable.id, targetId))
        .returning();

      return res.json({
        id: String(updated.id),
        name: updated.name,
        email: updated.email,
        displayName: updated.displayName,
        isActive: updated.isActive,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to update viewer status");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// FASE 5: Strike system endpoints
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /users/:id/strikes — Historial de strikes de un usuario ──────────────
router.get(
  "/users/:id/strikes",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const authUser = (req as any).jwtUser;
      const targetId = parseInt(req.params.id as string);

      const [target] = await db
        .select({ id: usersTable.id, districtId: usersTable.districtId })
        .from(usersTable)
        .where(eq(usersTable.id, targetId))
        .limit(1);
      if (!target)
        return res.status(404).json({ error: "Usuario no encontrado." });

      if (
        authUser.role !== "super_admin" &&
        Number(authUser.districtId) !== Number(target.districtId)
      ) {
        return res.status(403).json({
          error: "No puedes ver strikes de usuarios de otro distrito.",
        });
      }

      const strikes = await db
        .select()
        .from(userStrikesTable)
        .where(eq(userStrikesTable.userId, targetId))
        .orderBy(desc(userStrikesTable.createdAt))
        .limit(50);

      // Enriquecer con nombre del admin que aplicó el strike y título del reporte
      const enriched = await Promise.all(
        strikes.map(async (s) => {
          const [admin] = await db
            .select({ name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, s.adminId))
            .limit(1);
          const [report] = await db
            .select({ title: reportsTable.title })
            .from(reportsTable)
            .where(eq(reportsTable.id, s.reportId))
            .limit(1);
          return {
            id: String(s.id),
            userId: String(s.userId),
            reportId: String(s.reportId),
            reportTitle: report?.title ?? "Reporte eliminado",
            motivo: s.motivo,
            adminName: admin?.name ?? "Desconocido",
            adminId: String(s.adminId),
            activo: s.activo,
            createdAt: s.createdAt.toISOString(),
            expiresAt: s.expiresAt?.toISOString() ?? null,
          };
        }),
      );

      return res.json({ strikes: enriched });
    } catch (err) {
      req.log.error({ err }, "Failed to get user strikes");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── POST /users/:id/lift-suspension — Admin levanta suspensión de un usuario ─
router.post(
  "/users/:id/lift-suspension",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const authUser = (req as any).jwtUser;
      const targetId = parseInt(req.params.id as string);

      const [target] = await db
        .select({ id: usersTable.id, districtId: usersTable.districtId })
        .from(usersTable)
        .where(eq(usersTable.id, targetId))
        .limit(1);
      if (!target)
        return res.status(404).json({ error: "Usuario no encontrado." });

      if (
        authUser.role !== "super_admin" &&
        Number(authUser.districtId) !== Number(target.districtId)
      ) {
        return res
          .status(403)
          .json({ error: "No puedes modificar usuarios de otro distrito." });
      }

      await db
        .update(usersTable)
        .set({ suspendedUntil: null })
        .where(eq(usersTable.id, targetId));

      await db
        .insert(auditLogTable)
        .values({
          districtId: target.districtId,
          entityType: "user",
          entityId: targetId,
          action: "suspension_lifted",
          previousValue: "suspended",
          newValue: "active",
          changedBy: authUser?.email ?? "unknown",
          changedById: authUser ? Number(authUser.sub) : undefined,
        })
        .catch(() => {});

      return res.json({
        success: true,
        message: "Suspensión levantada correctamente.",
        userId: String(targetId),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to lift suspension");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

export default router;
