import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, adSlotsTable, notificationsTable, panicAlertsTable } from "@workspace/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "./auth";

const router: IRouter = Router();

// ── M-07: GET /users — AHORA CON AUTH + filtro por distrito ────────────────
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = (req as any).jwtUser;

    // super_admin: ver todos los usuarios
    // admin/moderator: ver solo usuarios de su distrito
    const users = user.role === "super_admin"
      ? await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(200)
      : await db.select().from(usersTable)
          .where(eq(usersTable.districtId, Number(user.districtId)))
          .orderBy(desc(usersTable.createdAt))
          .limit(200);

    return res.json({
      users: users.map(u => ({
        id: String(u.id),
        name: u.name,
        email: u.email,
        role: u.role,
        sector: u.sector,
        district: u.district,
        districtId: u.districtId,
        isActive: u.isActive,
        reportsCount: u.reportsCount,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get users");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── M-06: PATCH /users/:id — AHORA CON AUTH ──────────────────────────────
router.patch("/users/:id", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    sector: z.string().optional(),
    district: z.string().optional(),
    dni: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
  }

  try {
    const authUser = (req as any).jwtUser;
    const targetId = parseInt(req.params.id as string);

    const [target] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, targetId))
      .limit(1);

    if (!target) return res.status(404).json({ error: "Usuario no encontrado." });

    // Solo el propio usuario o admin/super_admin pueden editar
    const isSelf = authUser.sub === String(targetId);
    const isAdmin = ["admin", "moderator", "super_admin"].includes(authUser.role);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: "No tienes permiso para editar este usuario." });
    }

    // Si es admin (no super_admin), solo puede editar usuarios de su mismo distrito
    if (isAdmin && authUser.role !== "super_admin" && Number(authUser.districtId) !== Number(target.districtId)) {
      return res.status(403).json({ error: "No puedes editar usuarios de otro distrito." });
    }

    const [updated] = await db.update(usersTable)
      .set(parsed.data)
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
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── M-01: GET /notifications — filtrado por distrito ────────────────────────
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const user = (req as any).jwtUser;

    const notifications = await db.select()
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, parseInt(user.sub)),
        eq(notificationsTable.districtId, Number(user.districtId)),
      ))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    return res.json({
      notifications: notifications.map(n => ({
        ...n,
        id: String(n.id),
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount: notifications.filter(n => !n.isRead).length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get notifications");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /ad-slots ───────────────────────────────────────────────────────────
router.get("/ad-slots", async (req, res) => {
  try {
    const districtId = req.query.districtId ? Number(req.query.districtId as string) : null;
    const query = districtId
      ? db.select().from(adSlotsTable).where(eq(adSlotsTable.districtId, districtId))
      : db.select().from(adSlotsTable);

    const ads = await query;

    return res.json({
      ads: ads.map(ad => ({
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
    return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
  }

  const user = (req as any).jwtUser;
  let districtId: number;
  if (user.role === "super_admin" && parsed.data.districtId) {
    districtId = parsed.data.districtId;
  } else {
    districtId = Number(user.districtId);
  }

  try {
    const [ad] = await db.insert(adSlotsTable).values({
      districtId,
      businessName: parsed.data.businessName,
      tagline: parsed.data.tagline,
      imageUrl: parsed.data.imageUrl ?? null,
      targetUrl: parsed.data.targetUrl,
      sector: parsed.data.sector ?? null,
    }).returning();

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

// ── PATCH /ad-slots/:id — M-04: con chequeo de tenant ─────────────────────
router.patch("/ad-slots/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [ad] = await db.select()
      .from(adSlotsTable)
      .where(eq(adSlotsTable.id, parseInt(req.params.id as string)))
      .limit(1);

    if (!ad) return res.status(404).json({ error: "Ad slot no encontrado." });

    const user = (req as any).jwtUser;
    if (user.role !== "super_admin" && Number(user.districtId) !== Number(ad.districtId)) {
      return res.status(403).json({ error: "No puedes modificar slots de otro distrito." });
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
      return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
    }

    const [updated] = await db.update(adSlotsTable)
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

export default router;
