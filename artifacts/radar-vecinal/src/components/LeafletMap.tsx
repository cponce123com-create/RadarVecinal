import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report, ReportCategory } from "@workspace/api-client-react";
import { CAT_HEX, DISTRICT, CATEGORY_CONFIG } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Locate, Loader2, MapPin, Plus, Minus } from "lucide-react";
import { useGeolocation } from "@/lib/useGeolocation";

// ── Categories shown in the insecurity heatmap ────────────────────────────────
const HEAT_CATEGORIES = new Set<ReportCategory>([
  ReportCategory.robbery,
  ReportCategory.fight,
]);

// ── SVG icons per category ───────────────────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  robbery:           "🔪",
  fight:             "👊",
  suspicious:        "👁️",
  water_cut:         "💧",
  garbage:           "🗑️",
  informal_commerce: "🛒",
  noise:             "🔊",
  missing_person:    "🔍",
  fire:              "🔥",
  medical_emergency: "🚑",
  prostitution:      "🏠",
  drug_point:        "💊",
  bar_trouble:       "🍺",
  other:             "⚠️",
};

function makeCategoryIcon(category: string, urgency: string): L.DivIcon {
  const color = CAT_HEX[category] ?? "#6b7280";
  const emoji = CATEGORY_EMOJI[category] ?? "⚠️";
  const isCrit = urgency === "critical";
  const size = isCrit ? 36 : 30;
  const pulse = isCrit ? `
    <span style="
      position:absolute;inset:-4px;border-radius:50%;
      border:2px solid ${color};opacity:0.5;
      animation:pulse 1.5s ease-out infinite;
    "></span>` : "";

  return L.divIcon({
    className: "",
    iconSize:  [size, size] as [number, number],
    iconAnchor:[size / 2, size / 2] as [number, number],
    popupAnchor:[0, -(size / 2)] as [number, number],
    html: `
      <div style="
        position:relative;
        width:${size}px;height:${size}px;
        display:flex;align-items:center;justify-content:center;
        border-radius:50%;
        background:${color}22;
        border:2px solid ${color}88;
        font-size:${isCrit ? 16 : 13}px;
        box-shadow:0 0 ${isCrit ? 14 : 8}px ${color}66;
        cursor:pointer;
      ">
        ${pulse}
        <span style="position:relative;z-index:1;line-height:1;">${emoji}</span>
      </div>
    `,
  });
}

// ── Radar overlay on top of real map ─────────────────────────────────────────
function RadarOverlay({ reports }: { reports: Report[] }) {
  const map = useMap();
  const sweepRef   = useRef(0);
  const animRef    = useRef<number>(0);
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

      // Vignette — B-11: keep opacity low so OSM tile names remain readable
      const vignette = ctx.createRadialGradient(cx, cy, innerR * 0.3, cx, cy, maxR);
      vignette.addColorStop(0, "rgba(4,8,22,0.05)");
      vignette.addColorStop(0.6, "rgba(4,8,22,0.18)");
      vignette.addColorStop(1,   "rgba(4,8,22,0.55)");
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
        const km = ((r / innerR) * 3).toFixed(1);
        ctx.fillStyle = "rgba(0,210,80,0.3)";
        ctx.font = "8px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${km}km`, cx + r + 4, cy + 4);
      }

      // Crosshair
      ctx.strokeStyle = "rgba(0,210,80,0.08)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(0, cy);   ctx.lineTo(width, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, 0);   ctx.lineTo(cx, height); ctx.stroke();
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

      // Sweep
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

      // Leading edge
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * maxR, cy + Math.sin(sweep) * maxR);
      ctx.strokeStyle = "rgba(0,255,100,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Blips — use category emoji overlaid on canvas dot
      reportsRef.current.forEach(r => {
        try {
          const pt   = map.latLngToContainerPoint([r.latitude, r.longitude]);
          const col  = CAT_HEX[r.category] ?? "#6b7280";
          const crit = r.urgency === "critical";
          const rad  = crit ? 18 : 12;

          const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rad);
          glow.addColorStop(0,   col + "cc");
          glow.addColorStop(0.4, col + "66");
          glow.addColorStop(1,   "transparent");
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, crit ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Category emoji on blip
          ctx.font = `${crit ? 11 : 9}px serif`;
          ctx.textAlign = "center";
          ctx.fillText(CATEGORY_EMOJI[r.category] ?? "⚠️", pt.x, pt.y - (crit ? 10 : 8));
          ctx.textAlign = "left";
        } catch { /* off-map */ }
      });

      // Label
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

