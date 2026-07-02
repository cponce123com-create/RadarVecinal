/**
 * email.ts — Notificaciones por email vía Nodemailer
 *
 * Envía emails cuando un reporte cambia de estado.
 * Best-effort: si SMTP no está configurado, skipea con warn.
 *
 * Configuración (env vars):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
import { logger } from "./logger";

let transporter: any = null;
let warnShown = false;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST) {
    if (!warnShown) {
      logger.warn("[Email] SMTP_HOST no configurado. Notificaciones email desactivadas.");
      warnShown = true;
    }
    return null;
  }

  try {
    const nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || "587"),
      secure: SMTP_PORT === "465",
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    logger.info("[Email] Transporte SMTP inicializado.");
    return transporter;
  } catch (err) {
    logger.error({ err }, "[Email] Error al crear transporte SMTP");
    return null;
  }
}

interface StatusChangeEmail {
  to: string;
  reportTitle: string;
  reportId: number;
  newStatus: string;
  districtName: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  reviewing: "En Revisión",
  resolved: "Resuelto",
  archived: "Archivado",
};

/**
 * Envía email de notificación cuando un reporte cambia de estado.
 * Best-effort: no lanza errores.
 */
export async function sendStatusChangeEmail(data: StatusChangeEmail): Promise<void> {
  try {
    const t = getTransporter();
    if (!t) return;

    const statusLabel = STATUS_LABELS[data.newStatus] ?? data.newStatus;

    await t.sendMail({
      from: process.env.SMTP_FROM || "noreply@radarvecinal.pe",
      to: data.to,
      subject: `[Radar Vecinal] Reporte actualizado: ${data.reportTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f1219;color:#e2e8f0;padding:24px;border-radius:12px">
          <h2 style="color:#fff;margin-top:0">📋 Reporte actualizado</h2>
          <p style="color:#94a3b8">Tu reporte <strong style="color:#fff">"${data.reportTitle}"</strong> ha cambiado de estado.</p>
          <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">Nuevo estado:</p>
            <p style="margin:0;font-size:18px;font-weight:bold;color:#22c55e">${statusLabel}</p>
          </div>
          <p style="color:#64748b;font-size:13px">Distrito: ${data.districtName}</p>
          <p style="color:#64748b;font-size:13px">Ver en: <a href="${process.env.APP_URL || "https://radarvecinal.pe"}/reportes" style="color:#3b82f6">radarvecinal.pe</a></p>
        </div>
      `,
    });

    logger.info({ reportId: data.reportId, status: data.newStatus }, "[Email] Notificación enviada");
  } catch (err) {
    logger.error({ err, reportId: data.reportId }, "[Email] Error al enviar (best-effort)");
  }
}
