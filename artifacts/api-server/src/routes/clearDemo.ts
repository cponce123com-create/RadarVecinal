import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { reportsTable, panicAlertsTable, missingPersonsTable, reportMessagesTable, auditLogTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "./auth";

const router: IRouter = Router();

/**
 * POST /api/clear-demo
 * 
 * Elimina TODOS los datos de prueba (reportes, alertas, personas desaparecidas,
 * mensajes, auditoría) manteniendo solo usuarios y distritos.
 * 
 * Requiere: super_admin o admin
 * Seguridad: solo en producción con ALLOW_CLEAR=true
 */
router.post("/clear-demo", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = (req as any).jwtUser;

    // En producción, require ALLOW_CLEAR explícito
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_CLEAR !== "true") {
      return res.status(403).json({
        error: "Limpieza deshabilitada en producción. Configura ALLOW_CLEAR=true para habilitarlo.",
      });
    }

    // Solo super_admin puede limpiar todo; admin solo su distrito
    let deleted: Record<string, number> = {};

    if (user.role === "super_admin") {
      // Super admin: limpiar TODO
      const [msgs] = await db.delete(reportMessagesTable).returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);
      const [reps] = await db.delete(reportsTable).returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);
      const [panics] = await db.delete(panicAlertsTable).returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);
      const [mis] = await db.delete(missingPersonsTable).returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);
      const [audits] = await db.delete(auditLogTable).returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);

      deleted = {
        messages: Number(msgs?.count ?? 0),
        reports: Number(reps?.count ?? 0),
        panicAlerts: Number(panics?.count ?? 0),
        missingPersons: Number(mis?.count ?? 0),
        auditLogs: Number(audits?.count ?? 0),
      };
    } else {
      // Admin: limpiar solo su distrito
      const districtId = Number(user.districtId);

      const [msgs] = await db.delete(reportMessagesTable)
        .where(sql`report_id IN (SELECT id FROM ${reportsTable} WHERE district_id = ${districtId})`)
        .returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);

      const [reps] = await db.delete(reportsTable)
        .where(sql`district_id = ${districtId}`)
        .returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);

      const [panics] = await db.delete(panicAlertsTable)
        .where(sql`district_id = ${districtId}`)
        .returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);

      const [mis] = await db.delete(missingPersonsTable)
        .where(sql`district_id = ${districtId}`)
        .returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);

      const [audits] = await db.delete(auditLogTable)
        .where(sql`district_id = ${districtId}`)
        .returning({ count: sql<number>`count(*)` }).catch(() => [{ count: 0 }]);

      deleted = {
        messages: Number(msgs?.count ?? 0),
        reports: Number(reps?.count ?? 0),
        panicAlerts: Number(panics?.count ?? 0),
        missingPersons: Number(mis?.count ?? 0),
        auditLogs: Number(audits?.count ?? 0),
      };
    }

    return res.json({
      success: true,
      message: "✅ Datos demo eliminados correctamente.",
      deleted,
      note: "Los usuarios y distritos no fueron afectados.",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to clear demo data");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
