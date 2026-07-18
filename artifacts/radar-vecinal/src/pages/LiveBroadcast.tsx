/**
 * LiveBroadcast — "Modo transmisor" de servicios en vivo.
 *
 * Un celular entra aquí, elige qué es (camión recolector, panadero, lechero,
 * tamalero, gasero, aguatero o "vendo comida hoy") y comparte su ubicación GPS
 * en vivo. Los vecinos lo ven moverse por el mapa del distrito.
 *
 * Seguimiento (lib/backgroundGeo.ts):
 *   - APK nativo: servicio en segundo plano con notificación → sigue enviando
 *     ubicación aunque la pantalla esté apagada (ideal para el recolector).
 *   - Web: watchPosition (primer plano) + Wake Lock para no suspender.
 *
 * El watcher vive a nivel de módulo, así la transmisión no se corta al navegar
 * por la app y no se duplica al re-montar la página. La sesión (id+clave) se
 * guarda en localStorage para poder reanudar/detener tras recargar.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Radio, MapPin, Loader2, Square, AlertCircle, Clock, Satellite, FlaskConical, Map as MapIcon, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useDistrict } from "@/contexts/DistrictContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { startLocationWatch, isNativeTracking, type GeoWatcher } from "@/lib/backgroundGeo";
import { startManualSim, type ManualSim } from "@/lib/simulateRoute";
import {
  PROVIDER_META,
  providerMeta,
  providerTitle,
  startBroadcast,
  pingBroadcast,
  stopBroadcast,
  saveLiveSession,
  loadLiveSession,
  clearLiveSession,
  listAllLiveProviders,
  getDeviceInfo,
  devicePing,
  deviceStop,
  type LiveProviderType,
  type LiveSession,
  type DeviceInfo,
} from "@/lib/liveProviders";

const PING_MIN_MS = 8000; // no enviar pings más seguido que esto

// ── Estado del watcher a nivel de módulo ────────────────────────────────────
// Vive fuera del componente: la transmisión sigue al navegar por la app y no se
// crea un segundo watcher al re-montar la página.
let moduleWatcher: GeoWatcher | null = null;
let moduleWatcherSession: string | null = null;
// En modo prueba, control del punto simulado (mover a mano).
let moduleSimControl: ManualSim | null = null;

interface PendingStart {
  type: LiveProviderType;
  label: string;
  displayName: string;
  districtId: number;
  simulate: boolean;
}

// ── Panel de diagnóstico (superadmin): todas las transmisiones activas ──────
function SuperAdminLivePanel({ currentDistrictId }: { currentDistrictId: number | null }) {
  const { data } = useQuery({
    queryKey: ["live-providers-all"],
    queryFn: listAllLiveProviders,
    refetchInterval: 6000,
    staleTime: 4000,
  });
  const providers = data ?? [];

  return (
    <div className="mt-2 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-[13px] font-semibold text-white">Transmisiones activas (todos los distritos)</h3>
        <span className="ml-auto text-[11px] text-muted-foreground label-mono">{providers.length}</span>
      </div>
      {providers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay transmisiones activas ahora mismo.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {providers.map((p) => {
            const meta = providerMeta(p.type);
            const otherDistrict = currentDistrictId != null && p.districtId !== currentDistrictId;
            return (
              <li key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/6">
                <span className="text-xl flex-shrink-0">{meta.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-white truncate">{providerTitle(p)}</p>
                  <p className="text-[10.5px] text-muted-foreground">
                    Distrito:{" "}
                    <span className={otherDistrict ? "text-amber-300 font-semibold" : "text-emerald-300"}>
                      {p.districtName ?? `#${p.districtId}`}
                    </span>
                    {" · "}visto hace {formatDistanceToNow(new Date(p.updatedAt), { locale: es })}
                  </p>
                </div>
                {otherDistrict && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 flex-shrink-0">
                    otro distrito
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[10.5px] text-muted-foreground/70 mt-3 leading-relaxed">
        Para verla en el mapa de otro celular, ese celular debe estar en el <b>mismo distrito</b> que la
        transmisión (elígelo en el selector de arriba). Si dice “otro distrito”, ahí está el desajuste.
      </p>
    </div>
  );
}

// Recentra el mini-mapa cuando cambia `trigger` (ej: "traer a mi ubicación").
function SimRecenter({ pos, trigger }: { pos: { lat: number; lng: number }; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([pos.lat, pos.lng], Math.max(map.getZoom() || 16, 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

// Mapa de control del punto simulado: arrastra el 🚛 donde quieras probar.
function SimControlMap({
  pos, onMove, recenter,
}: { pos: { lat: number; lng: number }; onMove: (lat: number, lng: number) => void; recenter: number }) {
  const icon = L.divIcon({
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `<div style="width:38px;height:38px;border-radius:50%;background:rgba(9,12,20,0.92);border:3px solid #22c55e;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 14px #22c55eaa;cursor:grab;">🚛</div>`,
  });
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10" style={{ height: 220 }}>
      <MapContainer center={[pos.lat, pos.lng]} zoom={16} attributionControl={false}
        style={{ width: "100%", height: "100%", background: "#0d1117" }}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <Marker draggable position={[pos.lat, pos.lng]} icon={icon}
          eventHandlers={{ dragend: (e: any) => { const ll = e.target.getLatLng(); onMove(ll.lat, ll.lng); } }} />
        <SimRecenter pos={pos} trigger={recenter} />
      </MapContainer>
    </div>
  );
}

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
  // Modo dispositivo oficial: el celular montado abre /en-vivo?device=CLAVE y
  // transmite solo, sin login ni operador. Se separa en su propio componente
  // para no mezclar hooks con el flujo de transmisión manual.
  const deviceKey = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("device")
    : null;
  if (deviceKey) return <DeviceMode deviceKey={deviceKey} />;
  return <BroadcasterUI />;
}

function BroadcasterUI() {
  const { currentDistrictId, currentDistrict, districtCenter } = useDistrict();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isSuperAdmin = user?.role === "super_admin";

  const [session, setSession] = useState<LiveSession | null>(() => loadLiveSession());
  const [selType, setSelType] = useState<LiveProviderType | null>(null);
  const [label, setLabel] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [simulate, setSimulate] = useState(false);
  const [starting, setStarting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [recenter, setRecenter] = useState(0);

  // Modo prueba: mover el punto simulado (arrastrar en el mapa o traer a mí).
  const moveSimTo = (lat: number, lng: number, recenterMap = false) => {
    moduleSimControl?.setPosition(lat, lng);
    setCoords({ lat, lng, acc: 6 });
    if (recenterMap) setRecenter((n) => n + 1);
  };
  const bringSimToMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => moveSimTo(p.coords.latitude, p.coords.longitude, true),
      () => toast({ title: "Sin ubicación", description: "No se pudo obtener tu GPS.", variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const wakeLockRef = useRef<any>(null);
  const lastPingRef = useRef(0);
  const pendingStartRef = useRef<PendingStart | null>(null);
  const sessionRef = useRef<LiveSession | null>(session);
  sessionRef.current = session;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const centerRef = useRef(districtCenter);
  centerRef.current = districtCenter;

  const elapsed = useElapsed(session?.startedAt ?? null);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch {
      /* no soportado o denegado: la transmisión sigue igual */
    }
  }, []);

  // ── Detener transmisión ────────────────────────────────────────────────────
  const stop = useCallback(async (silent = false) => {
    const s = sessionRef.current;
    if (moduleWatcher) {
      try { await moduleWatcher.stop(); } catch { /* ignore */ }
      moduleWatcher = null;
      moduleWatcherSession = null;
      moduleSimControl = null;
    }
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch { /* ignore */ }
      wakeLockRef.current = null;
    }
    pendingStartRef.current = null;
    if (s) {
      try { await stopBroadcast(s.id, s.broadcastKey); } catch { /* best-effort */ }
    }
    clearLiveSession();
    setSession(null);
    setCoords(null);
    setStarting(false);
    if (!silent) toastRef.current({ title: "Transmisión finalizada", description: "Dejaste de compartir tu ubicación." });
  }, []);

  // ── Manejo de cada actualización de GPS ─────────────────────────────────────
  const onFix = useCallback((fix: { latitude: number; longitude: number; accuracy?: number }) => {
    setCoords({ lat: fix.latitude, lng: fix.longitude, acc: fix.accuracy });
    setGpsError(null);

    // Aún sin sesión: la primera ubicación crea la transmisión.
    if (!sessionRef.current && pendingStartRef.current) {
      const p = pendingStartRef.current;
      pendingStartRef.current = null;
      startBroadcast({
        type: p.type,
        label: p.label,
        displayName: p.displayName,
        districtId: p.districtId,
        latitude: fix.latitude,
        longitude: fix.longitude,
      })
        .then((res) => {
          const ns: LiveSession = {
            id: res.id, broadcastKey: res.broadcastKey,
            type: p.type, label: p.label, displayName: p.displayName,
            districtId: p.districtId, simulate: p.simulate, startedAt: Date.now(),
          };
          saveLiveSession(ns);
          sessionRef.current = ns;
          moduleWatcherSession = res.id;
          lastPingRef.current = Date.now();
          setSession(ns);
          setStarting(false);
          toastRef.current({ title: "🔴 Transmitiendo en vivo", description: "Los vecinos ya pueden verte en el mapa." });
        })
        .catch((e: any) => {
          setStarting(false);
          toastRef.current({ title: "No se pudo iniciar", description: e?.message ?? "Intenta de nuevo.", variant: "destructive" });
          stop(true);
        });
      return;
    }

    // Con sesión activa: pings espaciados.
    const s = sessionRef.current;
    if (s) {
      const now = Date.now();
      if (now - lastPingRef.current >= PING_MIN_MS) {
        lastPingRef.current = now;
        pingBroadcast(s.id, s.broadcastKey, fix.latitude, fix.longitude).catch(() => {
          /* un ping perdido no rompe la transmisión; el siguiente reintenta */
        });
      }
    }
  }, [stop]);

  // ── Arrancar/reanudar el watcher (idempotente por sesión) ───────────────────
  const startWatching = useCallback(async (sessionKey: string) => {
    if (moduleWatcher && moduleWatcherSession === sessionKey) return; // ya activo
    if (moduleWatcher) {
      try { await moduleWatcher.stop(); } catch { /* ignore */ }
      moduleWatcher = null;
      moduleSimControl = null;
    }
    moduleWatcherSession = sessionKey;
    const isSim = sessionRef.current?.simulate ?? pendingStartRef.current?.simulate ?? false;
    try {
      if (isSim) {
        // Modo prueba (superadmin): punto controlable a mano (arrastrar / traer
        // a mi ubicación), sin GPS real. Arranca en el centro del distrito.
        const sim = startManualSim(
          { lat: centerRef.current.lat, lng: centerRef.current.lng },
          onFix,
        );
        moduleSimControl = sim;
        moduleWatcher = sim;
      } else {
        moduleWatcher = await startLocationWatch(
          onFix,
          (msg) => setGpsError(msg),
          { title: "Radar Vecinal", message: "Compartiendo tu ubicación en vivo" },
        );
      }
    } catch {
      moduleWatcherSession = null;
      setStarting(false);
      setGpsError("No se pudo iniciar el GPS. Revisa los permisos de ubicación.");
    }
  }, [onFix]);

  // ── Reanudar sesión existente al montar / al volver a la pestaña ────────────
  useEffect(() => {
    if (sessionRef.current) {
      startWatching(sessionRef.current.id);
      requestWakeLock();
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && sessionRef.current) {
        requestWakeLock();
        startWatching(sessionRef.current.id);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    // No detenemos el watcher al desmontar: el usuario puede navegar por la app
    // mientras transmite (vive a nivel de módulo).
    return () => document.removeEventListener("visibilitychange", onVisible);
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
    const isSim = isSuperAdmin && simulate;
    setStarting(true);
    setGpsError(null);
    pendingStartRef.current = {
      type: selType,
      // Marca visible para distinguir la prueba de una transmisión real.
      label: isSim ? `🧪 PRUEBA · ${label.trim() || meta.label}` : label.trim(),
      displayName: isSim ? "Simulación (superadmin)" : displayName.trim() || user?.name || "",
      districtId: currentDistrictId,
      simulate: isSim,
    };
    if (!isSim) requestWakeLock();
    // La primera ubicación del watcher dispara startBroadcast (ver onFix).
    await startWatching("pending");
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
            {session.simulate && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[9px] font-bold">
                <FlaskConical className="w-2.5 h-2.5" /> MODO PRUEBA
              </span>
            )}
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
          {session.simulate
            ? "Recorrido simulado: el punto se mueve solo alrededor del distrito para probar. Ábrelo en el mapa (toggle “En vivo”) para verlo moverse."
            : isNativeTracking()
            ? "Sigues transmitiendo aunque bloquees la pantalla. Verás una notificación mientras compartes tu ubicación."
            : "Mantén esta pantalla abierta para seguir compartiendo tu ubicación. En la app instalada se transmite también con la pantalla apagada."}
        </p>

        {/* Control del punto simulado (solo modo prueba) */}
        {session.simulate && coords && (
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-amber-500/[0.06] border border-amber-500/25">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-amber-200 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5" /> Mueve el recolector para probar
              </p>
              <button onClick={bringSimToMe}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors">
                <MapPin className="w-3.5 h-3.5" /> Traer a mi ubicación
              </button>
            </div>
            <SimControlMap pos={{ lat: coords.lat, lng: coords.lng }} onMove={(la, ln) => moveSimTo(la, ln)} recenter={recenter} />
            <p className="text-[10.5px] text-muted-foreground leading-relaxed">
              Arrastra el 🚛 cerca de tu casa (o pulsa “Traer a mi ubicación”) para disparar el aviso.
              Necesitas tener activados los <b className="text-white/80">Avisos por voz</b> y tu casa marcada en Ajustes.
            </p>
          </div>
        )}

        <button
          onClick={() => setLocation("/mapa")}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/[0.05] border border-white/12 text-white font-semibold hover:bg-white/[0.09] transition-colors"
        >
          <MapIcon className="w-4 h-4" /> Ver en el mapa
        </button>

        <button
          onClick={() => stop()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 font-semibold hover:bg-red-500/25 transition-colors"
        >
          <Square className="w-4 h-4 fill-current" /> Detener transmisión
        </button>

        {isSuperAdmin && <SuperAdminLivePanel currentDistrictId={currentDistrictId} />}
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

      {/* Modo simulación — solo superadmin (probar sin salir a la calle) */}
      {isSuperAdmin && (
        <button
          type="button"
          onClick={() => setSimulate(v => !v)}
          className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
            simulate ? "bg-amber-500/10 border-amber-500/40" : "bg-white/[0.03] border-white/8 hover:border-white/15"
          }`}
        >
          <FlaskConical className={`w-4 h-4 flex-shrink-0 mt-0.5 ${simulate ? "text-amber-400" : "text-muted-foreground"}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[12.5px] font-semibold ${simulate ? "text-amber-200" : "text-white/85"}`}>
                Modo prueba (superadmin)
              </span>
              <span className={`ml-auto w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${simulate ? "bg-amber-500" : "bg-white/15"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${simulate ? "left-[18px]" : "left-0.5"}`} />
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Simula un recorrido que se mueve solo alrededor del centro de {currentDistrict || "tu distrito"}.
              No usa tu GPS. Aparece marcado como 🧪 PRUEBA en el mapa.
            </p>
          </div>
        </button>
      )}

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
        {starting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Obteniendo ubicación…</>
          : isSuperAdmin && simulate
          ? <><FlaskConical className="w-4 h-4" /> Iniciar prueba simulada</>
          : <><Radio className="w-4 h-4" /> Iniciar transmisión</>}
      </button>

      {isSuperAdmin && <SuperAdminLivePanel currentDistrictId={currentDistrictId} />}
    </div>
  );
}

// ── Modo dispositivo oficial (celular montado en el camión) ─────────────────
// Abre /en-vivo?device=CLAVE, permite la ubicación y transmite solo, sin login
// ni operador. Reanuda al recargar (la clave va en la URL).
function DeviceMode({ deviceKey }: { deviceKey: string }) {
  const { toast } = useToast();
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [startedAt] = useState(() => Date.now());

  const watcherRef = useRef<GeoWatcher | null>(null);
  const wakeLockRef = useRef<any>(null);
  const lastPingRef = useRef(0);
  const runningRef = useRef(true);
  runningRef.current = running;

  const elapsed = useElapsed(running ? startedAt : null);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
    } catch { /* opcional */ }
  }, []);

  const startWatch = useCallback(async () => {
    if (watcherRef.current) return;
    watcherRef.current = await startLocationWatch(
      (fix) => {
        setCoords({ lat: fix.latitude, lng: fix.longitude, acc: fix.accuracy });
        setError(null);
        if (!runningRef.current) return;
        const now = Date.now();
        if (now - lastPingRef.current >= 8000) {
          lastPingRef.current = now;
          devicePing(deviceKey, fix.latitude, fix.longitude).catch(() => {});
        }
      },
      (msg) => setError(msg),
      { title: info?.label || "Radar Vecinal", message: "Transmitiendo ubicación (oficial)" },
    );
  }, [deviceKey, info?.label]);

  const stopWatch = useCallback(async () => {
    if (watcherRef.current) { try { await watcherRef.current.stop(); } catch { /* ignore */ } watcherRef.current = null; }
  }, []);

  // Cargar info del dispositivo y arrancar.
  useEffect(() => {
    let cancelled = false;
    getDeviceInfo(deviceKey)
      .then((d) => {
        if (cancelled) return;
        setInfo(d);
        startWatch();
        requestWakeLock();
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.status === 403 ? "Dispositivo deshabilitado." : "Dispositivo no encontrado o enlace inválido.");
      });
    const onVisible = () => { if (document.visibilityState === "visible" && runningRef.current) { requestWakeLock(); startWatch(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); stopWatch(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceKey]);

  const stop = async () => {
    setRunning(false);
    await stopWatch();
    try { await deviceStop(deviceKey); } catch { /* best-effort */ }
    if (wakeLockRef.current) { try { await wakeLockRef.current.release(); } catch { /* ignore */ } wakeLockRef.current = null; }
    toast({ title: "Transmisión detenida" });
  };

  const resume = async () => {
    setRunning(true);
    runningRef.current = true;
    lastPingRef.current = 0;
    await startWatch();
    requestWakeLock();
  };

  const meta = info ? providerMeta(info.type) : null;

  if (error && !info) {
    return (
      <div className="rv-in max-w-md mx-auto">
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-200">No se pudo iniciar el modo dispositivo</p>
            <p className="text-xs text-red-200/80 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rv-in max-w-md mx-auto flex flex-col gap-4">
      <div className="relative rounded-3xl overflow-hidden border border-white/8 p-6"
        style={{ background: `radial-gradient(120% 120% at 50% 0%, ${meta?.color ?? "#22c55e"}22, rgba(9,12,20,0.92))` }}>
        <div className="flex items-center justify-center gap-2 mb-1">
          {running ? (
            <>
              <span className="relative flex w-2.5 h-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="label-mono text-[11px] font-bold text-red-400 tracking-wider">EN VIVO · OFICIAL</span>
            </>
          ) : (
            <span className="label-mono text-[11px] font-bold text-muted-foreground tracking-wider">DETENIDO</span>
          )}
        </div>
        <div className="flex flex-col items-center text-center gap-1 mt-3">
          <span className="text-5xl mb-1">{meta?.emoji ?? "🚛"}</span>
          <h2 className="font-display text-xl font-bold text-white">{info?.label ?? "Dispositivo"}</h2>
          <p className="text-xs text-muted-foreground mt-1">{info?.districtName ?? ""} · Modo dispositivo</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.04] border border-white/8">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-display text-lg font-bold text-white tabular-nums">{elapsed}</span>
            <span className="text-[10px] text-muted-foreground">Transmitiendo</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/[0.04] border border-white/8">
            <Satellite className="w-4 h-4 text-emerald-400" />
            <span className="font-display text-lg font-bold text-white tabular-nums">{coords?.acc ? `±${Math.round(coords.acc)}m` : "…"}</span>
            <span className="text-[10px] text-muted-foreground">Precisión GPS</span>
          </div>
        </div>
        {coords && (
          <p className="text-center text-[10px] text-muted-foreground/70 mt-3 label-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground px-4">
        {isNativeTracking()
          ? "Deja el celular montado y cargando. Sigue transmitiendo aunque bloquees la pantalla."
          : "Deja esta pantalla abierta con el celular montado y cargando. En la app instalada transmite también con la pantalla apagada."}
      </p>

      {running ? (
        <button onClick={stop}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 font-semibold hover:bg-red-500/25 transition-colors">
          <Square className="w-4 h-4 fill-current" /> Detener transmisión
        </button>
      ) : (
        <button onClick={resume}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-br from-primary to-[#1e52d6] text-white font-semibold hover:-translate-y-px transition-transform">
          <Radio className="w-4 h-4" /> Reanudar transmisión
        </button>
      )}
    </div>
  );
}
