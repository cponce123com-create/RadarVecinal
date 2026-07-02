/**
 * pushRegistration.ts — Registro de notificaciones push nativas vía Capacitor
 *
 * Se integra con AuthContext (se suscribe al distrito del usuario logueado)
 * y DistrictContext (se resuscribe si cambia el distrito seleccionado).
 *
 * NOTA: Este módulo solo se ejecuta en Capacitor (app nativa).
 * En web (SSE), las alertas de pánico llegan via EventSource.
 *
 * Dependencias (instalar con pnpm en artifacts/radar-vecinal):
 *   @capacitor/push-notifications
 */
import { Capacitor } from "@capacitor/core";

let PushNotifications: any = null;

export async function ensurePushPlugin() {
  if (PushNotifications) return true;
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const mod = await import("@capacitor/push-notifications");
    PushNotifications = mod.PushNotifications;
    return true;
  } catch {
    console.warn("[PushRegistration] @capacitor/push-notifications no instalado");
    return false;
  }
}

export type PushRegistrationResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Solicita permiso y registra el dispositivo para recibir push.
 * Retorna el token FCM si tiene éxito.
 */
export async function registerForPush(): Promise<PushRegistrationResult> {
  const available = await ensurePushPlugin();
  if (!available) return { ok: false, error: "Capacitor push not available" };

  try {
    // Solicitar permiso
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      return { ok: false, error: "Permiso de notificaciones denegado" };
    }

    // Registrar en FCM
    await PushNotifications.register();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        PushNotifications.removeAllListeners();
        resolve({ ok: false, error: "Timeout esperando token FCM" });
      }, 10000);

      PushNotifications.addListener("registration", (token: { value: string }) => {
        clearTimeout(timeout);
        PushNotifications.removeAllListeners();
        resolve({ ok: true, token: token.value });
      });

      PushNotifications.addListener("registrationError", (err: { error: string }) => {
        clearTimeout(timeout);
        PushNotifications.removeAllListeners();
        resolve({ ok: false, error: err.error });
      });
    });
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Unknown error" };
  }
}

/**
 * Maneja notificaciones push recibidas mientras la app está en primer plano.
 * Conecta con el sistema de notificaciones de la app para mostrar un toast/in-app.
 */
export async function onPushReceived(
  handler: (data: Record<string, string>) => void,
) {
  const available = await ensurePushPlugin();
  if (!available) return () => {};

  PushNotifications.addListener(
    "pushNotificationReceived",
    (notification: any) => {
      const data = notification.data ?? {};
      handler(data);
    },
  );

  return () => {
    PushNotifications.removeAllListeners();
  };
}