// ── Smoke heatmap — only insecurity events (robbery / fight) ─────────────────
function SmokeHeatCanvas({ reports }: { reports: Report[] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const heatOnly = reports.filter(r => HEAT_CATEGORIES.has(r.category as ReportCategory));

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

      const now = Date.now();
      const SIX_MONTHS = 180 * 24 * 3600000;

      heatOnly.forEach(r => {
        try {
          const pt  = map.latLngToContainerPoint([r.latitude, r.longitude]);
          const age = now - new Date(r.createdAt).getTime();
          const ageFactor  = Math.max(0, 1 - age / SIX_MONTHS);
          const urgWeight: Record<string, number> = { critical: 1, high: 0.75, medium: 0.5, low: 0.3 };
          const w   = (urgWeight[r.urgency] ?? 0.4) * ageFactor;
          if (w < 0.02) return;

          const rad = 90 * w + 40;
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
  }, [map, heatOnly]);

  return null;
}

// ── Category marker layer ─────────────────────────────────────────────────────
function CategoryMarkers({ reports, isAdmin, onContextMenu }: {
  reports: Report[];
  isAdmin?: boolean;
  onContextMenu?: (report: Report, pos: { x: number; y: number }) => void;
}) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    reports.forEach(r => {
      const icon = makeCategoryIcon(r.category, r.urgency);
      const catConfig = CATEGORY_CONFIG[r.category as ReportCategory];
      const color = CAT_HEX[r.category] ?? "#6b7280";
      const emoji = CATEGORY_EMOJI[r.category] ?? "⚠️";
      const timeAgo = formatDistanceToNow(new Date(r.createdAt), { locale: es, addSuffix: true });

      const marker = L.marker([r.latitude, r.longitude], { icon }).addTo(map);

      // ── Admin: clic derecho abre menú contextual ──
      if (isAdmin && r.status !== "resolved" && r.status !== "archived") {
        marker.on("contextmenu", (e: L.LeafletMouseEvent) => {
          const container = map.getContainer();
          const rect = container.getBoundingClientRect();
          onContextMenu?.(r, {
            x: rect.left + e.containerPoint.x,
            y: rect.top + e.containerPoint.y,
          });
        });
      }

      const popupHtml = `
        <div style="
          background:#0f1219;border:1px solid ${color}44;
          border-radius:10px;padding:10px 12px;min-width:190px;
          font-family:system-ui,sans-serif;
        ">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="font-size:16px;">${emoji}</span>
            <span style="font-weight:700;font-size:13px;color:#fff;">${r.title}</span>
          </div>
          <div style="border-top:1px solid ${color}22;padding-top:6px;display:flex;flex-direction:column;gap:3px;">
            <span style="font-size:11px;color:#9ca3af;">📍 ${r.address || r.sector}</span>
            <span style="font-size:11px;color:#9ca3af;">🕐 ${timeAgo}</span>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
              <span style="font-size:10px;padding:2px 7px;border-radius:100px;background:${color}22;color:${color};">
                ${catConfig?.label ?? r.category}
              </span>
              <span style="font-size:10px;padding:2px 7px;border-radius:100px;
                background:${r.status === "active" ? "#ef444422" : "#22c55e22"};
                color:${r.status === "active" ? "#f87171" : "#4ade80"};">
                ${r.status === "active" ? "Activo" : r.status === "resolved" ? "Resuelto" : "En revisión"}
              </span>
            </div>
            ${r.confirmedCount > 0 ? `<span style="font-size:10px;color:#6b7280;margin-top:2px;">✓ ${r.confirmedCount} confirmaciones</span>` : ""}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { closeButton: false, className: "radar-popup", maxWidth: 250 });
      markersRef.current.push(marker);
    });

    return () => { markersRef.current.forEach(m => m.remove()); markersRef.current = []; };
  }, [map, reports, isAdmin, onContextMenu]);

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

// ── F-10: Custom map controls (locate + zoom) — all grouped top-right ─────────
function MapControls({ geo, onLocate, simulated }: {
  geo: ReturnType<typeof useGeolocation>;
  onLocate: (lat: number, lng: number, sim: boolean) => void;
  simulated: boolean;
}) {
  const map = useMap();

  const handleLocate = () => {
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

  const locateBorder = simulated ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.15)";
  const locateIcon   = geo.position ? "#22c55e" : simulated ? "#f59e0b" : "#6b7280";

  const btnBase: React.CSSProperties = {
    width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
    background: "#0d1117", border: "1.5px solid rgba(255,255,255,0.12)",
    cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
    color: "#e2e8f0", fontSize: 18, fontWeight: 700, lineHeight: 1,
    transition: "background 0.15s",
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ top: "10px" }}>
      <div className="leaflet-control" style={{ border: "none", margin: "10px 10px 0 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Zoom in */}
          <button
            onClick={() => map.zoomIn()}
            title="Acercar"
            aria-label="Acercar mapa"
            style={{ ...btnBase, borderRadius: "10px 10px 4px 4px" }}
          >
            <Plus style={{ width: 16, height: 16 }} />
          </button>
          {/* Zoom out */}
          <button
            onClick={() => map.zoomOut()}
            title="Alejar"
            aria-label="Alejar mapa"
            style={{ ...btnBase, borderRadius: "4px 4px 10px 10px" }}
          >
            <Minus style={{ width: 16, height: 16 }} />
          </button>
          {/* Locate */}
          <button
            onClick={handleLocate}
            title="Mi ubicación"
            aria-label="Centrar en mi ubicación"
            style={{ ...btnBase, marginTop: 4, borderRadius: 10, border: `1.5px solid ${locateBorder}` }}
          >
            {geo.loading
              ? <Loader2 style={{ width: 15, height: 15, color: "#3b82f6" }} className="animate-spin" />
              : <Locate  style={{ width: 15, height: 15, color: locateIcon }} />
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Public types ──────────────────────────────────────────────────────────────
export type MapMode = "map" | "radar" | "heat";

interface LeafletMapProps {
  reports: Report[];
  heatReports?: Report[];
  mode?: MapMode;
  className?: string;
  isAdmin?: boolean;
  onContextMenu?: (report: Report, pos: { x: number; y: number }) => void;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function LeafletMap({
  reports,
  heatReports,
  mode = "map",
  className = "",
  isAdmin = false,
  onContextMenu,
}: LeafletMapProps) {
  const geo = useGeolocation();
  const [userPos,   setUserPos]   = useState<{ lat: number; lng: number } | null>(null);
  const [simulated, setSimulated] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Auto-solicitar ubicación real al montar el mapa
  useEffect(() => {
    console.log("[GPS] LeafletMap montado, estado inicial:", { supported: geo.supported, loading: geo.loading, hasPosition: !!geo.position, error: geo.error });
    if (!geo.position && !geo.loading && !geo.error && !gpsError) {
      console.log("[GPS] Solicitando ubicación vía hook...");
      geo.request();
    }
  }, []);

  // Cuando geo.position cambia (vía watchPosition/getCurrentPosition del hook)
  useEffect(() => {
    if (geo.position) {
      console.log("[GPS] Posición recibida del hook:", geo.position.lat, geo.position.lng);
      setUserPos(geo.position);
      setSimulated(false);
      setGpsError(null);
    } else if (geo.error) {
      console.log("[GPS] Error del hook:", geo.error);
      setGpsError(geo.error);
    }
  }, [geo.position, geo.error]);

  // Doble fallback: llamar DIRECTAMENTE a navigator.geolocation si el hook no responde
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      console.log("[GPS] navigator.geolocation NO disponible");
      return;
    }
    const timeout = setTimeout(() => {
      console.log("[GPS] Fallback: intentando getCurrentPosition directo... userPos=", !!userPos, "simulated=", simulated);
      if (!userPos && simulated) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            console.log("[GPS] Fallback ÉXITO:", pos.coords.latitude, pos.coords.longitude);
            const posObj = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
            setUserPos(posObj);
            setSimulated(false);
            setGpsError(null);
          },
          err => {
            console.log("[GPS] Fallback ERROR:", err.code, err.message);
            setGpsError(
              err.code === 1 ? "⚠️ Permiso denegado. Activa ubicación en ajustes del navegador." :
              err.code === 2 ? "⚠️ GPS no disponible." :
              "⚠️ Tiempo agotado."
            );
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }
        );
      }
    }, 3000); // Esperar 3s por si el hook responde primero

    return () => clearTimeout(timeout);
  }, []);

  const heatData = heatReports ?? reports;

  const displayPos = userPos ?? DISTRICT.center;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={[DISTRICT.center.lat, DISTRICT.center.lng]}
        zoom={DISTRICT.zoom}
        zoomControl={false}
        style={{ width: "100%", height: "100%", background: "#0d1117" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />

        {/* F-10: Custom zoom + locate controls grouped at top-right */}
        <MapControls
          geo={geo}
          simulated={simulated}
          onLocate={(lat, lng, sim) => { setUserPos({ lat, lng }); setSimulated(sim); }}
        />

        <UserMarker position={displayPos} simulated={simulated} />

        {/* ── MAP mode: category-icon markers ── */}
        {mode === "map" && <CategoryMarkers reports={reports} />}

        {/* ── RADAR mode: animated overlay ── */}
        {mode === "radar" && <RadarOverlay reports={reports} />}

        {/* ── HEAT mode: robbery/fight smoke heatmap ── */}
        {mode === "heat" && <SmokeHeatCanvas reports={heatData} />}
      </MapContainer>

      {/* GPS status badge */}
      {simulated && !gpsError && (
        <div style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 500,
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 10,
          background: "rgba(10,14,23,0.85)", border: "1px solid rgba(245,158,11,0.3)",
          backdropFilter: "blur(8px)",
        }}>
          <MapPin style={{ width: 12, height: 12, color: "#f59e0b" }} />
          <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>📍 Buscando GPS... toca el botón 📍</span>
        </div>
      )}

      {/* GPS error badge */}
      {gpsError && (
        <div style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 500,
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 10,
          background: "rgba(10,14,23,0.85)", border: "1px solid rgba(245,158,11,0.3)",
          backdropFilter: "blur(8px)", maxWidth: 200,
        }}>
          <MapPin style={{ width: 12, height: 12, color: "#f59e0b", flexShrink: 0 }} />
          <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 500 }}>{gpsError}</span>
        </div>
      )}
    </div>
  );
}
