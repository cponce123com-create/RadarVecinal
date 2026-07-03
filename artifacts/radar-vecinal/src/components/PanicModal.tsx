import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ShieldAlert, Heart, Users, Flame, UserX, Zap, MapPin, Locate, CheckCircle2, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PanicAlertType, useCreatePanicAlert } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDistrict } from "@/contexts/DistrictContext";

interface PanicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PANIC_OPTIONS: { type: PanicAlertType; icon: any; label: string; sub: string; color: string; bg: string }[] = [
  { type: PanicAlertType.robbery, icon: AlertTriangle, label: "Asalto", sub: "Robo en progreso", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  { type: PanicAlertType.medical, icon: Heart, label: "Emergencia médica", sub: "Necesito ambulancia", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { type: PanicAlertType.fight, icon: Users, label: "Violencia física", sub: "Pelea o agresión", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  { type: PanicAlertType.fire, icon: Flame, label: "Incendio", sub: "Fuego fuera de control", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { type: PanicAlertType.missing_person, icon: UserX, label: "Persona extraviada", sub: "Menor o adulto mayor", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { type: PanicAlertType.other, icon: Zap, label: "Otra emergencia", sub: "Describir luego", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
];

// Fallback absoluto solo si no hay distrito cargado (nunca debería pasar en producción)
const FALLBACK_LAT = -11.1213;
const FALLBACK_LNG = -75.3498;

type Phase = "select" | "countdown" | "sending" | "sent";

// ── Marcador de pánico (divIcon — los íconos default de Leaflet se rompen con Vite)
const panicIcon = L.divIcon({
  className: "",
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  html: `
    <div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;inset:-5px;border-radius:50%;border:2px solid #ef4444;opacity:.55;animation:pulse 1.4s ease-out infinite;"></span>
      <div style="width:38px;height:38px;border-radius:50%;background:#ef444430;border:3px solid #ef4444;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px #ef444480;">
        <div style="width:12px;height:12px;border-radius:50%;background:#ef4444;"></div>
      </div>
    </div>`,
});

// ── Sub-componente: recentra el mapa cuando cambia la posición y arregla el
//    problema clásico de Leaflet dentro de modales animados (mapa gris)
function MapController({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

// ── Sub-componente: tocar el mapa mueve el marcador
function TapToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function PanicModal({ isOpen, onClose }: PanicModalProps) {
  const [selected, setSelected] = useState<(typeof PANIC_OPTIONS)[0] | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("select");
  const { toast } = useToast();
  const createAlert = useCreatePanicAlert();

  const { user } = useAuth();
  const { currentDistrictId, currentDistrict, districtInfo } = useDistrict();

  // ── Ubicación ──────────────────────────────────────────────────────────────
  // Prioridad: 1) marcador ajustado por el usuario  2) GPS  3) centro del distrito
  const districtLat = districtInfo?.centerLat ?? FALLBACK_LAT;
  const districtLng = districtInfo?.centerLng ?? FALLBACK_LNG;

  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"searching" | "ok" | "error">("searching");
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [userMoved, setUserMoved] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // El GPS se solicita EN CUANTO se abre el modal (no después del countdown):
  // en una emergencia cada segundo cuenta.
  useEffect(() => {
    if (!isOpen) return;
    setGpsStatus("searching");
    setUserMoved(false);
    setMarker(null);
    setGps(null);

    if (!("geolocation" in navigator)) {
      setGpsStatus("error");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setGps(p);
        setGpsStatus("ok");
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isOpen]);

  // Mientras el usuario no haya movido el pin manualmente, el marcador sigue al GPS
  useEffect(() => {
    if (!userMoved && gps) setMarker({ lat: gps.lat, lng: gps.lng });
  }, [gps, userMoved]);

  const effectiveLat = marker?.lat ?? gps?.lat ?? districtLat;
  const effectiveLng = marker?.lng ?? gps?.lng ?? districtLng;

  const moveMarker = useCallback((lat: number, lng: number) => {
    setMarker({ lat, lng });
    setUserMoved(true);
  }, []);

  const recenterToGps = () => {
    if (gps) {
      setMarker({ lat: gps.lat, lng: gps.lng });
      setUserMoved(false);
    }
  };

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      triggerAlert();
      return;
    }
    if ("vibrate" in navigator) navigator.vibrate(80);
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const handleSelect = (opt: (typeof PANIC_OPTIONS)[0]) => {
    if (!currentDistrictId) {
      toast({
        title: "Selecciona tu distrito",
        description: "Necesitamos saber tu distrito para avisar al serenazgo correcto.",
        variant: "destructive",
      });
      return;
    }
    setSelected(opt);
    setPhase("countdown");
    setCountdown(3);
  };

  const cancelAlert = () => {
    setSelected(null);
    setCountdown(null);
    setPhase("select");
  };

  const resetAndClose = () => {
    setSelected(null);
    setCountdown(null);
    setPhase("select");
    onClose();
  };

  const handleClose = () => {
    // Durante el envío no se puede cerrar (evita estados fantasma)
    if (phase === "sending") return;
    resetAndClose();
  };

  // ── Envío ──────────────────────────────────────────────────────────────────
  const triggerAlert = () => {
    if (!selected || !currentDistrictId) return;
    setPhase("sending");
    setCountdown(null);
    if ("vibrate" in navigator) navigator.vibrate([120, 60, 200]);

    const address = userMoved
      ? "Ubicación ajustada en el mapa por el vecino"
      : gps
        ? `Ubicación GPS (±${Math.round(gps.accuracy)} m)`
        : `Centro de ${currentDistrict || "distrito"} (sin señal GPS)`;

    createAlert.mutate(
      {
        data: {
          type: selected.type,
          latitude: effectiveLat,
          longitude: effectiveLng,
          address,
          authorName: user?.name || "Vecino anónimo",
          sector: user?.sector || currentDistrict || "Sin sector",
          districtId: currentDistrictId,
        },
      },
      {
        onSuccess: () => {
          setPhase("sent");
          if ("vibrate" in navigator) navigator.vibrate([80, 40, 80, 40, 200]);
        },
        onError: () => {
          toast({
            title: "No pudimos enviar la alerta",
            description: "Revisa tu conexión e intenta de nuevo. Si es urgente llama al 105 (PNP) o a serenazgo.",
            variant: "destructive",
          });
          setPhase("select");
          setSelected(null);
        },
      },
    );
  };

  const circumference = 2 * Math.PI * 54; // r=54

  const gpsChip =
    gpsStatus === "ok" ? (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        Ubicación lista {gps && `(±${Math.round(gps.accuracy)} m)`}
      </span>
    ) : gpsStatus === "searching" ? (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
        <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
        Buscando señal GPS...
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-300">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        Sin GPS — arrastra el pin a tu ubicación
      </span>
    );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 overflow-y-auto"
          style={{ background: "hsl(224 15% 4% / 0.97)", backdropFilter: "blur(24px)" }}
        >
          {/* Vignette rojo animado durante el countdown */}
          <AnimatePresence>
            {phase === "countdown" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.15, 0.05, 0.15, 0.05] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at center, hsl(0 90% 55% / 0.15) 0%, transparent 70%)" }}
              />
            )}
          </AnimatePresence>

          {/* Botón cerrar (oculto mientras se envía) */}
          {phase !== "sending" && (
            <button
              onClick={handleClose}
              aria-label="Cerrar"
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/6 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <AnimatePresence mode="wait">
            {/* ══ FASE 1: Selección + mapa de ubicación ══ */}
            {phase === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -16 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-sm flex flex-col items-center my-auto"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-destructive/15 border-2 border-destructive/40 flex items-center justify-center">
                      <ShieldAlert className="w-6 h-6 text-destructive" />
                    </div>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-destructive"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight leading-none">BOTÓN DE PÁNICO</h2>
                    <p className="text-[11px] text-muted-foreground mt-1">{currentDistrict || "Distrito no seleccionado"}</p>
                  </div>
                </div>

                {/* ── Mapa de ubicación ── */}
                <div className="w-full rounded-xl overflow-hidden border border-white/10 mb-2 relative" style={{ height: 190 }}>
                  <MapContainer
                    center={[effectiveLat, effectiveLng]}
                    zoom={16}
                    zoomControl={false}
                    attributionControl={false}
                    style={{ width: "100%", height: "100%", background: "#111" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapController lat={effectiveLat} lng={effectiveLng} />
                    <TapToMove onMove={moveMarker} />
                    <Marker
                      position={[effectiveLat, effectiveLng]}
                      icon={panicIcon}
                      draggable
                      eventHandlers={{
                        dragend: (e) => {
                          const p = (e.target as L.Marker).getLatLng();
                          moveMarker(p.lat, p.lng);
                        },
                      }}
                    />
                  </MapContainer>
                  {/* Botón recentrar a GPS */}
                  {gpsStatus === "ok" && userMoved && (
                    <button
                      onClick={recenterToGps}
                      className="absolute bottom-2 right-2 z-[500] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 border border-white/15 text-white text-[11px] font-semibold backdrop-blur-sm hover:bg-black/85 transition-all"
                    >
                      <Locate className="w-3.5 h-3.5" />
                      Usar mi GPS
                    </button>
                  )}
                </div>

                <div className="w-full flex items-center justify-between mb-4 px-0.5">
                  {gpsChip}
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    Arrastra o toca el mapa para ajustar
                  </span>
                </div>

                {/* Grid de tipos de emergencia */}
                <div className="grid grid-cols-2 gap-2.5 w-full">
                  {PANIC_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <motion.button
                        key={opt.type}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleSelect(opt)}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-white/6 hover:border-white/15 transition-all text-left"
                        style={{ background: opt.bg, minHeight: 62 }}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${opt.color}20` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: opt.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white leading-tight">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{opt.sub}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ══ FASE 2: Countdown cancelable ══ */}
            {phase === "countdown" && (
              <motion.div
                key="countdown"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center text-center"
              >
                {selected && (() => {
                  const Icon = selected.icon;
                  return (
                    <>
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border border-white/10"
                        style={{ background: selected.bg }}
                      >
                        <Icon className="w-7 h-7" style={{ color: selected.color }} />
                      </div>
                      <p className="text-muted-foreground text-base font-medium mb-1">{selected.label}</p>
                    </>
                  );
                })()}

                <h3 className="text-2xl font-bold text-white mb-2">Enviando alerta en...</h3>
                <p className="text-xs text-muted-foreground mb-6 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {userMoved
                    ? "Ubicación ajustada por ti en el mapa"
                    : gpsStatus === "ok"
                      ? `Tu ubicación GPS (±${Math.round(gps?.accuracy ?? 0)} m)`
                      : `Centro de ${currentDistrict || "tu distrito"}`}
                </p>

                <div className="relative w-44 h-44 mb-8">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(220 14% 14%)" strokeWidth="8" />
                    <motion.circle
                      cx="60" cy="60" r="54"
                      fill="none"
                      stroke="hsl(0 90% 55%)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 3, ease: "linear" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      key={countdown}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-6xl font-bold text-destructive text-glow-red"
                    >
                      {countdown}
                    </motion.span>
                    <span className="text-xs text-muted-foreground mt-1">segundos</span>
                  </div>
                </div>

                <button
                  onClick={cancelAlert}
                  className="px-8 py-3 rounded-full border-2 border-white/12 bg-white/4 text-white font-bold text-sm tracking-wider hover:bg-white/8 hover:border-white/20 transition-all"
                >
                  CANCELAR ALERTA
                </button>
              </motion.div>
            )}

            {/* ══ FASE 3: Enviando ══ */}
            {phase === "sending" && (
              <motion.div
                key="sending"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                className="flex flex-col items-center text-center"
              >
                <Loader2 className="w-14 h-14 text-destructive animate-spin mb-5" />
                <h3 className="text-2xl font-bold text-white mb-2">Enviando alerta...</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Notificando a serenazgo y vecinos cercanos. No cierres la aplicación.
                </p>
              </motion.div>
            )}

            {/* ══ FASE 4: Confirmación ══ */}
            {phase === "sent" && (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center text-center max-w-xs"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 14 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-center mb-5"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">Alerta enviada</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Serenazgo y los vecinos de <span className="text-white/80 font-semibold">{currentDistrict}</span> ya fueron notificados con tu ubicación.
                </p>
                <p className="text-[11px] text-muted-foreground/70 mb-7">
                  Si la emergencia empeora, llama al <span className="text-white/70 font-semibold">105</span> (Policía Nacional).
                </p>
                <button
                  onClick={resetAndClose}
                  className="px-8 py-3 rounded-full bg-white/8 border-2 border-white/15 text-white font-bold text-sm tracking-wider hover:bg-white/12 transition-all"
                >
                  ENTENDIDO
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
