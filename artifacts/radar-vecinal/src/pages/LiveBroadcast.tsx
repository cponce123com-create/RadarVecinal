/**
 * LiveBroadcast — "Modo transmisor" de servicios en vivo.
 *
 * Un celular entra aquí, elige qué es (camión recolector, panadero, lechero,
 * tamalero, gasero, aguatero o "vendo comida hoy") y comparte su ubicación GPS
 * en vivo. Los vecinos lo ven moverse por el mapa del distrito.
 *
 * Mientras transmite:
 *   - watchPosition envía un ping cada ~10 s (o al moverse).
 *   - Wake Lock mantiene la pantalla encendida (best-effort).
 *   - La sesión (id+clave) se guarda en localStorage para poder reanudar/detener
 *     aunque se recargue la app.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Radio, MapPin, Loader2, Square, AlertCircle, Clock, Satellite } from "lucide-react";
import { useDistrict } from "@/contexts/DistrictContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  PROVIDER_META,
  providerMeta,
  startBroadcast,
  pingBroadcast,
  stopBroadcast,
  saveLiveSession,
  loadLiveSession,
  clearLiveSession,
  type LiveProviderType,
  type LiveSession,
} from "@/lib/liveProviders";

const PING_MIN_MS = 8000; // no enviar pings más seguido que esto

function useElapsed(startedAt: number | null): string {
  const [, force] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return "0:00";
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function LiveBroadcast() {
  const { currentDistrictId, currentDistrict } = useDistrict();
  const { user } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<LiveSession | null>(() => loadLiveSession());
  const [selType, setSelType] = useState<LiveProviderType | null>(null);
  const [label, setLabel] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [starting, setStarting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const watchRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const lastPingRef = useRef(0);
  const sessionRef = useRef<LiveSession | null>(session);
  sessionRef.current = session;

  const elapsed = useElapsed(session?.startedAt ?? null);

  // ── Detener transmisión ────────────────────────────────────────────────────
  const stop = useCallback(async (silent = false) => {
    const s = sessionRef.current;
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch { /* ignore */ }
      wakeLockRef.current = null;
    }
    if (s) {
      try { await stopBroadcast(s.id, s.broadcastKey); } catch { /* best-effort */ }
    }
    clearLiveSession();
    setSession(null);
    setCoords(null);
    if (!silent) toast({ title: "Transmisión finalizada", description: "Dejaste de compartir tu ubicación." });
  }, [toast]);

  // ── Bucle de seguimiento (watchPosition → ping) ─────────────────────────────
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return;
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng, acc: pos.coords.accuracy });
        setGpsError(null);

        const s = sessionRef.current;
        const now = Date.now();
        if (s && now - lastPingRef.current >= PING_MIN_MS) {
          lastPingRef.current = now;
          pingBroadcast(s.id, s.broadcastKey, lat, lng).catch(() => {
            /* un ping perdido no rompe la transmisión; el siguiente reintenta */
          });
        }
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado. Actívalo para transmitir."
            : "No se pudo obtener el GPS. Revisa la señal.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch {
      /* no soportado o denegado: la transmisión sigue igual */
    }
  }, []);

  // ── Reanudar sesión existente al montar / al volver a la pestaña ────────────
  useEffect(() => {
    if (session) {
      startWatching();
      requestWakeLock();
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && sessionRef.current) {
        requestWakeLock();
        startWatching();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      // No detenemos la transmisión al desmontar: el usuario puede navegar por la
      // app mientras transmite. Solo limpiamos el watcher local.
      if (watchRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Iniciar transmisión ─────────────────────────────────────────────────────
  const begin = async () => {
    if (!selType || !currentDistrictId) return;
    const meta = providerMeta(selType);
    if (meta.freeLabel && !label.trim()) {
      toast({ title: "Falta el detalle", description: "Escribe qué ofreces (ej: pollada, patasca).", variant: "destructive" });
      return;
    }
    if (!navigator.geolocation) {
      toast({ title: "Sin GPS", description: "Tu dispositivo no permite geolocalización.", variant: "destructive" });
      return;
    }

    setStarting(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const res = await startBroadcast({
            type: selType,
            label: label.trim(),
            displayName: displayName.trim() || user?.name || "",
            latitude: lat,
            longitude: lng,
            districtId: currentDistrictId,
          });
          const s: LiveSession = {
            id: res.id,
            broadcastKey: res.broadcastKey,
            type: selType,
            label: label.trim(),
            displayName: displayName.trim() || user?.name || "",
            districtId: currentDistrictId,
            startedAt: Date.now(),
          };
          saveLiveSession(s);
          sessionRef.current = s;
          setSession(s);
          setCoords({ lat, lng, acc: pos.coords.accuracy });
          lastPingRef.current = Date.now();
          startWatching();
          requestWakeLock();
          toast({ title: "🔴 Transmitiendo en vivo", description: "Los vecinos ya pueden verte en el mapa." });
        } catch (e: any) {
          toast({ title: "No se pudo iniciar", description: e?.message ?? "Intenta de nuevo.", variant: "destructive" });
        } finally {
          setStarting(false);
        }
      },
      (err) => {
        setStarting(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado. Actívalo para transmitir."
            : "No se pudo obtener tu ubicación.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  // ── Sin distrito activo ─────────────────────────────────────────────────────
  if (!currentDistrictId) {
    return (
      <div className="rv-in max-w-xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-200">Elige tu distrito arriba para poder transmitir en vivo.</p>
        </div>
      </div>
    );
  }

  // ── Vista transmitiendo ─────────────────────────────────────────────────────
  if (session) {
    const meta = providerMeta(session.type);
    return (
      <div className="rv-in max-w-xl mx-auto flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden border border-white/8 p-6"
          style={{ background: `radial-gradient(120% 120% at 50% 0%, ${meta.color}22, rgba(9,12,20,0.9))` }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="relative flex w-2.5 h-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="label-mono text-[11px] font-bold text-red-400 tracking-wider">EN VIVO</span>
          </div>

          <div className="flex flex-col items-center text-center gap-1 mt-3">
            <span className="text-5xl mb-1">{meta.emoji}</span>
            <h2 className="font-display text-xl font-bold text-white">
              {session.label || meta.label}
            </h2>
            {session.displayName && <p className="text-sm text-muted-foreground">{session.displayName}</p>}
            <p className="text-xs text-muted-foreground mt-1">{currentDistrict}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.04] border border-white/8">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-display text-lg font-bold text-white tabular-nums">{elapsed}</span>
              <span className="text-[10px] text-muted-foreground">Transmitiendo</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.04] border border-white/8">
              <Satellite className="w-4 h-4 text-emerald-400" />
              <span className="font-display text-lg font-bold text-white tabular-nums">
                {coords?.acc ? `±${Math.round(coords.acc)}m` : "…"}
              </span>
              <span className="text-[10px] text-muted-foreground">Precisión GPS</span>
            </div>
          </div>

          {coords && (
            <p className="text-center text-[10px] text-muted-foreground/70 mt-3 label-mono">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}
        </motion.div>

        {gpsError && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-200">{gpsError}</p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground px-4">
          Mantén esta pantalla abierta para seguir compartiendo tu ubicación. Puedes
          minimizar, pero algunos teléfonos pausan el GPS en segundo plano.
        </p>

        <button
          onClick={() => stop()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 font-semibold hover:bg-red-500/25 transition-colors"
        >
          <Square className="w-4 h-4 fill-current" /> Detener transmisión
        </button>
      </div>
    );
  }

  // ── Vista selección ─────────────────────────────────────────────────────────
  const selMeta = selType ? providerMeta(selType) : null;
  return (
    <div className="rv-in max-w-xl mx-auto flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
          <Radio className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-white leading-tight">Transmitir en vivo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comparte tu recorrido para que los vecinos de {currentDistrict || "tu distrito"} te encuentren.
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">¿Qué eres?</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROVIDER_META.map((m) => {
            const active = selType === m.type;
            return (
              <motion.button
                key={m.type} whileTap={{ scale: 0.96 }}
                onClick={() => { setSelType(m.type); if (!m.freeLabel) setLabel(""); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                  active ? "text-white" : "bg-white/[0.03] border-white/8 text-muted-foreground hover:text-white hover:border-white/15"
                }`}
                style={active ? { background: `${m.color}1f`, borderColor: `${m.color}66` } : {}}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[11.5px] font-medium text-center leading-tight">{m.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {selMeta?.freeLabel && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            ¿Qué ofreces hoy?
          </label>
          <input
            value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder={selMeta.hint} maxLength={80}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          />
        </motion.div>
      )}

      {selType && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Nombre visible <span className="text-muted-foreground/50 normal-case">(opcional)</span>
          </label>
          <input
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder={user?.name || "Ej: Panadería San José"} maxLength={80}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          />
        </motion.div>
      )}

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/8">
        <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-[11.5px] text-muted-foreground leading-relaxed">
          Usaremos el GPS de tu teléfono para compartir tu ubicación mientras transmites.
          Se deja de compartir apenas pulsas <b className="text-white/80">Detener</b> o cierras la transmisión.
        </p>
      </div>

      {gpsError && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-200">{gpsError}</p>
        </div>
      )}

      <button
        onClick={begin} disabled={!selType || starting}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-br from-primary to-[#1e52d6] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-px transition-transform shadow-[0_8px_22px_hsl(221_100%_59%_/_0.3)]"
      >
        {starting ? <><Loader2 className="w-4 h-4 animate-spin" /> Obteniendo ubicación…</> : <><Radio className="w-4 h-4" /> Iniciar transmisión</>}
      </button>
    </div>
  );
}
