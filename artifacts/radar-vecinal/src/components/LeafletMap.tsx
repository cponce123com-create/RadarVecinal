import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report } from "@workspace/api-client-react";
import { CAT_HEX, DISTRICT } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Locate, Loader2, MapPin } from "lucide-react";
import { useGeolocation } from "@/lib/useGeolocation";
import { CATEGORY_CONFIG } from "@/lib/constants";

// Fix Leaflet default icon paths broken in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LeafletMapProps {
  reports: Report[];
  showHeatmap?: boolean;
  className?: string;
}

// ── Heat layer (canvas, no external plugin) ───────────────────────────────────
function HeatCanvas({ reports }: { reports: Report[] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    canvasRef.current?.remove();
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:400;";
    map.getContainer().appendChild(canvas);

    const draw = () => {
      const { width, height } = map.getContainer().getBoundingClientRect();
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const weight: Record<string, number> = { critical: 1, high: 0.7, medium: 0.4, low: 0.2 };
      reports.forEach(r => {
        const pt = map.latLngToContainerPoint([r.latitude, r.longitude]);
        const w  = weight[r.urgency] ?? 0.4;
        const r2 = 60 * w + 20;
        const g  = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r2);
        g.addColorStop(0,   `rgba(239,68,68,${0.55 * w})`);
        g.addColorStop(0.4, `rgba(234,179,8,${0.28 * w})`);
        g.addColorStop(1,   "rgba(239,68,68,0)");
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r2, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });
    };

    draw();
    map.on("move zoom resize", draw);
    return () => { map.off("move zoom resize", draw); canvas.remove(); };
  }, [map, reports]);

  return null;
}

// ── User location marker ──────────────────────────────────────────────────────
function UserMarker({ position, simulated }: { position: { lat: number; lng: number } | null; simulated: boolean }) {
  const map = useMap();
  const dotRef   = useRef<L.CircleMarker | null>(null);
  const ringRef  = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    dotRef.current?.remove();
    ringRef.current?.remove();
    if (!position) return;

    const color = simulated ? "#f59e0b" : "#3b82f6";

    const ring = L.circleMarker([position.lat, position.lng], {
      radius: 18, fillColor: color, fillOpacity: 0.1,
      color, weight: 1, opacity: 0.35,
    }).addTo(map);

    const dot = L.circleMarker([position.lat, position.lng], {
      radius: 7, fillColor: color, fillOpacity: 1,
      color: "#fff", weight: 2,
    }).addTo(map)
      .bindTooltip(simulated ? "📍 Demo: San Ramón" : "📍 Tu ubicación", { direction: "top" });

    dotRef.current  = dot;
    ringRef.current = ring;
    return () => { dot.remove(); ring.remove(); };
  }, [map, position, simulated]);

  return null;
}

// ── Locate me button ──────────────────────────────────────────────────────────
function LocateControl({ onLocate, simulated }: {
  onLocate: (lat: number, lng: number, sim: boolean) => void;
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

  const borderColor = simulated ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.15)";
  const iconColor   = geo.position ? "#22c55e" : simulated ? "#f59e0b" : "#6b7280";

  return (
    <div className="leaflet-top leaflet-right" style={{ top: "10px" }}>
      <div className="leaflet-control" style={{ border: "none", margin: "10px 10px 0 0" }}>
        <button
          onClick={handleClick}
          title="Mi ubicación"
          style={{
            width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#0d1117", border: `1.5px solid ${borderColor}`,
            borderRadius: 10, cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          {geo.loading
            ? <Loader2 style={{ width: 15, height: 15, color: "#3b82f6", animation: "spin 1s linear infinite" }} />
            : <Locate   style={{ width: 15, height: 15, color: iconColor }} />
          }
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function LeafletMap({ reports, showHeatmap = false, className = "" }: LeafletMapProps) {
  const [userPos,   setUserPos]   = useState<{ lat: number; lng: number } | null>(DISTRICT.center);
  const [simulated, setSimulated] = useState(true);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={[DISTRICT.center.lat, DISTRICT.center.lng]}
        zoom={DISTRICT.zoom}
        zoomControl={false}
        style={{ width: "100%", height: "100%", background: "#0d1117" }}
      >
        {/* ── OSM tiles (no auth required) ── */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* Zoom controls */}
        <ZoomControl position="topleft" />

        {/* Locate button */}
        <LocateControl
          simulated={simulated}
          onLocate={(lat, lng, sim) => { setUserPos({ lat, lng }); setSimulated(sim); }}
        />

        {/* User marker */}
        <UserMarker position={userPos} simulated={simulated} />

        {/* Heatmap */}
        {showHeatmap && <HeatCanvas reports={reports} />}

        {/* Incident markers */}
        {!showHeatmap && reports.map(r => {
          const color  = CAT_HEX[r.category] ?? "#6b7280";
          const config = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
          const isCrit = r.urgency === "critical";
          const isAct  = r.status === "active";

          return (
            <CircleMarker
              key={r.id}
              center={[r.latitude, r.longitude]}
              radius={isCrit ? 11 : isAct ? 9 : 7}
              pathOptions={{
                fillColor: color, fillOpacity: 0.9,
                color: isCrit ? "#fff" : "rgba(0,0,0,0.4)",
                weight: isCrit ? 2 : 1,
              }}
            >
              <Popup closeButton={false} className="radar-popup">
                <div style={{
                  background: "#0f1219", border: `1px solid ${color}44`,
                  borderRadius: 10, padding: "10px 12px", minWidth: 180,
                  fontFamily: "system-ui, sans-serif",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{r.title}</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${color}22`, paddingTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>📍 {r.address || r.sector}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      🕐 {formatDistanceToNow(new Date(r.createdAt), { locale: es, addSuffix: true })}
                    </span>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 100, background: `${color}22`, color }}>
                        {config?.label ?? r.category}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "2px 6px", borderRadius: 100,
                        background: r.status === "active" ? "#ef444422" : r.status === "resolved" ? "#22c55e22" : "#f59e0b22",
                        color: r.status === "active" ? "#f87171" : r.status === "resolved" ? "#4ade80" : "#fbbf24",
                      }}>
                        {r.status === "active" ? "Activo" : r.status === "resolved" ? "Resuelto" : "En revisión"}
                      </span>
                    </div>
                    {r.confirmedCount > 0 && (
                      <span style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
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

      {/* Demo GPS badge */}
      {simulated && (
        <div style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 500,
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 10, backdropFilter: "blur(8px)",
          background: "rgba(10,14,23,0.85)", border: "1px solid rgba(245,158,11,0.3)",
        }}>
          <MapPin style={{ width: 12, height: 12, color: "#f59e0b" }} />
          <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>Demo · San Ramón Centro</span>
        </div>
      )}
    </div>
  );
}
