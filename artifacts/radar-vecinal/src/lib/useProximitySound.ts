/**
 * useProximitySound — plays Web Audio API sounds based on proximity to alerts.
 *
 * Uses the Haversine formula to calculate distance between the user's location
 * and each active panic alert. If an alert is within the configured radius for
 * its type, a distinct alarm pattern plays via Web Audio API.
 *
 * Respects user preferences from localStorage:
 *   - rvs_sound          ("true" | "false") — master sound toggle
 *   - rvs_quietHours     ("true" | "false") — quiet hours enabled
 *   - rvs_quietStart     ("HH:MM") — quiet hours start (default "22:00")
 *   - rvs_quietEnd       ("HH:MM") — quiet hours end (default "07:00")
 */

import { useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePanicAlerts } from "@workspace/api-client-react";

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
  robbery:        1_000,   // 1 km
  medical:        2_000,   // 2 km
  fight:          800,     // 800 m
  fire:           3_000,   // 3 km
  missing_person: 2_000,   // 2 km
  other:          1_000,   // 1 km
};

// ── Audio context singleton ─────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new AudioContext();
  } catch {
    return null;
  }
  return audioCtx;
}

function beep(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  dur: number,
  delay: number,
  gain: number,
) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.value = gain;
  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + dur);
}

// ── Distinct sound patterns per alert type ──────────────────────────────────
function playProximitySound(type: string) {
  // Check sound preferences
  try {
    if (localStorage.getItem("rvs_sound") === "false") return;

    const quietHours = localStorage.getItem("rvs_quietHours") === "true";
    if (quietHours) {
      const quietStart = localStorage.getItem("rvs_quietStart") ?? "22:00";
      const quietEnd = localStorage.getItem("rvs_quietEnd") ?? "07:00";
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startParts = quietStart.split(":").map(Number);
      const endParts = quietEnd.split(":").map(Number);
      const startMin = startParts[0] * 60 + (startParts[1] ?? 0);
      const endMin = endParts[0] * 60 + (endParts[1] ?? 0);

      if (startMin <= endMin) {
        if (currentMinutes >= startMin && currentMinutes < endMin) return;
      } else {
        if (currentMinutes >= startMin || currentMinutes < endMin) return;
      }
    }
  } catch { /* ignore */ }

  const ctx = getAudioCtx();
  if (!ctx) return;

  const play = () => {
    switch (type) {
      case "fire":
        // Rapid alternating high-low — fire alarm
        beep(ctx, 1200, "sawtooth", 0.2, 0, 0.15);
        beep(ctx, 800, "sawtooth", 0.2, 0.25, 0.15);
        beep(ctx, 1200, "sawtooth", 0.2, 0.5, 0.15);
        beep(ctx, 800, "sawtooth", 0.2, 0.75, 0.15);
        break;

      case "medical":
        // Slow rising tone — ambulance-like
        beep(ctx, 500, "sine", 0.4, 0, 0.2);
        beep(ctx, 600, "sine", 0.4, 0.5, 0.2);
        beep(ctx, 500, "sine", 0.4, 1.0, 0.2);
        break;

      case "robbery":
        // Sharp urgent staccato
        beep(ctx, 1000, "square", 0.1, 0, 0.12);
        beep(ctx, 1000, "square", 0.1, 0.15, 0.12);
        beep(ctx, 1000, "square", 0.1, 0.3, 0.12);
        break;

      case "missing_person":
        // Soft sad descending tone
        beep(ctx, 800, "triangle", 0.3, 0, 0.12);
        beep(ctx, 600, "triangle", 0.3, 0.4, 0.12);
        beep(ctx, 400, "triangle", 0.5, 0.8, 0.10);
        break;

      case "fight":
        // Aggressive buzz
        beep(ctx, 300, "sawtooth", 0.15, 0, 0.1);
        beep(ctx, 300, "sawtooth", 0.15, 0.2, 0.1);
        break;

      default:
        // Single alert beep
        beep(ctx, 900, "sine", 0.3, 0, 0.1);
        break;
    }
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(play).catch(() => { /* ignore */ });
  } else {
    play();
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useProximitySound(userLat?: number, userLng?: number) {
  const { toast } = useToast();
  const { data } = usePanicAlerts();
  const notifiedRef = useRef<Set<string>>(new Set());

  const checkProximity = useCallback(() => {
    if (userLat === undefined || userLng === undefined) return;
    if (!data?.alerts) return;

    const activeAlerts = data.alerts.filter(a => a.isActive);

    for (const alert of activeAlerts) {
      const distance = haversineMeters(userLat, userLng, alert.latitude, alert.longitude);
      const radius = ALERT_RADII[alert.type] ?? 1_000;

      if (distance <= radius && !notifiedRef.current.has(alert.id)) {
        notifiedRef.current.add(alert.id);
        playProximitySound(alert.type);
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
    playProximitySound,
    clearNotified: () => { notifiedRef.current.clear(); },
  };
}
