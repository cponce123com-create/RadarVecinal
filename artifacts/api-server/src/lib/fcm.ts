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

    logger.info(
      { districtId: alert.districtId, alertId: alert.id },
      "[FCM] Push enviado",
    );
  } catch (err) {
    logger.error(
      { err, alertId: alert.id },
      "[FCM] Error al enviar push (best-effort, ignorado)",
    );
  }
}

/**
 * Envía una notificación push dirigida SOLO al vecino destinatario.
 * Bugfix 3: No usa topic del distrito — busca el fcmToken del usuario
 * en la tabla subscriptions y envía a token individual.
 * Si no hay token registrado, solo loggea y no envía nada.
 */
export async function sendMunicipalPushToUser(data: {
  userId: number;
  districtId: number;
  title: string;
  body: string;
  reportId: number;
}): Promise<void> {
  try {
    if (!initFcm()) {
      logger.warn(
        { userId: data.userId },
        "[FCM] No disponible — push municipal no enviado",
      );
      return;
    }

    // Buscar token FCM del usuario en subscriptions
    const { subscriptionsTable } = await import("@workspace/db/schema");
    const { db } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");

    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(
        and(
          eq(subscriptionsTable.email, String(data.userId)),
          eq(subscriptionsTable.districtId, data.districtId),
          eq(subscriptionsTable.isActive, true),
        ),
      )
      .limit(1);

    const fcmToken = sub?.fcmToken;

    if (!fcmToken) {
      logger.warn(
        { userId: data.userId, reportId: data.reportId },
        "[FCM] Sin fcmToken registrado para este usuario — push no enviado. Solo notificación in-app.",
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");

    await admin.messaging().send({
      notification: { title: data.title, body: data.body },
      token: fcmToken,
      android: {
        priority: "high",
        notification: {
          channelId: "municipal-messages",
          priority: "high",
          visibility: "public",
          tag: `msg-${data.reportId}`,
        },
      },
      data: {
        type: "municipal_message",
        reportId: String(data.reportId),
        districtId: String(data.districtId),
      },
    });

    logger.info(
      { userId: data.userId, reportId: data.reportId },
      "[FCM] Push municipal enviado al vecino",
    );
  } catch (err) {
    logger.error(
      { err, reportId: data.reportId },
      "[FCM] Error al enviar push municipal (best-effort)",
    );
  }
}

/**
 * Envía un aviso push a un token individual (proximidad de servicios en vivo).
 * Best-effort: si FCM no está configurado o el token es inválido, solo loggea.
 * Devuelve true si se envió (para poder limpiar tokens muertos aguas arriba).
 */
export async function sendProximityPush(data: {
  token: string;
  title: string;
  body: string;
  districtId: number;
  providerType: string;
}): Promise<boolean> {
  try {
    if (!initFcm()) return false;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");

    await admin.messaging().send({
      notification: { title: data.title, body: data.body },
      token: data.token,
      android: {
        priority: "high",
        notification: {
          channelId: "live-services",
          priority: "high",
          visibility: "public",
          tag: `live-${data.providerType}`,
        },
      },
      data: {
        type: "live_proximity",
        providerType: data.providerType,
        districtId: String(data.districtId),
      },
    });
    return true;
  } catch (err) {
    logger.error({ err }, "[FCM] Error al enviar push de proximidad (best-effort)");
    return false;
  }
}
