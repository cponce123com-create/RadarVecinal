import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  licensesTable,
  usersTable,
  districtsTable,
  reportsTable,
  panicAlertsTable,
  auditLogTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { requireAuth } from "./auth";
import { generateLicenseCode, formatLicenseResponse } from "../lib/license";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Admin Routes — Panel de Super Administrador
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Solo accesible para super_admin (cponce123.com@gmail.com).
 *
 * - POST /admin/licenses/generate   — Generar código de 16 dígitos (4 cajas)
 * - GET  /admin/licenses            — Listar todas las licencias
 * - POST /admin/licenses/:id/revoke — Revocar licencia
 * - POST /admin/municipal-users     — Crear usuario municipal + asignar licencia
 * - GET  /admin/municipal-users     — Listar usuarios municipales
 * - GET  /admin/stats               — Dashboard de estadísticas
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Helper: verificar que solo super_admin acceda ───────────────────────────
function requireSuperAdmin(req: any, res: any, next: any) {
  const user = req.jwtUser;
  if (!user || user.role !== "super_admin") {
    return res.status(403).json({
      error: "Acceso denegado. Solo el superadmin puede acceder a este panel.",
    });
  }
  return next();
}

// ═════════════════════════════════════════════════════════════════════════════
// LICENCIAS
// ═════════════════════════════════════════════════════════════════════════════

// ── POST /admin/licenses/generate — Generar código de 16 dígitos (4 cajas) ──
const generateSchema = z.object({
  siglas: z.string().min(1, "Siglas requeridas (ej: MDSR)").max(10),
  distrito: z.string().min(1, "Distrito requerido"),
  provincia: z.string().min(1, "Provincia requerida"),
  departamento: z.string().min(1, "Departamento requerido"),
  maxViewers: z.number().int().min(1).max(100).default(10),
});

