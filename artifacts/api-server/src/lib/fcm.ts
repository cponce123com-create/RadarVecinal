/**
 * fcm.ts — Firebase Cloud Messaging integration
 *
 * Envía notificaciones push nativas a dispositivos Android (vecinos)
 * cuando se crea una alerta de pánico. Best-effort: si FCM no está
 * configurado, skipea con un warn de logger.
 *
 * Configuración requerida (en Render):
 *   FCM_SERVICE_ACCOUNT → JSON string de la cuenta de servicio de Firebase
 *     (Firebase Console → Project Settings → Service Accounts → Generate key)
 */
import { logger } from "./logger";

let fcmAvailable = false;
let fcmWarnShown = false;

function initFcm(): boolean {
  if (fcmAvailable) return true;
  if (fcmWarnShown) return false;

  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) {
    logger.warn(
      "[FCM] FCM_SERVICE_ACCOUNT no configurada. Notificaciones push nativas desactivadas. " +
      "Las alertas de pánico solo llegarán por SSE (web).",
    );
    fcmWarnShown = true;
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    const serviceAccount = JSON.parse(raw);

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    fcmAvailable = true;
    logger.info("[FCM] Firebase Admin inicializado correctamente.");
    return true;
  } catch (err) {
    logger.error({ err }, "[FCM] Error al inicializar Firebase Admin");
    fcmWarnShown = true;
    return false;
  }
}

/**
 * Envía una notificación push a todos los dispositivos suscritos al topic
 * del distrito. Best-effort: no lanza errores, solo los loggea.
 */
export async function sendPanicAlertPush(alert: {
  id: number;
  districtId: number;
  type: string;
  authorName: string;
  sector: string;
  address?: string;
}): Promise<void> {
  try {
    if (!initFcm()) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");

    const typeLabels: Record<string, string> = {
      robbery: "🚨 Robo",
      medical: "🏥 Emergencia médica",
      fight: "⚔️ Pelea",
      fire: "🔥 Incendio",
      missing_person: "🔍 Persona desaparecida",
      other: "⚠️ Alerta",
    };

    const title = typeLabels[alert.type] ?? "⚠️ Alerta de pánico";
    const body = `${alert.authorName} reportó en ${alert.sector}${alert.address ? ` - ${alert.address}` : ""}`;

    await admin.messaging().send({
      notification: { title, body },
      topic: `district-${alert.districtId}`,
      android: {
        priority: "high",
        notification: {
          channelId: "panic-alerts",
          priority: "high",
          visibility: "public",
          tag: `panic-${alert.id}`,
        },
      },
      data: {
        type: "panic_alert",
        alertId: String(alert.id),
        districtId: String(alert.districtId),
      },
    });

    logger.info({ districtId: alert.districtId, alertId: alert.id }, "[FCM] Push enviado");
  } catch (err) {
    logger.error({ err, alertId: alert.id }, "[FCM] Error al enviar push (best-effort, ignorado)");
  }
}
