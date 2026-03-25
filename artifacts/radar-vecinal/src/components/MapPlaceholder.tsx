import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Report } from "@workspace/api-client-react";
import { CATEGORY_CONFIG, URGENCY_CONFIG } from "@/lib/constants";
import { X, AlertTriangle, Clock, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface MapPlaceholderProps {
  reports?: Report[];
  interactive?: boolean;
  className?: string;
}

// San Miguel, Lima bounding box
const BOUNDS = {
  latMin: -12.105,
  latMax: -12.055,
  lngMin: -77.125,
  lngMax: -77.065,
};

function latToY(lat: number): number {
  return ((lat - BOUNDS.latMax) / (BOUNDS.latMin - BOUNDS.latMax)) * 100;
}

function lngToX(lng: number): number {
  return ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * 100;
}

const CATEGORY_DOT_COLORS: Record<string, string> = {
  robbery: "#ef4444",
  fight: "#f97316",
  suspicious: "#eab308",
  water_cut: "#3b82f6",
  garbage: "#6b7280",
  informal_commerce: "#a855f7",
  noise: "#f59e0b",
  missing_person: "#f59e0b",
  fire: "#ef4444",
  medical_emergency: "#ef4444",
  other: "#6b7280",
};

// Street lines representing San Miguel's main avenues
const STREETS = [
  // Av. La Marina (horizontal, major)
  { x1: 5, y1: 55, x2: 95, y2: 52, width: 2.5, opacity: 0.5 },
  // Av. Universitaria (vertical)
  { x1: 68, y1: 5, x2: 70, y2: 95, width: 2, opacity: 0.4 },
  // Av. Brasil (diagonal)
  { x1: 20, y1: 10, x2: 25, y2: 90, width: 1.5, opacity: 0.35 },
  // Av. Venezuela
  { x1: 5, y1: 32, x2: 95, y2: 30, width: 1.5, opacity: 0.35 },
  // Jr. Sucre
  { x1: 5, y1: 68, x2: 95, y2: 72, width: 1, opacity: 0.25 },
  // Av. Costanera
  { x1: 5, y1: 82, x2: 95, y2: 78, width: 1, opacity: 0.2 },
  // Cross streets
  { x1: 40, y1: 5, x2: 42, y2: 95, width: 1, opacity: 0.25 },
  { x1: 55, y1: 5, x2: 57, y2: 95, width: 1, opacity: 0.2 },
  { x1: 82, y1: 5, x2: 84, y2: 95, width: 1, opacity: 0.2 },
];

// District zones as light rectangles
const ZONES = [
  { x: 5, y: 8, w: 30, h: 22, label: "Pueblo Libre", opacity: 0.06 },
  { x: 36, y: 8, w: 38, h: 42, label: "San Miguel Centro", opacity: 0.08 },
  { x: 75, y: 8, w: 20, h: 42, label: "Maranga", opacity: 0.05 },
  { x: 5, y: 62, w: 90, h: 30, label: "Costanera", opacity: 0.04 },
];

interface MarkerInfo extends Report {
  xPct: number;
  yPct: number;
}

export function MapPlaceholder({ reports = [], interactive = false, className = "" }: MapPlaceholderProps) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<MarkerInfo | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return (
    <div className={`w-full h-full bg-[#080a0f] rounded-xl ${className}`} />
  );

  // Map real report coordinates, or use demo data
  const markers: MarkerInfo[] = reports.length > 0 ? reports.map(r => ({
    ...r,
    xPct: Math.min(95, Math.max(5, lngToX(r.longitude))),
    yPct: Math.min(92, Math.max(5, latToY(r.latitude))),
  })) : [
    { id: "d1", title: "Robo en bodega", category: "robbery" as any, urgency: "critical" as any, status: "active" as any, isAnonymous: false, latitude: -12.0777, longitude: -77.0921, address: "Av. La Marina 1245", sector: "San Miguel Centro", authorName: "Carlos Q.", confirmedCount: 8, imageUrl: null, description: "", createdAt: new Date(Date.now() - 30*60000).toISOString(), updatedAt: "", xPct: lngToX(-77.0921), yPct: latToY(-12.0777) },
    { id: "d2", title: "Actividad sospechosa", category: "suspicious" as any, urgency: "medium" as any, status: "reviewing" as any, isAnonymous: true, latitude: -12.0812, longitude: -77.0889, address: "Parque San Miguel", sector: "San Miguel Centro", authorName: "Anónimo", confirmedCount: 4, imageUrl: null, description: "", createdAt: new Date(Date.now() - 2*3600000).toISOString(), updatedAt: "", xPct: lngToX(-77.0889), yPct: latToY(-12.0812) },
    { id: "d3", title: "Pelea callejera", category: "fight" as any, urgency: "high" as any, status: "resolved" as any, isAnonymous: false, latitude: -12.0756, longitude: -77.0865, address: "Jr. Bolognesi 456", sector: "Pueblo Libre", authorName: "María G.", confirmedCount: 12, imageUrl: null, description: "", createdAt: new Date(Date.now() - 5*3600000).toISOString(), updatedAt: "", xPct: lngToX(-77.0865), yPct: latToY(-12.0756) },
    { id: "d4", title: "Corte de agua", category: "water_cut" as any, urgency: "medium" as any, status: "active" as any, isAnonymous: false, latitude: -12.0834, longitude: -77.0812, address: "Calle Las Gardenias", sector: "Magdalena", authorName: "Luis M.", confirmedCount: 15, imageUrl: null, description: "", createdAt: new Date(Date.now() - 6*3600000).toISOString(), updatedAt: "", xPct: lngToX(-77.0812), yPct: latToY(-12.0834) },
    { id: "d5", title: "Basura acumulada", category: "garbage" as any, urgency: "low" as any, status: "active" as any, isAnonymous: false, latitude: -12.0791, longitude: -77.0934, address: "Av. Brasil 567", sector: "Breña", authorName: "Ana T.", confirmedCount: 7, imageUrl: null, description: "", createdAt: new Date(Date.now() - 16*3600000).toISOString(), updatedAt: "", xPct: lngToX(-77.0934), yPct: latToY(-12.0791) },
    { id: "d6", title: "Emergencia médica", category: "medical_emergency" as any, urgency: "critical" as any, status: "resolved" as any, isAnonymous: false, latitude: -12.0823, longitude: -77.0856, address: "Av. Salaverry 890", sector: "Jesús María", authorName: "Luis M.", confirmedCount: 3, imageUrl: null, description: "", createdAt: new Date(Date.now() - 18*3600000).toISOString(), updatedAt: "", xPct: lngToX(-77.0856), yPct: latToY(-12.0823) },
    { id: "d7", title: "Asalto en grifo", category: "robbery" as any, urgency: "critical" as any, status: "active" as any, isAnonymous: false, latitude: -12.0745, longitude: -77.0902, address: "Av. La Marina 567", sector: "San Miguel Centro", authorName: "Carlos Q.", confirmedCount: 20, imageUrl: null, description: "", createdAt: new Date(Date.now() - 7*3600000).toISOString(), updatedAt: "", xPct: lngToX(-77.0902), yPct: latToY(-12.0745) },
    { id: "d8", title: "Incendio en vivienda", category: "fire" as any, urgency: "critical" as any, status: "resolved" as any, isAnonymous: false, latitude: -12.0789, longitude: -77.0923, address: "Jr. Huánuco 123", sector: "Breña", authorName: "Ana T.", confirmedCount: 18, imageUrl: null, description: "", createdAt: new Date(Date.now() - 20*3600000).toISOString(), updatedAt: "", xPct: lngToX(-77.0923), yPct: latToY(-12.0789) },
  ];

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[#060810] overflow-hidden select-none ${className}`}
      style={{ fontFamily: "var(--app-font-mono)" }}
    >
      {/* Base grid */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(217 100% 55%) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(217 100% 55%) 1px, transparent 1px)
          `,
          backgroundSize: "52px 52px",
        }}
      />

      {/* SVG Map Layer */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {/* District zones */}
        {ZONES.map((z, i) => (
          <rect
            key={i}
            x={z.x} y={z.y} width={z.w} height={z.h}
            fill={`hsl(217 100% 55% / ${z.opacity})`}
            rx="1"
          />
        ))}

        {/* Streets */}
        {STREETS.map((s, i) => (
          <line
            key={i}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={`hsl(217 80% 65% / ${s.opacity})`}
            strokeWidth={s.width}
            strokeLinecap="round"
          />
        ))}

        {/* Block details */}
        <rect x="38" y="10" width="8" height="6" fill="hsl(217 40% 35% / 0.12)" rx="0.5" />
        <rect x="48" y="10" width="6" height="6" fill="hsl(217 40% 35% / 0.1)" rx="0.5" />
        <rect x="38" y="20" width="12" height="8" fill="hsl(217 40% 35% / 0.1)" rx="0.5" />
        <rect x="72" y="12" width="10" height="14" fill="hsl(217 40% 35% / 0.1)" rx="0.5" />
        <rect x="84" y="12" width="8" height="10" fill="hsl(217 40% 35% / 0.08)" rx="0.5" />
        <rect x="6" y="12" width="12" height="8" fill="hsl(217 40% 35% / 0.1)" rx="0.5" />
        <rect x="20" y="12" width="10" height="6" fill="hsl(217 40% 35% / 0.08)" rx="0.5" />

        {/* Zone labels */}
        {ZONES.map((z, i) => (
          <text
            key={i}
            x={z.x + z.w / 2}
            y={z.y + z.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(217 70% 60% / 0.35)"
            fontSize="3.2"
            fontFamily="monospace"
            letterSpacing="0.5"
          >
            {z.label.toUpperCase()}
          </text>
        ))}

        {/* Compass */}
        <text x="93" y="8" textAnchor="middle" fill="hsl(217 60% 50% / 0.4)" fontSize="3.5" fontFamily="monospace">N</text>
        <line x1="93" y1="9.5" x2="93" y2="14" stroke="hsl(217 60% 50% / 0.3)" strokeWidth="0.5" />
      </svg>

      {/* Radar sweep */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "50%",
          left: "50%",
          width: "220%",
          height: "220%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="w-full h-full radar-sweep" />
      </div>

      {/* Radar rings */}
      {[25, 50, 75].map(r => (
        <div
          key={r}
          className="absolute rounded-full border pointer-events-none"
          style={{
            width: `${r}%`,
            height: `${r}%`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderColor: "hsl(217 100% 55% / 0.08)",
          }}
        />
      ))}

      {/* Center dot */}
      <div
        className="absolute w-2 h-2 rounded-full bg-primary/60 pointer-events-none"
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      />

      {/* Incident Markers */}
      {markers.map((m, idx) => {
        const color = CATEGORY_DOT_COLORS[m.category] ?? "#6b7280";
        const isActive = m.status === "active";
        const isCritical = m.urgency === "critical";
        const isSelected = selected?.id === m.id;
        const isHovered = hoveredId === m.id;

        return (
          <motion.div
            key={m.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: idx * 0.06, type: "spring", stiffness: 400, damping: 25 }}
            className="absolute z-10 cursor-pointer"
            style={{
              left: `${m.xPct}%`,
              top: `${m.yPct}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={() => interactive && setSelected(isSelected ? null : m)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Pulse ring for active/critical */}
            {(isActive || isCritical) && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ background: color }}
                animate={{ scale: [1, 2.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: idx * 0.3 }}
              />
            )}

            {/* Marker dot */}
            <div
              className={`relative rounded-full border-2 border-black/40 shadow-lg transition-transform duration-150 ${
                isHovered || isSelected ? "scale-150" : "scale-100"
              }`}
              style={{
                width: isCritical ? "14px" : "10px",
                height: isCritical ? "14px" : "10px",
                background: color,
                boxShadow: `0 0 8px ${color}88, 0 0 20px ${color}44`,
              }}
            />
          </motion.div>
        );
      })}

      {/* Popup card */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 w-64 rounded-xl border shadow-2xl overflow-hidden"
            style={{
              left: `${Math.min(selected.xPct, 65)}%`,
              top: `${Math.max(selected.yPct - 35, 5)}%`,
              background: "hsl(222 20% 9% / 0.97)",
              borderColor: "hsl(220 14% 22%)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Top accent line */}
            <div
              className="h-0.5 w-full"
              style={{ background: CATEGORY_DOT_COLORS[selected.category] ?? "#3b82f6" }}
            />

            <div className="p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: CATEGORY_DOT_COLORS[selected.category] }}
                  />
                  <span className="text-xs font-semibold text-white truncate">{selected.title}</span>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground hover:text-white flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{selected.address || selected.sector}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>{formatDistanceToNow(new Date(selected.createdAt), { locale: es, addSuffix: true })}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-white/5">
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize"
                  style={{
                    background: `${CATEGORY_DOT_COLORS[selected.category]}22`,
                    color: CATEGORY_DOT_COLORS[selected.category],
                  }}
                >
                  {CATEGORY_CONFIG[selected.category as keyof typeof CATEGORY_CONFIG]?.label ?? selected.category}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  selected.status === "resolved"
                    ? "bg-green-500/15 text-green-400"
                    : selected.status === "active"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-yellow-500/15 text-yellow-400"
                }`}>
                  {selected.status === "active" ? "Activo" : selected.status === "resolved" ? "Resuelto" : "En revisión"}
                </span>
                {selected.confirmedCount > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {selected.confirmedCount} confirmaciones
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner info */}
      <div className="absolute bottom-2 right-2 flex items-center gap-2 pointer-events-none">
        <span className="text-[9px] text-muted-foreground/30 font-mono tracking-widest">
          SAN MIGUEL · LIMA · RADAR_SYS_v2.0
        </span>
      </div>

      {/* Marker count badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 border border-white/8 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-[10px] text-white/60 font-mono">{markers.length} INCIDENTES</span>
      </div>

      {/* Hover overlay for home (non-interactive) */}
      {!interactive && (
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-5 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
      )}
    </div>
  );
}
