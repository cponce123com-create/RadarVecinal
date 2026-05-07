import { useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

// F-07: Global SSE hook for real-time panic alert notifications from any page.
// Connects once to /api/panic-alerts/stream and shows toasts on new events.

const ALERT_TYPE_LABELS: Record<string, string> = {
  robbery:        "🔪 Robo",
  medical:        "🚑 Emergencia médica",
  fight:          "👊 Pelea",
  fire:           "🔥 Incendio",
  missing_person: "🔍 Persona desaparecida",
  other:          "⚠️ Alerta",
};

const ALERT_TYPE_EMOJIS: Record<string, string> = {
  robbery:        "🔪",
  medical:        "🚑",
  fight:          "👊",
  fire:           "🔥",
  missing_person: "🔍",
  other:          "⚠️",
};

interface PanicAlertEvent {
  id: string;
  type: string;
  authorName: string;
  address?: string;
  latitude: number;
  longitude: number;
  message?: string;
  createdAt: string;
}

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function usePanicAlertStream(userLat?: number, userLng?: number) {
  const esRef   = useRef<EventSource | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const onAlert = useCallback((alert: PanicAlertEvent) => {
    if (seenRef.current.has(alert.id)) return;
    seenRef.current.add(alert.id);

    const label   = ALERT_TYPE_LABELS[alert.type]  ?? "⚠️ Alerta";
    const emoji   = ALERT_TYPE_EMOJIS[alert.type]  ?? "⚠️";

    let distText = "";
    if (userLat != null && userLng != null) {
      const km = haversineKm(userLat, userLng, alert.latitude, alert.longitude);
      distText = km < 1
        ? ` · ${Math.round(km * 1000)} m de ti`
        : ` · ${km.toFixed(1)} km de ti`;
    }

    const where = alert.address
      ? alert.address
      : `${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}`;

    toast({
      title: `${emoji} Alerta de pánico — ${label.replace(/^[^\s]+\s/, "")}`,
      description: `${where}${distText}`,
      duration: 7000,
    });

    // F-09: Play sound alert via Web Audio API
    playAlertSound(alert.type);
  }, [userLat, userLng, toast]);

  useEffect(() => {
    const url = `/api/panic-alerts/stream`;
    if (esRef.current) esRef.current.close();

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("panic", (e: MessageEvent) => {
      try {
        const alert: PanicAlertEvent = JSON.parse(e.data);
        onAlert(alert);
      } catch { /* ignore parse errors */ }
    });

    es.onerror = () => {
      // Reconnect after 5 s on error
      setTimeout(() => {
        if (esRef.current === es) {
          es.close();
          esRef.current = null;
        }
      }, 5000);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  // Re-attach onAlert without reconnecting when user position changes
  useEffect(() => {
    if (!esRef.current) return;
    const handler = (e: MessageEvent) => {
      try { onAlert(JSON.parse(e.data)); } catch { /* */ }
    };
    esRef.current.addEventListener("panic", handler);
    return () => esRef.current?.removeEventListener("panic", handler);
  }, [onAlert]);
}

// ── F-09: Web Audio API tone generator ───────────────────────────────────────
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === "closed") {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

function beep(ctx: AudioContext, freq: number, type: OscillatorType, dur: number, vol: number, delayMs = 0) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type      = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime + delayMs / 1000);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delayMs / 1000 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delayMs / 1000 + dur);
  osc.start(ctx.currentTime + delayMs / 1000);
  osc.stop(ctx.currentTime + delayMs / 1000 + dur + 0.05);
}

function playAlertSound(type: string) {
  // F-09: Check user's sound preference from Settings
  try {
    const soundEnabled = localStorage.getItem("rvs_sound") !== "false";
    if (!soundEnabled) return;

    // Check quiet hours
    const quietHours = localStorage.getItem("rvs_quietHours") === "true";
    if (quietHours) {
      const quietStart = localStorage.getItem("rvs_quietStart") ?? "22:00";
      const quietEnd = localStorage.getItem("rvs_quietEnd") ?? "07:00";
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startParts = quietStart.split(":").map(Number);
      const endParts = quietEnd.split(":").map(Number);
      const startMinutes = startParts[0] * 60 + (startParts[1] ?? 0);
      const endMinutes = endParts[0] * 60 + (endParts[1] ?? 0);

      if (startMinutes <= endMinutes) {
        // Same-day range (e.g., 22:00-07:00 spans midnight, so this handles normal ranges)
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) return;
      } else {
        // Overnight range (e.g., 22:00-07:00)
        if (currentMinutes >= startMinutes || currentMinutes < endMinutes) return;
      }
    }
  } catch {
    // If localStorage is unavailable, play sound anyway
  }

  const ctx = getAudioCtx();
  if (!ctx) return;

  // Resume AudioContext if suspended (autoplay policy)
  const play = () => {
    switch (type) {
      case "robbery":
      case "fight":
        // Urgent triple-beep (high pitch)
        beep(ctx, 1200, "square", 0.15, 0.4, 0);
        beep(ctx, 1200, "square", 0.15, 0.4, 200);
        beep(ctx, 1200, "square", 0.15, 0.4, 400);
        break;
      case "fire":
        // Siren sweep up-down
        for (let i = 0; i < 3; i++) {
          beep(ctx, 800 + i * 200, "sawtooth", 0.2, 0.35, i * 200);
          beep(ctx, 1200 - i * 200, "sawtooth", 0.2, 0.35, i * 200 + 110);
        }
        break;
      case "medical":
        // Two short low beeps
        beep(ctx, 600, "sine", 0.25, 0.35, 0);
        beep(ctx, 600, "sine", 0.25, 0.35, 350);
        break;
      default:
        // Single alert beep
        beep(ctx, 900, "sine", 0.3, 0.3, 0);
        break;
    }
  };

  if (ctx.state === "suspended") {
    ctx.resume().then(play).catch(() => { /* ignore */ });
  } else {
    play();
  }
}
