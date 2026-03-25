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

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type MapMode = "map" | "radar" | "heat";

interface LeafletMapProps {
  reports: Report[];
  heatReports?: Report[];
  mode?: MapMode;
  className?: string;
}

// ── Radar overlay on top of real map ─────────────────────────────────────────
function RadarOverlay({ reports }: { reports: Report[] }) {
  const map = useMap();
  const sweepRef   = useRef(0);
  const animRef    = useRef<number>();
  const reportsRef = useRef(reports);

  useEffect(() => { reportsRef.current = reports; }, [reports]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:450;";
    map.getContainer().appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    const draw = () => {
      const container = map.getContainer();
      const { width, height } = container.getBoundingClientRect();
      canvas.width  = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.sqrt(cx * cx + cy * cy) * 1.1;
      const innerR = Math.min(cx, cy) * 0.9;

      // Dark translucent vignette — keeps map visible in center, darkens edges
      const vignette = ctx.createRadialGradient(cx, cy, innerR * 0.3, cx, cy, maxR);
      vignette.addColorStop(0, "rgba(4,8,22,0.18)");
      vignette.addColorStop(0.6, "rgba(4,8,22,0.4)");
      vignette.addColorStop(1,   "rgba(4,8,22,0.75)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      // Radar rings
      const RINGS = 4;
      for (let i = 1; i <= RINGS; i++) {
        const r = (innerR / RINGS) * i;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,210,80,${0.18 - i * 0.03})`;
        ctx.lineWidth = i === RINGS ? 1.5 : 1;
        ctx.stroke();

        // Distance label at 3 o'clock
        const km = ((r / innerR) * 3).toFixed(1);
        ctx.fillStyle = "rgba(0,210,80,0.3)";
        ctx.font = "8px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${km}km`, cx + r + 4, cy + 4);
      }

      // Crosshair lines (dashed)
      ctx.strokeStyle = "rgba(0,210,80,0.08)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(0, cy);    ctx.lineTo(width, cy);  ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, 0);    ctx.lineTo(cx, height); ctx.stroke();
      ctx.setLineDash([]);

      // Cardinal labels
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "rgba(0,220,80,0.55)";
      ctx.textAlign = "center";
      ctx.fillText("N", cx, 22);
      ctx.fillText("S", cx, height - 10);
      ctx.fillText("E", width - 16, cy + 4);
      ctx.textAlign = "right";
      ctx.fillText("O", 16, cy + 4);
      ctx.textAlign = "left";

      // Sweep — trailing sector with glow
      const sweep = sweepRef.current;
      const TAIL  = Math.PI / 2.2;
      const STEPS = 28;
      for (let i = 0; i < STEPS; i++) {
        const a0    = sweep - TAIL + (TAIL * i / STEPS);
        const a1    = sweep - TAIL + (TAIL * (i + 1) / STEPS);
        const alpha = (i / STEPS) * 0.55;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, a0, a1);
        ctx.closePath();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        g.addColorStop(0,   `rgba(0,230,90,${alpha * 0.5})`);
        g.addColorStop(0.55,`rgba(0,230,90,${alpha})`);
        g.addColorStop(1,   "rgba(0,230,90,0)");
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Leading edge line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * maxR, cy + Math.sin(sweep) * maxR);
      ctx.strokeStyle = "rgba(0,255,100,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Report blips — positioned at real geo coordinates
      reportsRef.current.forEach(r => {
        try {
          const pt   = map.latLngToContainerPoint([r.latitude, r.longitude]);
          const col  = CAT_HEX[r.category] ?? "#6b7280";
          const crit = r.urgency === "critical";
          const rad  = crit ? 18 : 12;

          // Outer glow
          const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
          glow.addColorStop(0,   col + "cc");
          glow.addColorStop(0.4, col + "66");
          glow.addColorStop(1,   "transparent");
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          // Core dot
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, crit ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 1;
          ctx.stroke();
        } catch { /* off-map point */ }
      });

      // System label
      ctx.fillStyle = "rgba(0,200,80,0.2)";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("RADAR_SYS · SAN RAMÓN · CHANCHAMAYO", cx, height - 12);
      ctx.textAlign = "left";

      sweepRef.current = (sweep + 0.024) % (Math.PI * 2);
      animRef.current  = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current!); canvas.remove(); };
  }, [map]);

  return null;
}

