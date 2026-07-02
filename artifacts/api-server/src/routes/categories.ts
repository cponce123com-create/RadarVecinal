/**
 * categories.ts — CRUD de categorías dinámicas y departamentos
 *
 * Reemplaza el pgEnum fijo de report_category por registros en DB,
 * permitiendo que los admins creen/editen categorías sin migración.
 * Los departamentos permiten asignar reportes a Serenazgo/Limpieza/etc.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { categoriesTable, departmentsTable, reportsTable, auditLogTable, subscriptionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "./auth";
import { getDistrictId, checkTenant } from "./tenant";

const router: IRouter = Router();

// ── GET /categories — públicas, filtradas por distrito (o todas si activas) ─
router.get("/categories", async (req, res) => {
  try {
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.isActive, true))
      .orderBy(categoriesTable.sortOrder);
    return res.json({ categories });
  } catch (err) {
    req.log.error({ err }, "Failed to get categories");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /categories — solo admin ───────────────────────────────────────────
router.post("/categories", requireAuth, requireAdmin, async (req, res) => {
  const parsed = z.object({
    slug: z.string().min(2).max(50),
    label: z.string().min(2).max(100),
    icon: z.string().optional().default("AlertTriangle"),
    color: z.string().optional().default("#6b7280"),
    sortOrder: z.number().int().optional().default(0),
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
  }

  try {
    const [cat] = await db.insert(categoriesTable).values(parsed.data).returning();
    return res.status(201).json(cat);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Ya existe una categoría con ese slug." });
    req.log.error({ err }, "Failed to create category");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /departments — por distrito ────────────────────────────────────────
router.get("/departments", async (req, res) => {
  try {
    const districtId = getDistrictId(req);
    if (!districtId) return res.json({ departments: [] });

    const departments = await db.select()
      .from(departmentsTable)
      .where(and(eq(departmentsTable.districtId, districtId), eq(departmentsTable.isActive, true)))
      .orderBy(departmentsTable.name);
    return res.json({ departments });
  } catch (err) {
    req.log.error({ err }, "Failed to get departments");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /departments — solo admin ─────────────────────────────────────────
router.post("/departments", requireAuth, requireAdmin, async (req, res) => {
  const districtId = getDistrictId(req);
  if (!districtId) return res.status(400).json({ error: "Se requiere distrito." });

  const parsed = z.object({
    name: z.string().min(2).max(100),
    slug: z.string().min(2).max(50),
    description: z.string().optional().default(""),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });

  try {
    const [dept] = await db.insert(departmentsTable).values({ ...parsed.data, districtId }).returning();
    return res.status(201).json(dept);
  } catch (err) {
    req.log.error({ err }, "Failed to create department");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── PATCH /reports/:id/assign — asignar a departamento ─────────────────────
router.patch("/reports/:id/assign", requireAuth, requireAdmin, async (req, res) => {
  const user = (req as any).jwtUser;
  const reportId = parseInt(req.params.id as string);
  const parsed = z.object({ departmentId: z.number().int().nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "departmentId requerido (número o null)." });

  try {
    const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, reportId)).limit(1);
    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });
    if (!checkTenant(req, report.districtId)) return res.status(403).json({ error: "No puedes asignar reportes de otro distrito." });

    const previousDept = report.assignedTo;
    await db.update(reportsTable).set({ assignedTo: parsed.data.departmentId }).where(eq(reportsTable.id, reportId));

    // Audit log
    await db.insert(auditLogTable).values({
      districtId: report.districtId,
      entityType: "report",
      entityId: reportId,
      action: "assigned",
      previousValue: previousDept ? String(previousDept) : null,
      newValue: parsed.data.departmentId ? String(parsed.data.departmentId) : null,
      changedBy: user.email,
      changedById: Number(user.sub),
    });

    return res.json({ assignedTo: parsed.data.departmentId });
  } catch (err) {
    req.log.error({ err }, "Failed to assign report");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /reports/:id/timeline — timeline público del reporte ────────────────
router.get("/reports/:id/timeline", async (req, res) => {
  try {
    const reportId = parseInt(req.params.id as string);
    const entries = await db.select()
      .from(auditLogTable)
      .where(and(eq(auditLogTable.entityType, "report"), eq(auditLogTable.entityId, reportId)))
      .orderBy(auditLogTable.createdAt);

    return res.json({ entries: entries.map(e => ({ ...e, id: String(e.id), createdAt: e.createdAt.toISOString() })) });
  } catch (err) {
    req.log.error({ err }, "Failed to get timeline");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /subscriptions — vecino se suscribe a categorías/sectores ─────────
router.post("/subscriptions", async (req, res) => {
  const parsed = z.object({
    districtId: z.number().int(),
    fcmToken: z.string().optional(),
    email: z.string().email().optional(),
    categories: z.array(z.string()).optional().default([]),
    sectors: z.array(z.string()).optional().default([]),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
  if (!parsed.data.fcmToken && !parsed.data.email) return res.status(400).json({ error: "Se requiere fcmToken o email." });

  try {
    // Upsert: si ya existe un token igual, actualizar preferencias
    const existing = parsed.data.fcmToken
      ? await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.fcmToken, parsed.data.fcmToken)).limit(1)
      : [];

    if (existing.length > 0) {
      const [updated] = await db.update(subscriptionsTable).set({
        categories: JSON.stringify(parsed.data.categories),
        sectors: JSON.stringify(parsed.data.sectors),
        updatedAt: new Date(),
      }).where(eq(subscriptionsTable.id, existing[0].id)).returning();
      return res.json(updated);
    }

    const [sub] = await db.insert(subscriptionsTable).values({
      districtId: parsed.data.districtId,
      fcmToken: parsed.data.fcmToken ?? null,
      email: parsed.data.email ?? null,
      categories: JSON.stringify(parsed.data.categories),
      sectors: JSON.stringify(parsed.data.sectors),
    }).returning();

    return res.status(201).json(sub);
  } catch (err) {
    req.log.error({ err }, "Failed to create subscription");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
