import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Report } from "@workspace/api-client-react";
import { CATEGORY_CONFIG } from "@/lib/constants";
import { X, Clock, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface MapPlaceholderProps {
  reports?: Report[];
  interactive?: boolean;
  className?: string;
}

// San Ramón, Chanchamayo, Junín — bounding box → percentages (0–100)
const BOUNDS = { latMin: -11.165, latMax: -11.095, lngMin: -75.395, lngMax: -75.315 };

function latToY(lat: number) {
  return ((lat - BOUNDS.latMax) / (BOUNDS.latMin - BOUNDS.latMax)) * 100;
}
function lngToX(lng: number) {
  return ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * 100;
}

const CAT_COLORS: Record<string, string> = {
  robbery: "#ef4444", fight: "#f97316", suspicious: "#eab308",
  water_cut: "#3b82f6", garbage: "#6b7280", informal_commerce: "#a855f7",
  noise: "#f59e0b", missing_person: "#f59e0b", fire: "#ef4444",
  medical_emergency: "#ef4444", other: "#6b7280",
};

// San Ramón, Chanchamayo demo blips
const DEMO: Omit<Report, "updatedAt">[] = [
  { id: "d1", title: "Robo en bodega",        category: "robbery"           as any, urgency: "critical" as any, status: "active"   as any, isAnonymous: false, latitude: -11.130, longitude: -75.357, address: "Jr. Junín 245",        sector: "San Ramón Centro", authorName: "Carlos Q.", confirmedCount: 8,  imageUrl: null, description: "", createdAt: new Date(Date.now() - 30*60000).toISOString() },
  { id: "d2", title: "Actitud sospechosa",    category: "suspicious"        as any, urgency: "medium"   as any, status: "reviewing" as any, isAnonymous: true,  latitude: -11.120, longitude: -75.350, address: "Plaza de Armas",       sector: "San Ramón Centro", authorName: "Anónimo",   confirmedCount: 4,  imageUrl: null, description: "", createdAt: new Date(Date.now() - 2*3600000).toISOString() },
  { id: "d3", title: "Pelea callejera",       category: "fight"             as any, urgency: "high"     as any, status: "resolved"  as any, isAnonymous: false, latitude: -11.110, longitude: -75.362, address: "Jr. Progreso 456",     sector: "La Merced",        authorName: "María G.",  confirmedCount: 12, imageUrl: null, description: "", createdAt: new Date(Date.now() - 5*3600000).toISOString() },
  { id: "d4", title: "Corte de agua",         category: "water_cut"         as any, urgency: "medium"   as any, status: "active"   as any, isAnonymous: false, latitude: -11.140, longitude: -75.340, address: "Calle Los Álamos",     sector: "Pampa del Carmen", authorName: "Luis M.",   confirmedCount: 15, imageUrl: null, description: "", createdAt: new Date(Date.now() - 6*3600000).toISOString() },
  { id: "d5", title: "Basura acumulada",      category: "garbage"           as any, urgency: "low"      as any, status: "active"   as any, isAnonymous: false, latitude: -11.148, longitude: -75.375, address: "Av. Circunvalación",   sector: "Los Ángeles",      authorName: "Ana T.",    confirmedCount: 7,  imageUrl: null, description: "", createdAt: new Date(Date.now() - 16*3600000).toISOString() },
  { id: "d6", title: "Emergencia médica",     category: "medical_emergency" as any, urgency: "critical" as any, status: "resolved" as any, isAnonymous: false, latitude: -11.125, longitude: -75.348, address: "Av. Chanchamayo 890",  sector: "San Ramón Centro", authorName: "Luis M.",   confirmedCount: 3,  imageUrl: null, description: "", createdAt: new Date(Date.now() - 18*3600000).toISOString() },
  { id: "d7", title: "Asalto en grifo",       category: "robbery"           as any, urgency: "critical" as any, status: "active"   as any, isAnonymous: false, latitude: -11.135, longitude: -75.355, address: "Jr. Tarma 567",        sector: "San Ramón Centro", authorName: "Carlos Q.", confirmedCount: 20, imageUrl: null, description: "", createdAt: new Date(Date.now() - 7*3600000).toISOString() },
  { id: "d8", title: "Incendio en vivienda",  category: "fire"              as any, urgency: "critical" as any, status: "resolved" as any, isAnonymous: false, latitude: -11.115, longitude: -75.370, address: "Jr. Huánuco 123",      sector: "San Luis",         authorName: "Ana T.",    confirmedCount: 18, imageUrl: null, description: "", createdAt: new Date(Date.now() - 20*3600000).toISOString() },
];

interface MarkerInfo extends Omit<Report, "updatedAt"> { xPct: number; yPct: number; }

// Radial lines every 45 degrees (8 directions)
const RADIALS = [0, 45, 90, 135].map(deg => {
  const rad = (deg * Math.PI) / 180;
  return {
    x1: 50 + 50 * Math.cos(rad),
    y1: 50 + 50 * Math.sin(rad),
    x2: 50 - 50 * Math.cos(rad),
    y2: 50 - 50 * Math.sin(rad),
  };
});

// Cardinal labels
const CARDINALS = [
  { label: "N", x: 50, y: 3 },
  { label: "S", x: 50, y: 98 },
  { label: "E", x: 97, y: 50 },
  { label: "W", x: 3,  y: 50 },
];

export function MapPlaceholder({ reports = [], interactive = false, className = "" }: MapPlaceholderProps) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<MarkerInfo | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const raw = reports.length > 0 ? reports : DEMO as Report[];
  const markers: MarkerInfo[] = raw.map(r => ({
    ...r,
    xPct: Math.min(93, Math.max(7, lngToX(r.longitude))),
    yPct: Math.min(93, Math.max(7, latToY(r.latitude))),
  }));

  if (!mounted) return (
    <div className={`w-full h-full bg-[#030608] ${className}`} />
  );

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center bg-[#030608] overflow-hidden ${className}`}
    >
      {/* CRT scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-20 opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)",
          backgroundSize: "100% 3px",
        }}
      />

      {/* Radar circle — square centered */}
      <div
        className="relative flex-shrink-0"
        style={{
          width: "min(100%, 100cqh, calc(100% - 8px))",
          aspectRatio: "1 / 1",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {/* SVG base layer */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            <clipPath id="radar-circle-clip">
              <circle cx="50" cy="50" r="50" />
            </clipPath>
            {/* Sweep gradient */}
            <radialGradient id="sweep-trail" cx="50%" cy="50%" r="50%">
              <stop offset="10%" stopColor="#1a6fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#1a6fff" stopOpacity="0.03" />
            </radialGradient>
          </defs>

          {/* ── Background ── */}
          <circle cx="50" cy="50" r="50" fill="#030810" clipPath="url(#radar-circle-clip)" />

          <g clipPath="url(#radar-circle-clip)">
            {/* Subtle green sector zones (geographic hint) */}
            <path d="M50,50 L50,0 A50,50 0 0,1 100,50 Z" fill="rgba(26,111,255,0.012)" />
            <path d="M50,50 L100,50 A50,50 0 0,1 50,100 Z" fill="rgba(26,111,255,0.008)" />

            {/* Radial grid lines */}
            {RADIALS.map((r, i) => (
              <line
                key={i}
                x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
                stroke="rgba(26,111,255,0.10)"
                strokeWidth="0.3"
                strokeDasharray="2 4"
              />
            ))}

            {/* Concentric rings */}
            {[12.5, 25, 37.5, 50].map((r, i) => (
              <circle
                key={i}
                cx="50" cy="50" r={r}
                fill="none"
                stroke={i === 3 ? "rgba(26,111,255,0.30)" : "rgba(26,111,255,0.12)"}
                strokeWidth={i === 3 ? "0.5" : "0.3"}
              />
            ))}

            {/* Distance labels on the rings */}
            {[
              { r: 12.5, label: "500m" },
              { r: 25,   label: "1km" },
              { r: 37.5, label: "2km" },
            ].map(({ r, label }) => (
              <text
                key={label}
                x={50 + r + 0.5}
                y="50"
                fill="rgba(26,111,255,0.30)"
                fontSize="2.2"
                fontFamily="monospace"
              >
                {label}
              </text>
            ))}

            {/* Cardinal direction labels */}
            {CARDINALS.map(c => (
              <text
                key={c.label}
                x={c.x} y={c.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(26,111,255,0.50)"
                fontSize="3.5"
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="0"
              >
                {c.label}
              </text>
            ))}

            {/* Tiny tick marks on outer ring */}
            {Array.from({ length: 36 }).map((_, i) => {
              const angle = (i * 10 * Math.PI) / 180;
              const major = i % 9 === 0;
              const inner = major ? 47.5 : 48.5;
              return (
                <line
                  key={i}
                  x1={50 + inner * Math.cos(angle)}
                  y1={50 + inner * Math.sin(angle)}
                  x2={50 + 50 * Math.cos(angle)}
                  y2={50 + 50 * Math.sin(angle)}
                  stroke={major ? "rgba(26,111,255,0.35)" : "rgba(26,111,255,0.12)"}
                  strokeWidth={major ? "0.5" : "0.25"}
                />
              );
            })}

            {/* Center crosshair */}
            <circle cx="50" cy="50" r="1.2" fill="rgba(26,111,255,0.60)" />
            <circle cx="50" cy="50" r="0.5" fill="#3b82f6" />
          </g>

          {/* Outer border ring */}
          <circle
            cx="50" cy="50" r="50"
            fill="none"
            stroke="rgba(26,111,255,0.35)"
            strokeWidth="0.6"
          />
          {/* Double outer ring */}
          <circle
            cx="50" cy="50" r="49"
            fill="none"
            stroke="rgba(26,111,255,0.10)"
            strokeWidth="0.3"
          />
        </svg>

        {/* ── Radar Sweep ── */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
        >
          <div className="absolute inset-0 radar-sweep" />
        </div>

        {/* ── Incident Blips ── */}
        {markers.map((m, idx) => {
          const color = CAT_COLORS[m.category] ?? "#6b7280";
          const isActive  = m.status === "active";
          const isCritical = m.urgency === "critical";
          const isSelected = selected?.id === m.id;
          const size = isCritical ? 10 : isActive ? 8 : 6;

          return (
            <motion.div
              key={m.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 + idx * 0.08, type: "spring", stiffness: 500, damping: 28 }}
              className={`absolute z-10 ${interactive ? "cursor-pointer" : "cursor-default"}`}
              style={{
                left: `${m.xPct}%`,
                top: `${m.yPct}%`,
                transform: "translate(-50%, -50%)",
              }}
              onClick={() => interactive && setSelected(isSelected ? null : m)}
            >
              {/* Pulse ring for active/critical */}
              {(isActive || isCritical) && (
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    inset: `-${size * 0.6}px`,
                    border: `1px solid ${color}`,
                  }}
                  animate={{ scale: [1, 2.0, 1], opacity: [0.7, 0, 0.7] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: idx * 0.4 }}
                />
              )}

              {/* Second outer ring for critical */}
              {isCritical && (
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    inset: `-${size}px`,
                    border: `1px solid ${color}55`,
                  }}
                  animate={{ scale: [1, 2.8, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: idx * 0.4 + 0.5 }}
                />
              )}

              {/* The blip dot */}
              <div
                className={`relative rounded-full transition-transform duration-150 ${isSelected ? "scale-[1.8]" : "hover:scale-150"}`}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  background: color,
                  boxShadow: `0 0 ${isCritical ? 10 : 6}px ${color}, 0 0 ${isCritical ? 20 : 12}px ${color}55`,
                  border: `1.5px solid ${color === "#6b7280" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.3)"}`,
                }}
              />
            </motion.div>
          );
        })}

        {/* ── Popup (interactive mode) ── */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute z-30 w-56 rounded-xl border shadow-2xl overflow-hidden"
              style={{
                left: `${Math.min(selected.xPct, 55)}%`,
                top: `${Math.max(selected.yPct - 42, 4)}%`,
                background: "rgba(6, 9, 18, 0.96)",
                borderColor: CAT_COLORS[selected.category] + "50",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="h-0.5 w-full" style={{ background: CAT_COLORS[selected.category] ?? "#3b82f6" }} />
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CAT_COLORS[selected.category] }} />
                    <span className="text-xs font-semibold text-white truncate">{selected.title}</span>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-white flex-shrink-0 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{selected.address || selected.sector}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span>{formatDistanceToNow(new Date(selected.createdAt), { locale: es, addSuffix: true })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ background: `${CAT_COLORS[selected.category]}22`, color: CAT_COLORS[selected.category] }}
                  >
                    {CATEGORY_CONFIG[selected.category as keyof typeof CATEGORY_CONFIG]?.label ?? selected.category}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    selected.status === "resolved" ? "bg-green-500/15 text-green-400"
                    : selected.status === "active"  ? "bg-red-500/15 text-red-400"
                    : "bg-yellow-500/15 text-yellow-400"
                  }`}>
                    {selected.status === "active" ? "Activo" : selected.status === "resolved" ? "Resuelto" : "En revisión"}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── System readout overlay (bottom of circle) ── */}
        <div
          className="absolute pointer-events-none z-10"
          style={{ bottom: "8%", left: "50%", transform: "translateX(-50%)" }}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-[8px] tracking-[0.25em] font-mono text-blue-400/40 uppercase">
              RADAR_SYS · SAN RAMÓN · CHANCHAMAYO
            </span>
          </div>
        </div>
      </div>

      {/* ── HUD: Incident count badge ── */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 border border-blue-500/20 z-20 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-[10px] text-white/60 font-mono">{markers.length} BLIPS</span>
      </div>

      {/* ── Legend (interactive only) ── */}
      {interactive && (
        <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1 pointer-events-none">
          {[
            { color: "#ef4444", label: "Crítico activo" },
            { color: "#f97316", label: "Alto" },
            { color: "#eab308", label: "Sospechoso" },
            { color: "#3b82f6", label: "Agua/médico" },
            { color: "#6b7280", label: "Otros" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: l.color, boxShadow: `0 0 4px ${l.color}` }} />
              <span className="text-[9px] font-mono text-white/30">{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
