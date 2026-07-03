import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  reportsTable,
  reportMessagesTable,
  usersTable,
  notificationsTable,
  auditLogTable,
  subscriptionsTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { requireAuth, requireViewerOrAbove } from "./auth";
import { checkTenant } from "./tenant";
import { sendCustomMessageEmail } from "../lib/email";
import { sendMunicipalPushToUser } from "../lib/fcm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────
const createMessageSchema = z.object({
  channel: z.enum(["whatsapp", "app", "email"]),
  content: z.string().min(1, "El mensaje no puede estar vacío").max(2000),
});

// ── POST /reports/:id/messages — Crear mensaje del admin al vecino ───────────
router.post("/reports/:id/messages", requireAuth, requireViewerOrAbove, async (req, res) => {
  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    });
  }

  const { channel, content } = parsed.data;
  const user = (req as any).jwtUser;

  try {
    // Obtener reporte con datos de contacto
    const [report] = await db.select()
      .from(reportsTable)
      .where(and(
        eq(reportsTable.id, parseInt(req.params.id as string)),
        isNull(reportsTable.deletedAt),
      ))
      .limit(1);

    if (!report) {
      return res.status(404).json({ error: "Reporte no encontrado." });
    }

    if (!checkTenant(req, report.districtId)) {
      return res.status(403).json({ error: "No puedes enviar mensajes a reportes de otro distrito." });
    }

    if (report.isAnonymous) {
      return res.status(400).json({
        error: "El autor de este reporte es anónimo. No es posible contactarlo directamente.",
      });
    }

    const hasPhone = !!report.contactPhone;
    const hasEmail = !!report.contactEmail;

    if (channel === "whatsapp" && !hasPhone) {
      return res.status(400).json({ error: "Este reporte no tiene número de contacto registrado." });
    }
    if (channel === "email" && !hasEmail) {
      return res.status(400).json({ error: "Este reporte no tiene correo electrónico registrado." });
    }

    // Obtener displayName del usuario que responde
    const [responder] = await db.select({ displayName: usersTable.displayName, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(user.sub)))
      .limit(1);

    const responderName = responder?.displayName || responder?.name || user?.name || "Administración Municipal";

    // Guardar mensaje en la base de datos
    const [message] = await db.insert(reportMessagesTable).values({
      reportId: report.id,
      sender: "admin",
      channel,
      content: content.trim(),
      adminName: responderName,
      contactPhone: channel === "whatsapp" ? report.contactPhone : null,
      contactEmail: channel === "email" ? report.contactEmail : null,
    }).returning();

    // Disparar canal de comunicación correspondiente (best-effort)
    const deliverPromises: Promise<void>[] = [];

    if (channel === "email" && hasEmail) {
      deliverPromises.push(
        sendCustomMessageEmail({
          to: report.contactEmail!,
          reportTitle: report.title,
          reportId: report.id,
          message: content.trim(),
          adminName: responderName,
          districtName: report.district,
        }).catch((err) => {
          logger.error({ err, reportId: report.id }, "[Messages] Error al enviar email");
        }),
      );
    }

    // Canal app: notificación + push dirigido al vecino
    if (channel === "app") {
      const authorUserId = report.authorUserId;

      await db.insert(notificationsTable).values({
        districtId: report.districtId,
        userId: authorUserId,
        type: "report_update",
        title: `📩 Respuesta de ${responderName}`,
        body: `${responderName}: ${content.trim()}`,
        referenceId: String(report.id),
        referenceType: "report_message",
      }).catch((err) => {
        logger.error({ err, reportId: report.id }, "[Messages] Error al crear notificación app");
      });

      if (authorUserId) {
        deliverPromises.push(
          sendMunicipalPushToUser({
            userId: authorUserId,
            districtId: report.districtId,
            title: `📩 ${responderName} te respondió`,
            body: content.trim(),
            reportId: report.id,
          }).catch((err) => {
            logger.error({ err, reportId: report.id }, "[Messages] Error al enviar push al vecino");
          }),
        );
      }
    }

    // Auditoría
    await db.insert(auditLogTable).values({
      districtId: report.districtId,
      entityType: "report",
      entityId: report.id,
      action: "message_sent",
      previousValue: null,
      newValue: channel,
      changedBy: user?.email ?? "unknown",
      changedById: user ? Number(user.sub) : undefined,
    }).catch(() => {});

    await Promise.allSettled(deliverPromises);

    return res.status(201).json({
      ...message,
      id: String(message.id),
      reportId: String(message.reportId),
      createdAt: message.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err, reportId: req.params.id }, "Failed to create message");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /reports/:id/messages — Obtener historial de mensajes (solo backoffice) ───
router.get("/reports/:id/messages", requireAuth, requireViewerOrAbove, async (req, res) => {
  try {
    const [report] = await db.select({ id: reportsTable.id, districtId: reportsTable.districtId })
      .from(reportsTable)
      .where(and(
        eq(reportsTable.id, parseInt(req.params.id as string)),
        isNull(reportsTable.deletedAt),
      ))
      .limit(1);

    if (!report) {
      return res.status(404).json({ error: "Reporte no encontrado." });
    }

    if (!checkTenant(req, report.districtId)) {
      return res.status(403).json({ error: "No puedes ver mensajes de otros distritos." });
    }

    const messages = await db.select()
      .from(reportMessagesTable)
      .where(eq(reportMessagesTable.reportId, report.id))
      .orderBy(desc(reportMessagesTable.createdAt));

    return res.json({
      messages: messages.map(m => ({
        ...m,
        id: String(m.id),
        reportId: String(m.reportId),
        createdAt: m.createdAt.toISOString(),
        readAt: m.readAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    req.log.error({ err, reportId: req.params.id }, "Failed to get messages");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
