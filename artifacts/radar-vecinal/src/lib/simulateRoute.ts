/**
 * simulateRoute.ts — Recorrido GPS simulado (solo para pruebas de superadmin).
 *
 * Genera posiciones que se mueven solas alrededor del centro del distrito, sin
 * usar el GPS real. Devuelve un handle compatible con `GeoWatcher`, así que
 * alimenta exactamente el mismo flujo que una transmisión real (crear sesión →
 * pings). Sirve para probar "Servicios en vivo" sin salir a la calle.
 */
import type { GeoFix, GeoWatcher } from "./backgroundGeo";

const STEP_MS = 3000; // cada cuánto avanza el punto simulado
const STEP_METERS = 20; // cuánto avanza por paso (~24 km/h a 3 s)
const MAX_RADIUS_DEG = 0.006; // ~650 m: se mantiene dentro del distrito

/**
 * Inicia un recorrido simulado alrededor de `center`. Llama a `onFix` de
 * inmediato y luego cada STEP_MS con una posición que hace un paseo aleatorio
 * suave, girando hacia el centro si se aleja demasiado.
 */
export function startSimulatedWatch(
  center: { lat: number; lng: number },
  onFix: (fix: GeoFix) => void,
): GeoWatcher {
  let lat = center.lat;
  let lng = center.lng;
  let heading = Math.random() * Math.PI * 2;

  const emit = () => {
    // Si se alejó del centro, apunta de vuelta; si no, gira un poco al azar.
    const dLatC = center.lat - lat;
    const dLngC = center.lng - lng;
    const dist = Math.hypot(dLatC, dLngC);
    if (dist > MAX_RADIUS_DEG) {
      heading = Math.atan2(dLngC, dLatC); // 0 = norte (+lat), π/2 = este (+lng)
    } else {
      heading += (Math.random() - 0.5) * 0.9; // giro suave
    }

    const latRad = (lat * Math.PI) / 180;
    lat += (STEP_METERS / 111_111) * Math.cos(heading);
    lng += (STEP_METERS / (111_111 * Math.cos(latRad))) * Math.sin(heading);

    onFix({ latitude: lat, longitude: lng, accuracy: 8 });
  };

  emit();
  const iv = setInterval(emit, STEP_MS);
  return { stop: async () => clearInterval(iv) };
}

// ── Simulador CONTROLABLE (para probar notificaciones sin esperar) ──────────
// En modo prueba el superadmin mueve el punto a mano (arrastrando en el mapa o
// "traer a mi ubicación"); reemite la posición cada pocos segundos para que el
// servidor/hook de proximidad reevalúe la cercanía y dispare el aviso.
export interface ManualSim extends GeoWatcher {
  setPosition(lat: number, lng: number): void;
}

export function startManualSim(
  start: { lat: number; lng: number },
  onFix: (fix: GeoFix) => void,
): ManualSim {
  let lat = start.lat;
  let lng = start.lng;
  const emit = () => onFix({ latitude: lat, longitude: lng, accuracy: 6 });
  emit();
  const iv = setInterval(emit, 5000);
  return {
    stop: async () => clearInterval(iv),
    setPosition(nlat: number, nlng: number) {
      lat = nlat;
      lng = nlng;
      emit(); // ping inmediato al mover
    },
  };
}
