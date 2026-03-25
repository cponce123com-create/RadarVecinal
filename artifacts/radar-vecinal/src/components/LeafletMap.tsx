import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report } from "@workspace/api-client-react";
import { CAT_HEX, DISTRICT, URGENCY_CONFIG } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Locate, Thermometer, Loader2, MapPin } from "lucide-react";
import { useGeolocation } from "@/lib/useGeolocation";
import { CATEGORY_CONFIG } from "@/lib/constants";

// Fix Leaflet default icon paths broken in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Known landmarks in San Ramón, Chanchamayo ─────────────────────────────────
const LANDMARKS = [
  { lat: -11.1280, lng: -75.3552, label: "Plaza de Armas",          icon: "🏛️", type: "plaza" },
  { lat: -11.1283, lng: -75.3560, label: "Municipalidad San Ramón",  icon: "🏛️", type: "gov" },
  { lat: -11.1248, lng: -75.3517, label: "Hospital Chanchamayo",     icon: "🏥", type: "health" },
  { lat: -11.1300, lng: -75.3564, label: "Comisaría PNP",            icon: "🚔", type: "police" },
  { lat: -11.1293, lng: -75.3549, label: "Mercado Central",          icon: "🛒", type: "market" },
  { lat: -11.1268, lng: -75.3535, label: "Plaza San Martín",         icon: "🌳", type: "plaza" },
  { lat: -11.1315, lng: -75.3575, label: "Iglesia San Ramón",        icon: "⛪", type: "church" },
  { lat: -11.1260, lng: -75.3580, label: "Estadio Municipal",        icon: "⚽", type: "sport" },
];

const LANDMARK_COLORS: Record<string, string> = {
  plaza:  "#22c55e",
  gov:    "#3b82f6",
  health: "#ef4444",
  police: "#1d4ed8",
  market: "#f59e0b",
  church: "#a855f7",
  sport:  "#10b981",
};

interface LeafletMapProps {
  reports: Report[];
  showHeatmap?: boolean;
  className?: string;
}

// ── Dark CSS filter applied to OSM tile pane ──────────────────────────────────
// This runs once after mount to target the specific pane (avoids inverting markers)
function DarkTileFilter() {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane("tilePane");
    if (pane) {
      pane.style.filter = "invert(100%) hue-rotate(200deg) brightness(90%) contrast(88%) sepia(15%)";
    }
    return () => {
      if (pane) pane.style.filter = "";
    };
  }, [map]);
  return null;
}

