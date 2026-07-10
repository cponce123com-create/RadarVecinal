/**
 * useProximitySound — avisa (sonido + vibración) cuando una alerta de pánico
 * activa está dentro del radio configurado para su tipo, según la distancia
 * Haversine a la ubicación del usuario.
 *
 * El sonido/vibración y el respeto por las preferencias (silencio maestro +
 * horario de silencio) viven en `lib/alertSound` (motor único compartido con
 * usePanicAlertStream).
 */

import { useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useGetPanicAlerts } from "@workspace/api-client-react";
import { alertUser } from "@/lib/alertSound";

// ── Haversine distance (meters) ─────────────────────────────────────────────
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Alert-specific radius configuration (meters) ────────────────────────────
const ALERT_RADII: Record<string, number> = {
  robbery: 1_000, // 1 km
  medical: 2_000, // 2 km
  fight: 800, // 800 m
  fire: 3_000, // 3 km
  missing_person: 2_000, // 2 km
  other: 1_000, // 1 km
};

// ── Hook ────────────────────────────────────────────────────────────────────
export function useProximitySound(userLat?: number, userLng?: number) {
  const { toast } = useToast();
  const { data } = useGetPanicAlerts();
  const notifiedRef = useRef<Set<string>>(new Set());

  const checkProximity = useCallback(() => {
    if (userLat === undefined || userLng === undefined) return;
    if (!data?.alerts) return;

    const activeAlerts = data.alerts.filter((a: any) => a.isActive);

    for (const alert of activeAlerts) {
      const distance = haversineMeters(userLat, userLng, alert.latitude, alert.longitude);
      const radius = ALERT_RADII[alert.type] ?? 1_000;

      if (distance <= radius && !notifiedRef.current.has(alert.id)) {
        notifiedRef.current.add(alert.id);
        alertUser(alert.type);
        toast({
          title: `⚠️ Alerta cercana: ${alert.type}`,
          description: `${alert.authorName} reportó a ${Math.round(distance)} m de ti. ${alert.address || ""}`,
          variant: "destructive",
        });
      }
    }
  }, [userLat, userLng, data, toast]);

  // Check proximity on data changes (new alerts)
  useEffect(() => {
    checkProximity();
  }, [checkProximity]);

  // Periodic check every 30s in case user moved
  useEffect(() => {
    const interval = setInterval(checkProximity, 30_000);
    return () => clearInterval(interval);
  }, [checkProximity]);

  return {
    clearNotified: () => {
      notifiedRef.current.clear();
    },
  };
}
