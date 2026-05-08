import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, adSlotsTable, notificationsTable, panicAlertsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "./auth";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    return res.json({
      users: users.map(u => ({
        id: String(u.id),
        name: u.name,
        email: u.email,
        role: u.role,
        sector: u.sector,
        district: u.district,
        isActive: u.isActive,
        reportsCount: u.reportsCount,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// B-22: Update user profile (name, sector, district, dni)
const patchUserSchema = z.object({
  name:     z.string().min(2).max(100).optional(),
  sector:   z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  dni:      z.string().regex(/^\d{8}$/, "DNI debe tener 8 dígitos").optional().nullable(),
});

router.patch("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const parsed = patchUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
    }

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (parsed.data.name     !== undefined) updates.name     = parsed.data.name;
    if (parsed.data.sector   !== undefined) updates.sector   = parsed.data.sector;
    if (parsed.data.district !== undefined) updates.district = parsed.data.district;
    if (parsed.data.dni      !== undefined) updates.dni      = parsed.data.dni ?? undefined;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Sin campos para actualizar" });
    }

    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    return res.json({
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      sector: user.sector,
      district: user.district,
      dni: user.dni ?? null,
      isActive: user.isActive,
      reportsCount: user.reportsCount,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// B-16: Notifications — real DB-backed notifications
router.get("/notifications", async (req, res) => {
  try {
    const userId = (req as any).jwtUser?.sub
      ? parseInt((req as any).jwtUser.sub)
      : null;

    const notifs = await db.select()
      .from(notificationsTable)
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    const unreadCount = notifs.filter(n => !n.isRead).length;

    return res.json({
      notifications: notifs.map(n => ({
        id: String(n.id),
        type: n.type,
        title: n.title,
        body: n.body,
        referenceId: n.referenceId,
        referenceType: n.referenceType,
        read: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get notifications");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ad-slots", async (req, res) => {
  try {
    const ads = await db.select().from(adSlotsTable);
    return res.json({
      ads: ads.map(a => ({
        id: String(a.id),
        businessName: a.businessName,
        tagline: a.tagline,
        imageUrl: a.imageUrl ?? null,
        targetUrl: a.targetUrl,
        isActive: a.isActive,
        sector: a.sector ?? null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get ad slots");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /ad-slots — Create a new ad slot (admin only)
const createAdSlotSchema = z.object({
  businessName: z.string().min(2, "businessName requerido"),
  tagline:      z.string().min(2, "tagline requerido"),
  imageUrl:     z.string().nullable().optional(),
  targetUrl:    z.string().min(1, "targetUrl requerido"),
  isActive:     z.boolean().optional(),
  sector:       z.string().nullable().optional(),
});

router.post("/ad-slots", requireAuth, requireAdmin, async (req, res) => {
  try {
    const parsed = createAdSlotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });
    }
    const data = parsed.data;
    const [ad] = await db.insert(adSlotsTable).values({
      businessName: data.businessName,
      tagline:      data.tagline,
      imageUrl:     data.imageUrl ?? null,
      targetUrl:    data.targetUrl,
      isActive:     data.isActive ?? true,
      sector:       data.sector ?? null,
    }).returning();
    return res.status(201).json({
      id:           String(ad.id),
      businessName: ad.businessName,
      tagline:      ad.tagline,
      imageUrl:     ad.imageUrl ?? null,
      targetUrl:    ad.targetUrl,
      isActive:     ad.isActive,
      sector:       ad.sector ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create ad slot");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /ad-slots/:id — Update an ad slot (admin only)
const updateAdSlotSchema = z.object({
  businessName: z.string().min(2).optional(),
  tagline:      z.string().min(2).optional(),
  imageUrl:     z.string().nullable().optional(),
  targetUrl:    z.string().min(1).optional(),
  isActive:     z.boolean().optional(),
  sector:       z.string().nullable().optional(),
});

router.patch("/ad-slots/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const parsed = updateAdSlotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", detail: parsed.error.issues });
    }

    const data = parsed.data;
    const updates: Record<string, any> = {};
    if (data.businessName !== undefined) updates.businessName = data.businessName;
    if (data.tagline !== undefined)      updates.tagline      = data.tagline;
    if (data.imageUrl !== undefined)     updates.imageUrl     = data.imageUrl;
    if (data.targetUrl !== undefined)    updates.targetUrl    = data.targetUrl;
    if (data.isActive !== undefined)     updates.isActive     = data.isActive;
    if (data.sector !== undefined)       updates.sector       = data.sector;

    const [ad] = await db.update(adSlotsTable).set(updates).where(eq(adSlotsTable.id, id)).returning();
    if (!ad) return res.status(404).json({ error: "Ad slot no encontrado" });

    return res.json({
      id:           String(ad.id),
      businessName: ad.businessName,
      tagline:      ad.tagline,
      imageUrl:     ad.imageUrl ?? null,
      targetUrl:    ad.targetUrl,
      isActive:     ad.isActive,
      sector:       ad.sector ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update ad slot");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
