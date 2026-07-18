/**
 * simulateRoute.ts — Punto GPS simulado (solo para pruebas de superadmin).
 *
 * Devuelve un handle compatible con `GeoWatcher`, así que alimenta exactamente
 * el mismo flujo que una transmisión real (crear sesión → pings). Sirve para
 * probar "Servicios en vivo" sin salir a la calle.
 */
import type { GeoFix, GeoWatcher } from "./backgroundGeo";

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