// ── Smoke heatmap — 6-month historical view ───────────────────────────────────
function SmokeHeatCanvas({ reports }: { reports: Report[] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    canvasRef.current?.remove();
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:400;filter:blur(8px);";
    map.getContainer().appendChild(canvas);

    const draw = () => {
      const { width, height } = map.getContainer().getBoundingClientRect();
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Age-based weight: older = less intense
      const now = Date.now();
      const SIX_MONTHS = 180 * 24 * 3600000;

      reports.forEach(r => {
        try {
          const pt  = map.latLngToContainerPoint([r.latitude, r.longitude]);
          const age = now - new Date(r.createdAt).getTime();
          const ageFactor  = Math.max(0, 1 - age / SIX_MONTHS);
          const urgWeight: Record<string, number> = { critical: 1, high: 0.75, medium: 0.5, low: 0.3 };
          const w   = (urgWeight[r.urgency] ?? 0.4) * ageFactor;
          if (w < 0.02) return;

          const rad = 90 * w + 40;

          // Multiple smoke blobs per point for diffuse effect — deterministic jitter
          const seed = r.id.charCodeAt(0) + r.id.charCodeAt(r.id.length - 1);
          for (let i = 0; i < 3; i++) {
            const angle = (seed * (i + 1) * 137.5) % 360 * (Math.PI / 180);
            const dist  = (seed % 40) * 0.6;
            const jx  = Math.cos(angle) * dist;
            const jy  = Math.sin(angle) * dist;
            const g   = ctx.createRadialGradient(
              pt.x + jx, pt.y + jy, 0,
              pt.x + jx, pt.y + jy, rad * (0.7 + i * 0.15)
            );
            const a = w * 0.22 / (i + 1);
            g.addColorStop(0,   `rgba(239,68,68,${a * 1.5})`);
            g.addColorStop(0.3, `rgba(234,179,8,${a})`);
            g.addColorStop(0.7, `rgba(249,115,22,${a * 0.4})`);
            g.addColorStop(1,   "rgba(239,68,68,0)");
            ctx.beginPath();
            ctx.arc(pt.x + jx, pt.y + jy, rad * (0.7 + i * 0.15), 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }
        } catch { /* off-map */ }
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
  const dotRef  = useRef<L.CircleMarker | null>(null);
  const ringRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    dotRef.current?.remove(); ringRef.current?.remove();
    if (!position) return;
    const color = simulated ? "#f59e0b" : "#3b82f6";
    const ring = L.circleMarker([position.lat, position.lng], {
      radius: 18, fillColor: color, fillOpacity: 0.1, color, weight: 1, opacity: 0.35,
    }).addTo(map);
    const dot = L.circleMarker([position.lat, position.lng], {
      radius: 7, fillColor: color, fillOpacity: 1, color: "#fff", weight: 2,
    }).addTo(map).bindTooltip(simulated ? "📍 Demo: San Ramón" : "📍 Tu ubicación", { direction: "top" });
    dotRef.current  = dot;
    ringRef.current = ring;
    return () => { dot.remove(); ring.remove(); };
  }, [map, position, simulated]);

  return null;
}

// ── Locate button ─────────────────────────────────────────────────────────────
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
    } else geo.request();
  };

  useEffect(() => {
    if (geo.position) {
      map.flyTo([geo.position.lat, geo.position.lng], 16, { duration: 1.2 });
      onLocate(geo.position.lat, geo.position.lng, false);
    }
  }, [geo.position]);

  const border = simulated ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.15)";
  const icon   = geo.position ? "#22c55e" : simulated ? "#f59e0b" : "#6b7280";

  return (
    <div className="leaflet-top leaflet-right" style={{ top: "10px" }}>
      <div className="leaflet-control" style={{ border: "none", margin: "10px 10px 0 0" }}>
        <button onClick={handleClick} title="Mi ubicación" style={{
          width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0d1117", border: `1.5px solid ${border}`,
          borderRadius: 10, cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
        }}>
          {geo.loading
            ? <Loader2 style={{ width: 15, height: 15, color: "#3b82f6" }} className="animate-spin" />
            : <Locate  style={{ width: 15, height: 15, color: icon }} />
          }
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function LeafletMap({
  reports,
  heatReports,
  mode = "map",
  className = "",
}: LeafletMapProps) {
  const [userPos,   setUserPos]   = useState<{ lat: number; lng: number } | null>(DISTRICT.center);
  const [simulated, setSimulated] = useState(true);

  const heatData = heatReports ?? reports;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={[DISTRICT.center.lat, DISTRICT.center.lng]}
        zoom={DISTRICT.zoom}
        zoomControl={false}
        style={{ width: "100%", height: "100%", background: "#0d1117" }}
      >
        {/* OSM tiles — free, no API key */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        <ZoomControl position="topleft" />

        <LocateControl
          simulated={simulated}
          onLocate={(lat, lng, sim) => { setUserPos({ lat, lng }); setSimulated(sim); }}
        />

        <UserMarker position={userPos} simulated={simulated} />

        {/* ── MAP mode: incident markers ── */}
        {mode === "map" && reports.map(r => {
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
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
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

        {/* ── RADAR mode: animated overlay on real map ── */}
        {mode === "radar" && <RadarOverlay reports={reports} />}

        {/* ── HEAT mode: smoke heatmap ── */}
        {mode === "heat" && <SmokeHeatCanvas reports={heatData} />}
      </MapContainer>

      {/* Demo GPS badge */}
      {simulated && (
        <div style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 500,
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 10,
          background: "rgba(10,14,23,0.85)", border: "1px solid rgba(245,158,11,0.3)",
          backdropFilter: "blur(8px)",
        }}>
          <MapPin style={{ width: 12, height: 12, color: "#f59e0b" }} />
          <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>Demo · San Ramón Centro</span>
        </div>
      )}
    </div>
  );
}
