import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report } from "@workspace/api-client-react";
import { CAT_HEX, DISTRICT, URGENCY_CONFIG } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Locate, Thermometer, Map, Loader2 } from "lucide-react";
import { useGeolocation } from "@/lib/useGeolocation";
import { CATEGORY_CONFIG } from "@/lib/constants";

// Fix Leaflet default icon paths broken in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface LeafletMapProps {
  reports: Report[];
  showHeatmap?: boolean;
  className?: string;
}

// ── Heat layer using canvas (no external plugin needed) ──────────────────────
function HeatCanvas({ reports }: { reports: Report[] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!map) return;

    // Remove old heat layer canvas if exists
    if (canvasRef.current) {
      canvasRef.current.remove();
    }

    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "400";

    const container = map.getContainer();
    container.appendChild(canvas);

    const draw = () => {
      const size = container.getBoundingClientRect();
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const urgencyWeight: Record<string, number> = {
        critical: 1.0, high: 0.7, medium: 0.4, low: 0.2,
      };

      reports.forEach(r => {
        const point = map.latLngToContainerPoint([r.latitude, r.longitude]);
        const w = urgencyWeight[r.urgency] ?? 0.4;
        const radius = 50 * w + 20;
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        gradient.addColorStop(0, `rgba(239, 68, 68, ${0.45 * w})`);
        gradient.addColorStop(0.4, `rgba(234, 179, 8, ${0.25 * w})`);
        gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });
    };

    draw();
    map.on("move zoom resize", draw);

    return () => {
      map.off("move zoom resize", draw);
      canvas.remove();
    };
  }, [map, reports]);

  return null;
}

// ── Locate Me button ─────────────────────────────────────────────────────────
function LocateControl({ onLocate }: { onLocate: (lat: number, lng: number) => void }) {
  const map = useMap();
  const geo = useGeolocation();

  const handleClick = () => {
    if (geo.position) {
      map.flyTo([geo.position.lat, geo.position.lng], 16, { duration: 1.2 });
      onLocate(geo.position.lat, geo.position.lng);
    } else {
      geo.request();
    }
  };

  useEffect(() => {
    if (geo.position) {
      map.flyTo([geo.position.lat, geo.position.lng], 16, { duration: 1.2 });
      onLocate(geo.position.lat, geo.position.lng);
    }
  }, [geo.position]);

  return (
    <div className="leaflet-top leaflet-right" style={{ top: "60px" }}>
      <div className="leaflet-control leaflet-bar" style={{ border: "none" }}>
        <button
          onClick={handleClick}
          title="Mi ubicación"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0f1219] border border-white/15 text-white hover:bg-white/10 hover:border-white/25 transition-all shadow-lg"
          style={{ display: "flex" }}
        >
          {geo.loading
            ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
            : <Locate className={`w-4 h-4 ${geo.position ? "text-green-400" : "text-muted-foreground"}`} />
          }
        </button>
      </div>
    </div>
  );
}

// ── User location marker ─────────────────────────────────────────────────────
function UserMarker({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (!position) return;
    const m = L.circleMarker([position.lat, position.lng], {
      radius: 8, fillColor: "#3b82f6", fillOpacity: 1,
      color: "#fff", weight: 2,
    }).addTo(map);
    m.bindTooltip("Tu ubicación", { permanent: false, direction: "top" });
    markerRef.current = m;
    return () => { m.remove(); };
  }, [map, position]);

  return null;
}

// ── Map style dark override ──────────────────────────────────────────────────
const MAP_STYLE: React.CSSProperties = {
  filter: "brightness(0.85) saturate(0.9)",
};

// ── Main export ──────────────────────────────────────────────────────────────
export function LeafletMap({ reports, showHeatmap = false, className = "" }: LeafletMapProps) {
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <div className={`relative w-full h-full ${className}`} style={MAP_STYLE}>
      <MapContainer
        center={[DISTRICT.center.lat, DISTRICT.center.lng]}
        zoom={DISTRICT.zoom}
        zoomControl={false}
        style={{ width: "100%", height: "100%", background: "#0d1117" }}
        className="leaflet-dark"
      >
        {/* Dark CartoDB tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />

        {/* Zoom controls top-left */}
        <ZoomControl position="topleft" />

        {/* Location control top-right */}
        <LocateControl onLocate={(lat, lng) => setUserPos({ lat, lng })} />

        {/* User location marker */}
        <UserMarker position={userPos} />

        {/* Heatmap overlay */}
        {showHeatmap && <HeatCanvas reports={reports} />}

        {/* Incident markers */}
        {!showHeatmap && reports.map(r => {
          const color = CAT_HEX[r.category] ?? "#6b7280";
          const config = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
          const isActive = r.status === "active";
          const isCritical = r.urgency === "critical";

          return (
            <CircleMarker
              key={r.id}
              center={[r.latitude, r.longitude]}
              radius={isCritical ? 10 : isActive ? 8 : 6}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.85,
                color: isCritical ? "#fff" : "rgba(0,0,0,0.3)",
                weight: isCritical ? 1.5 : 1,
              }}
            >
              <Popup
                closeButton={false}
                className="radar-popup"
              >
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
    </div>
  );
}
