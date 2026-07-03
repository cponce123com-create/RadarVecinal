import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { licensesTable, districtsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireMunicipal } from "./auth";
import { validateLicenseCodeFormat, formatLicenseResponse } from "../lib/license";

const router: IRouter = Router();

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Licencias Routes — Autogestión para municipalidades
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * - POST /licenses/activate — Activar licencia con código de 16 dígitos
 * - GET  /licenses/my       — Ver info de mi licencia (municipal autenticado)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── POST /licenses/activate — Activar licencia con código de 16 dígitos ──────
const activateSchema = z.object({
  code: z.string().regex(/^\d{16}$/, "El código debe tener 16 dígitos numéricos"),
});

router.post("/licenses/activate", requireAuth, async (req, res) => {
  const parsed = activateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Código inválido" });
  }

  const user = (req as any).jwtUser;
  const { code } = parsed.data;

  try {
    // 1. Validar formato del código
    if (!validateLicenseCodeFormat(code)) {
      return res.status(400).json({ error: "Código de licencia inválido (checksum incorrecto)." });
    }

    // 2. Buscar licencia en DB
    const [license] = await db.select()
      .from(licensesTable)
      .where(eq(licensesTable.code, code))
      .limit(1);

    if (!license) {
      return res.status(404).json({ error: "Código de licencia no encontrado. Verifica los datos." });
    }

    // 3. Verificar que no esté ya activa
    if (license.isActive) {
      return res.status(409).json({ error: "Esta licencia ya fue activada por otro usuario municipal." });
    }

    // 4. Verificar que no haya expirado
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      return res.status(410).json({ error: "Esta licencia ha expirado. Solicita una renovación al superadmin." });
    }

    // 5. Activar: vincular al usuario y poner fecha
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 12 meses

    const [updated] = await db.update(licensesTable)
      .set({
        municipalUserId: Number(user.sub),
        activatedAt: now,
        expiresAt,
        isActive: true,
      })
      .where(eq(licensesTable.id, license.id))
      .returning();

    // 6. También vincular el distrito al usuario municipal
    if (license.districtId) {
      const [district] = await db.select()
        .from(districtsTable)
        .where(eq(districtsTable.id, license.districtId))
        .limit(1);

      if (district) {
        await db.update(usersTable)
          .set({
            districtId: district.id,
            district: district.name,
            province: district.province,
            department: district.department,
          })
          .where(eq(usersTable.id, Number(user.sub)));
      }
    }

    return res.json({
      success: true,
      message: `¡Licencia activada! Tu distrito ${license.districtName} ahora tiene acceso completo hasta el ${expiresAt.toLocaleDateString("es-PE")}.`,
      license: formatLicenseResponse(updated),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to activate license");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /licenses/my — Ver info de mi licencia (municipal autenticado) ───────
router.get("/licenses/my", requireAuth, requireMunicipal, async (req, res) => {
  const user = (req as any).jwtUser;

  try {
    const [license] = await db.select()
      .from(licensesTable)
      .where(eq(licensesTable.municipalUserId, Number(user.sub)))
      .limit(1);

    if (!license) {
      return res.status(404).json({ error: "No tienes una licencia activa. Ingresa un código en /licenses/activate." });
    }

    return res.json(formatLicenseResponse(license));
  } catch (err) {
    req.log.error({ err }, "Failed to get my license");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
