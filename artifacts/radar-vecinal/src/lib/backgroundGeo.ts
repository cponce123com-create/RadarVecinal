/**
 * backgroundGeo.ts — Seguimiento de ubicación unificado (web + APK nativo).
 *
 * En la app nativa (Capacitor) usa @capacitor-community/background-geolocation,
 * que mantiene el GPS activo **en segundo plano** mediante un servicio en primer
 * plano con una notificación persistente ("Radar Vecinal está compartiendo tu
 * ubicación"). Así el camión recolector puede transmitir durante horas con la
 * pantalla apagada.
 *
 * En web hace fallback a navigator.geolocation.watchPosition (solo primer plano;
 * el Wake Lock de la pantalla ayuda a que no se suspenda).
 *
 * El plugin nativo se referencia con registerPlugin(), así que el bundle web no
 * necesita el paquete resuelto: en web nunca se llega a esa rama.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GeoWatcher {
  stop: () => Promise<void>;
}

export interface WatchOptions {
  /** Título de la notificación del servicio en primer plano (Android). */
  title?: string;
  /** Texto de la notificación del servicio en primer plano (Android). */
  message?: string;
}

// ── Tipos mínimos del plugin nativo (evita depender de sus tipos en build) ──
interface BgLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  time: number | null;
}
interface BgWatcherOptions {
  backgroundMessage?: string;
  backgroundTitle?: string;
  requestPermissions?: boolean;
  stale?: boolean;
  distanceFilter?: number;
}
interface BgPlugin {
  addWatcher(
    options: BgWatcherOptions,
    callback: (position?: BgLocation, error?: { message: string; code?: string }) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

let _bg: BgPlugin | null = null;
function bgPlugin(): BgPlugin {
  if (!_bg) _bg = registerPlugin<BgPlugin>("BackgroundGeolocation");
  return _bg;
}

export function isNativeTracking(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Inicia el seguimiento de ubicación. Devuelve un handle para detenerlo.
 * `onFix` se invoca con cada actualización; `onError` con errores recuperables.
 */
export async function startLocationWatch(
  onFix: (fix: GeoFix) => void,
  onError: (message: string) => void,
  opts: WatchOptions = {},
): Promise<GeoWatcher> {
  // ── APK nativo: servicio en segundo plano con notificación ───────────────
  if (Capacitor.isNativePlatform()) {
    const bg = bgPlugin();
    const id = await bg.addWatcher(
      {
        backgroundTitle: opts.title ?? "Radar Vecinal",
        backgroundMessage: opts.message ?? "Compartiendo tu ubicación en vivo",
        requestPermissions: true,
        stale: false,
        distanceFilter: 15,
      },
      (position, error) => {
        if (error) {
          onError(
            error.code === "NOT_AUTHORIZED"
              ? "Permiso de ubicación denegado. Actívalo para transmitir."
              : error.message || "Error de GPS.",
          );
          return;
        }
        if (position) {
          onFix({
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
          });
        }
      },
    );
    return { stop: async () => bg.removeWatcher({ id }) };
  }

  // ── Web: watchPosition (solo primer plano) ───────────────────────────────
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError("Tu dispositivo no permite geolocalización.");
    return { stop: async () => {} };
  }
  const wid = navigator.geolocation.watchPosition(
    (pos) =>
      onFix({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
    (err) =>
      onError(
        err.code === err.PERMISSION_DENIED
          ? "Permiso de ubicación denegado. Actívalo para transmitir."
          : "No se pudo obtener el GPS. Revisa la señal.",
      ),
    { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
  );
  return {
    stop: async () => {
      if (navigator.geolocation) navigator.geolocation.clearWatch(wid);
    },
  };
}