router.post(
  "/admin/licenses/generate",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const { siglas, distrito, provincia, departamento, maxViewers } =
      parsed.data;
    const user = (req as any).jwtUser;

    try {
      // 1. Generar código de 16 dígitos
      const code = generateLicenseCode(
        siglas,
        distrito,
        provincia,
        departamento,
      );

      // 2. Buscar distrito en catálogo por nombre
      const [district] = await db
        .select()
        .from(districtsTable)
        .where(eq(districtsTable.name, distrito.trim()))
        .limit(1);

      // 3. Guardar en DB
      const [license] = await db
        .insert(licensesTable)
        .values({
          code,
          siglas: siglas.toUpperCase().trim(),
          districtName: distrito.trim(),
          province: provincia.trim(),
          department: departamento.trim(),
          districtId: district?.id ?? null,
          createdBy: Number(user.sub),
          isActive: false,
          maxViewers,
        })
        .returning();

      return res.status(201).json({
        success: true,
        message: `Código generado para ${siglas.toUpperCase()} / ${distrito}. Entrégaselo al municipal.`,
        license: formatLicenseResponse(license),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to generate license");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── GET /admin/licenses — Listar todas las licencias ────────────────────────
router.get(
  "/admin/licenses",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const licenses = await db
        .select()
        .from(licensesTable)
        .orderBy(desc(licensesTable.createdAt))
        .limit(200);

      return res.json({
        licenses: licenses.map((l) => formatLicenseResponse(l)),
        total: licenses.length,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to list licenses");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── POST /admin/licenses/:id/revoke — Revocar licencia ─────────────────────
router.post(
  "/admin/licenses/:id/revoke",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const licenseId = parseInt(req.params.id as string);
      const [license] = await db
        .select()
        .from(licensesTable)
        .where(eq(licensesTable.id, licenseId))
        .limit(1);

      if (!license)
        return res.status(404).json({ error: "Licencia no encontrada." });

      const [updated] = await db
        .update(licensesTable)
        .set({ isActive: false, expiresAt: new Date() })
        .where(eq(licensesTable.id, licenseId))
        .returning();

      return res.json({
        success: true,
        message: `Licencia de ${license.districtName} revocada.`,
        license: formatLicenseResponse(updated),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to revoke license");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// USUARIOS MUNICIPALES
// ═════════════════════════════════════════════════════════════════════════════

// ── POST /admin/municipal-users — Crear usuario municipal + asignar licencia ─
const createMunicipalSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(100),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  siglas: z.string().min(1, "Siglas requeridas"),
  districtName: z.string().min(1, "Distrito requerido"),
  province: z.string().min(1, "Provincia requerida"),
  department: z.string().min(1, "Departamento requerido"),
  displayName: z.string().min(1, "Nombre para mostrar requerido").max(200),
  maxViewers: z.number().int().min(1).max(100).default(10),
  generateLicense: z.boolean().default(true),
});

router.post(
  "/admin/municipal-users",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    const parsed = createMunicipalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const data = parsed.data;
    const user = (req as any).jwtUser;

    try {
      // 1. Verificar que el email no exista
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, data.email.toLowerCase().trim()))
        .limit(1);
      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: "Ya existe un usuario con ese correo." });
      }

      // 2. Buscar distrito
      const [district] = await db
        .select()
        .from(districtsTable)
        .where(eq(districtsTable.name, data.districtName.trim()))
        .limit(1);

      if (!district) {
        return res.status(400).json({
          error:
            "Distrito no encontrado. Verifica el nombre e intenta de nuevo.",
        });
      }

      // 3. Crear usuario municipal
      const passwordHash = await bcrypt.hash(data.password, 10);
      const [municipalUser] = await db
        .insert(usersTable)
        .values({
          name: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          passwordHash,
          role: "municipal" as any,
          sector: `${data.districtName} - Municipalidad`,
          districtId: district.id,
          district: district.name,
          province: district.province,
          department: district.department,
          displayName: data.displayName.trim(),
          isActive: true,
          reportsCount: 0,
        })
        .returning();

      // 4. Generar y asignar licencia
      let license = null;
      if (data.generateLicense) {
        const code = generateLicenseCode(
          data.siglas,
          data.districtName,
          data.province,
          data.department,
        );

        [license] = await db
          .insert(licensesTable)
          .values({
            code,
            siglas: data.siglas.toUpperCase().trim(),
            districtName: data.districtName.trim(),
            province: data.province.trim(),
            department: data.department.trim(),
            districtId: district.id,
            municipalUserId: municipalUser.id,
            createdBy: Number(user.sub),
            isActive: false,
            maxViewers: data.maxViewers,
          })
          .returning();
      }

      return res.status(201).json({
        success: true,
        message: `Usuario municipal ${data.email} creado.`,
        user: {
          id: String(municipalUser.id),
          name: municipalUser.name,
          email: municipalUser.email,
          role: municipalUser.role,
          district: municipalUser.district,
          displayName: municipalUser.displayName,
        },
        license: license ? formatLicenseResponse(license) : null,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to create municipal user");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ── GET /admin/municipal-users — Listar usuarios municipales ────────────────
router.get(
  "/admin/municipal-users",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const municipals = await db
        .select()
        .from(usersTable)
        .where(sql`${usersTable.role} IN ('municipal', 'viewer')`)
        .orderBy(desc(usersTable.createdAt))
        .limit(200);

      return res.json({
        users: municipals.map((u) => ({
          id: String(u.id),
          name: u.name,
          email: u.email,
          role: u.role,
          district: u.district,
          districtId: u.districtId,
          displayName: u.displayName,
          isActive: u.isActive,
          reportsCount: u.reportsCount,
          createdAt: u.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to list municipal users");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /admin/stats — Dashboard de estadísticas ────────────────────────────
router.get("/admin/stats", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const [{ municipalCount }] = await db
      .select({ municipalCount: sql<number>`count(*)` })
      .from(usersTable)
      .where(eq(usersTable.role, "municipal"));

    const [{ viewerCount }] = await db
      .select({ viewerCount: sql<number>`count(*)` })
      .from(usersTable)
      .where(eq(usersTable.role, "viewer"));

    const [{ activeLicenses }] = await db
      .select({ activeLicenses: sql<number>`count(*)` })
      .from(licensesTable)
      .where(eq(licensesTable.isActive, true));

    const [{ pendingLicenses }] = await db
      .select({ pendingLicenses: sql<number>`count(*)` })
      .from(licensesTable)
      .where(eq(licensesTable.isActive, false));

    const [{ totalUsers }] = await db
      .select({ totalUsers: sql<number>`count(*)` })
      .from(usersTable);

    const [{ totalReports }] = await db
      .select({ totalReports: sql<number>`count(*)` })
      .from(reportsTable);

    return res.json({
      stats: {
        municipalUsers: Number(municipalCount),
        viewerUsers: Number(viewerCount),
        activeLicenses: Number(activeLicenses),
        pendingLicenses: Number(pendingLicenses),
        totalUsers: Number(totalUsers),
        totalReports: Number(totalReports),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
