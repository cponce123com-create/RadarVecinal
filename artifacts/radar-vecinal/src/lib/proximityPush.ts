/**
 * proximityPush.ts — Suscripción de proximidad para avisos con la app cerrada.
 *
 * Registra en el servidor la casa del vecino + su token push (FCM) para que el
 * aviso "el recolector está cerca de tu casa" llegue AUNQUE la app esté cerrada.
 * Solo funciona en el APK nativo (Capacitor + FCM); en web es un no-op.
 */
import { Capacitor } from "@capacitor/core";
import { customFetch } from "@workspace/api-client-react";
import { registerForPush } from "./pushRegistration";
import type { LiveProviderType } from "./liveProviders";

let cachedToken: string | null = null;
let triedRegister = false;

/** Obtiene el token push (solo nativo). Registra una vez por sesión. */
async function ensureToken(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  if (cachedToken) return cachedToken;
  if (triedRegister) return null;
  triedRegister = true;
  try {
    const res = await registerForPush();
    if (res.ok) cachedToken = res.token;
  } catch {
    /* sin token */
  }
  return cachedToken;
}

export interface ProximityParams {
  districtId: number;
  homeLat: number;
  homeLng: number;
  radiusM: number;
  types: LiveProviderType[];
  enabled: boolean;
}

/**
 * Sincroniza la suscripción con el servidor. Al desactivar no pide permisos
 * (solo da de baja si ya había token). Devuelve reason "no-token" en web o si
 * el permiso fue denegado (para poder avisar que se necesita la app instalada).
 */
export async function syncProximitySubscription(
  params: ProximityParams,
): Promise<{ ok: boolean; reason?: "no-token" }> {
  if (!params.enabled) {
    if (!cachedToken) return { ok: true };
    await customFetch(`/api/live/proximity-subscription`, {
      method: "DELETE",
      body: JSON.stringify({ pushToken: cachedToken }),
    }).catch(() => {});
    return { ok: true };
  }

  const token = await ensureToken();
  if (!token) return { ok: false, reason: "no-token" };

  await customFetch(`/api/live/proximity-subscription`, {
    method: "PUT",
    body: JSON.stringify({ pushToken: token, ...params }),
  });
  return { ok: true };
}