// ── Landmark markers ──────────────────────────────────────────────────────────
function LandmarkMarkers() {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    LANDMARKS.forEach(lm => {
      const color = LANDMARK_COLORS[lm.type] ?? "#6b7280";
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: ${color}22;
          border: 2px solid ${color}88;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px ${color}44;
        ">
          <span style="transform: rotate(45deg); font-size: 11px; line-height: 1;">${lm.icon}</span>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
      });

      const marker = L.marker([lm.lat, lm.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="
            background: #0f1219;
            border: 1px solid ${color}44;
            border-radius: 10px;
            padding: 8px 12px;
            min-width: 140px;
            font-family: system-ui, sans-serif;
          ">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:14px;">${lm.icon}</span>
              <span style="font-weight:700;font-size:12px;color:#fff;">${lm.label}</span>
            </div>
            <div style="font-size:10px;color:#9ca3af;margin-top:4px;">San Ramón, Chanchamayo</div>
          </div>
        `, { closeButton: false });

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
    };
  }, [map]);

  return null;
}

// ── Heat layer using canvas (no external plugin needed) ──────────────────────
function HeatCanvas({ reports }: { reports: Report[] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) { canvasRef.current.remove(); }

    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:400;";

    const container = map.getContainer();
    container.appendChild(canvas);

    const draw = () => {
      const size = container.getBoundingClientRect();
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const urgencyWeight: Record<string, number> = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.2 };
      reports.forEach(r => {
        const point = map.latLngToContainerPoint([r.latitude, r.longitude]);
        const w = urgencyWeight[r.urgency] ?? 0.4;
        const radius = 55 * w + 22;
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        gradient.addColorStop(0,   `rgba(239, 68, 68, ${0.5 * w})`);
        gradient.addColorStop(0.4, `rgba(234, 179, 8, ${0.28 * w})`);
        gradient.addColorStop(1,   "rgba(239, 68, 68, 0)");
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });
    };

    draw();
    map.on("move zoom resize", draw);
    return () => { map.off("move zoom resize", draw); canvas.remove(); };
  }, [map, reports]);

  return null;
}

// ── Simulated / Real user location marker ─────────────────────────────────────
function UserMarker({ position, simulated }: { position: { lat: number; lng: number } | null; simulated?: boolean }) {
  const map = useMap();
  const circleRef = useRef<L.CircleMarker | null>(null);
  const pulseRef  = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    circleRef.current?.remove();
    pulseRef.current?.remove();
    if (!position) return;

    const color   = simulated ? "#f59e0b" : "#3b82f6";
    const tooltip = simulated ? "📍 San Ramón (demo)" : "📍 Tu ubicación";

    // Outer pulse ring
    const pulse = L.circleMarker([position.lat, position.lng], {
      radius: 16, fillColor: color, fillOpacity: 0.12,
      color, weight: 1.5, opacity: 0.4,
    }).addTo(map);

    // Inner dot
    const dot = L.circleMarker([position.lat, position.lng], {
      radius: 7, fillColor: color, fillOpacity: 1,
      color: "#fff", weight: 2,
    }).addTo(map).bindTooltip(tooltip, { permanent: false, direction: "top" });

    circleRef.current = dot;
    pulseRef.current  = pulse;
    return () => { dot.remove(); pulse.remove(); };
  }, [map, position, simulated]);

  return null;
}

// ── Locate me control ─────────────────────────────────────────────────────────
function LocateControl({ onLocate, simulated }: {
  onLocate: (lat: number, lng: number, sim?: boolean) => void;
  simulated: boolean;
}) {
  const map = useMap();
  const geo = useGeolocation();

  const handleClick = () => {
    if (geo.position) {
      map.flyTo([geo.position.lat, geo.position.lng], 16, { duration: 1.2 });
      onLocate(geo.position.lat, geo.position.lng, false);
    } else {
      geo.request();
    }
  };

  useEffect(() => {
    if (geo.position) {
      map.flyTo([geo.position.lat, geo.position.lng], 16, { duration: 1.2 });
      onLocate(geo.position.lat, geo.position.lng, false);
    }
  }, [geo.position]);

  return (
    <div className="leaflet-top leaflet-right" style={{ top: "60px" }}>
      <div className="leaflet-control leaflet-bar" style={{ border: "none" }}>
        <button
          onClick={handleClick}
          title={simulated ? "Demo: San Ramón · Presiona para buscar GPS real" : "Mi ubicación"}
          className="w-9 h-9 flex items-center justify-center rounded-xl border transition-all shadow-lg"
          style={{
            display: "flex",
            background: "#0f1219",
            borderColor: simulated ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.15)",
          }}
        >
          {geo.loading
            ? <Loader2 className="w-4 h-4 animate-spin text-primary" style={{ color: "#3b82f6" }} />
            : <Locate className="w-4 h-4" style={{ color: geo.position ? "#22c55e" : simulated ? "#f59e0b" : "#6b7280" }} />
          }
        </button>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export function LeafletMap({ reports, showHeatmap = false, className = "" }: LeafletMapProps) {
  // Start at San Ramón for the tester — amber dot shows it's simulated GPS
  const [userPos,    setUserPos]    = useState<{ lat: number; lng: number } | null>(DISTRICT.center);
  const [simulated,  setSimulated]  = useState(true);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={[DISTRICT.center.lat, DISTRICT.center.lng]}
        zoom={DISTRICT.zoom}
        zoomControl={false}
        style={{ width: "100%", height: "100%", background: "#0d1117" }}
        className="leaflet-dark"
      >
        {/* OSM tiles — reliable in all environments */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Dark filter applied only to the tile pane (doesn't affect markers) */}
        <DarkTileFilter />

        {/* Zoom controls */}
        <ZoomControl position="topleft" />

        {/* GPS locate button */}
        <LocateControl
          simulated={simulated}
          onLocate={(lat, lng, sim) => {
            setUserPos({ lat, lng });
            setSimulated(sim ?? false);
          }}
        />

        {/* Landmarks of San Ramón */}
        <LandmarkMarkers />

        {/* User location marker */}
        <UserMarker position={userPos} simulated={simulated} />

        {/* Heatmap overlay */}
        {showHeatmap && <HeatCanvas reports={reports} />}

        {/* Incident markers */}
        {!showHeatmap && reports.map(r => {
          const color    = CAT_HEX[r.category] ?? "#6b7280";
          const config   = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
          const isActive = r.status === "active";
          const isCrit   = r.urgency === "critical";

          return (
            <CircleMarker
              key={r.id}
              center={[r.latitude, r.longitude]}
              radius={isCrit ? 10 : isActive ? 8 : 6}
              pathOptions={{
                fillColor: color, fillOpacity: 0.88,
                color: isCrit ? "#fff" : "rgba(0,0,0,0.3)",
                weight: isCrit ? 1.5 : 1,
              }}
            >
              <Popup closeButton={false} className="radar-popup">
                <div style={{
                  background: "#0f1219",
                  border: `1px solid ${color}44`,
                  borderRadius: "10px",
                  padding: "10px 12px",
                  minWidth: "180px",
                  fontFamily: "system-ui, sans-serif",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "#fff" }}>{r.title}</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${color}22`, paddingTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>📍 {r.address || r.sector}</span>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                      🕐 {formatDistanceToNow(new Date(r.createdAt), { locale: es, addSuffix: true })}
                    </span>
                    <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "100px", background: `${color}22`, color }}>
                        {config?.label ?? r.category}
                      </span>
                      <span style={{
                        fontSize: "10px", padding: "2px 6px", borderRadius: "100px",
                        background: r.status === "active" ? "#ef444422" : r.status === "resolved" ? "#22c55e22" : "#f59e0b22",
                        color: r.status === "active" ? "#f87171" : r.status === "resolved" ? "#4ade80" : "#fbbf24",
                      }}>
                        {r.status === "active" ? "Activo" : r.status === "resolved" ? "Resuelto" : "En revisión"}
                      </span>
                    </div>
                    {r.confirmedCount > 0 && (
                      <span style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>
                        ✓ {r.confirmedCount} confirmaciones
                      </span>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Simulated GPS badge */}
      {simulated && (
        <div
          className="absolute bottom-3 right-3 z-[500] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl backdrop-blur-md border"
          style={{ background: "rgba(10,14,23,0.85)", borderColor: "rgba(245,158,11,0.3)" }}
        >
          <MapPin className="w-3 h-3" style={{ color: "#f59e0b" }} />
          <span style={{ fontSize: "10px", color: "#f59e0b", fontWeight: 600 }}>Demo · San Ramón Centro</span>
        </div>
      )}
    </div>
  );
}
