import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, adSlotsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

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
