import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, adSlotsTable, notificationsTable, panicAlertsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    res.json({
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
    res.status(500).json({ error: "Internal server error" });
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

    res.json({
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
    res.status(500).json({ error: "Internal server error" });
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

    res.json({
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
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ad-slots", async (req, res) => {
  try {
    const ads = await db.select().from(adSlotsTable);
    res.json({
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
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
