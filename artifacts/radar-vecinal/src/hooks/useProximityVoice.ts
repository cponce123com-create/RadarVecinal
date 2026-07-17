/**
 * useProximityVoice — Aviso por voz cuando un servicio en vivo se acerca a tu casa.
 *
 * Con la app abierta: compara la posición en vivo del recolector (u otros
 * servicios elegidos) con la casa guardada y, al cruzar el umbral de cercanía
 * acercándose, anuncia en español "El camión recolector está a unos 300 metros
 * de tu casa" — una sola vez, con enfriamiento para no repetir.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDistrict } from "@/contexts/DistrictContext";
import { listLiveProviders, providerMeta } from "@/lib/liveProviders";
import {
  getHome, getVoicePrefs, speak, distanceMeters, type VoicePrefs, type HomeLocation,
} from "@/lib/voiceAlerts";

const COOLDOWN_MS = 8 * 60 * 1000; // no repetir el mismo servicio en 8 min
const NOISE_M = 15; // tolerancia para considerar "acercándose"

function announceText(typeLabel: string, meters: number): string {
  const rounded = Math.max(50, Math.round(meters / 50) * 50);
  return `${typeLabel} está a unos ${rounded} metros de tu casa.`;
}

export function useProximityVoice() {
  const { currentDistrictId } = useDistrict();
  // Releer prefs/casa cuando cambian (evento en la misma pestaña + storage).
  const [tick, setTick] = useState(0);
  const [prefs, setPrefs] = useState<VoicePrefs>(() => getVoicePrefs());
  const [home, setHomeState] = useState<HomeLocation | null>(() => getHome());

  useEffect(() => {
    const reload = () => { setPrefs(getVoicePrefs()); setHomeState(getHome()); setTick((t) => t + 1); };
    window.addEventListener("rv:voice-prefs-changed", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("rv:voice-prefs-changed", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const active = prefs.enabled && !!home && !!currentDistrictId;

  const { data } = useQuery({
    queryKey: ["live-providers", currentDistrictId, "voice", tick],
    queryFn: () => listLiveProviders(currentDistrictId as number),
    enabled: active,
    refetchInterval: 12000,
    staleTime: 8000,
  });

  // Estado por proveedor: última distancia y último anuncio.
  const stateRef = useRef<Map<string, { lastDist: number; lastAnnounced: number }>>(new Map());

  useEffect(() => {
    if (!active || !home || !data) return;
    const watched = new Set(prefs.types);
    const now = Date.now();

    for (const p of data) {
      if (!watched.has(p.type)) continue;
      const d = distanceMeters(home.lat, home.lng, p.latitude, p.longitude);
      const prev = stateRef.current.get(p.id);

      const entering = d <= prefs.distanceM && (!prev || prev.lastDist > prefs.distanceM);
      const approaching = !prev || d <= prev.lastDist + NOISE_M; // no anunciar si se aleja
      const cooldownOk = !prev?.lastAnnounced || now - prev.lastAnnounced > COOLDOWN_MS;

      let lastAnnounced = prev?.lastAnnounced ?? 0;
      if (entering && approaching && cooldownOk) {
        const meta = providerMeta(p.type);
        const label = p.type === "recolector" ? "El camión recolector" : `El ${meta.label.toLowerCase()}`;
        speak(announceText(label, d));
        lastAnnounced = now;
      }
      stateRef.current.set(p.id, { lastDist: d, lastAnnounced });
    }
  }, [data, active, home, prefs.types, prefs.distanceM]);
}
