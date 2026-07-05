import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Maximize2, MapPin, ThumbsUp, Clock, ShieldAlert } from "lucide-react";
import {
  MapContainer, TileLayer, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report, ReportCategory } from "@workspace/api-client-react";
import { useDistrict } from "@/contexts/DistrictContext";
import { CATEGORY_CONFIG, CAT_HEX } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ── Constants ────────────────────────────────────────────────────────────────
const RADAR_RADIUS_M = 1000; // 1 km coverage
const MAX_BLIPS = 30;
const URGENCY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

// ── Emoji icons per category (same as LeafletMap) ────────────────────────────
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

// ── Haversine distance ────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Project lat/lng to radar x/y (relative to center) ────────────────────────
function projectBlip(
  reportLat: number, reportLng: number,
  centerLat: number, centerLng: number,
  radiusPx: number,
): { x: number; y: number; distance: number; inRange: boolean } {
  const distKm = haversineKm(centerLat, centerLng, reportLat, reportLng);
  const distM = distKm * 1000;
  const inRange = distM <= RADAR_RADIUS_M;

  // Angle from center to report
  const dLat = ((reportLat - centerLat) * Math.PI) / 180;
  const dLng = ((reportLng - centerLng) * Math.PI) / 180;
  const angle = Math.atan2(dLng, dLat);

  // Distance in px (clamped at radiusPx for out-of-range)
  const ratio = Math.min(distM / RADAR_RADIUS_M, 1);
  const px = inRange ? ratio * radiusPx : radiusPx;

  const x = Math.sin(angle) * px;
  const y = -Math.cos(angle) * px; // y inverted so N is up

  return { x, y, distance: distKm, inRange };
}

// ── Blip popup / sheet detail ─────────────────────────────────────────────────
function BlipDetail({
  report, reportIndex, distance, onConfirm, onClose,
}: {
  report: Report;
  reportIndex: number;
  distance: number;
  onConfirm: (id: string) => void;
  onClose: () => void;
}) {
  const config = CATEGORY_CONFIG[report.category as ReportCategory];
  const color = CAT_HEX[report.category] ?? "#6b7280";
  const Icon = config?.icon ?? ShieldAlert;
  const timeAgo = formatDistanceToNow(new Date(report.createdAt), { locale: es, addSuffix: true });
  const distText = distance < 1
    ? `${Math.round(distance * 1000)} m`
    : `${distance.toFixed(1)} km`;

  return (
    <div className="p-4">
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}22`, boxShadow: `0 0 14px ${color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-white leading-tight">{report.title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {config?.label ?? report.category}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground text-xs"
        >
          ✕
        </button>
      </div>

      {report.description && (
        <p className="text-[12.5px] text-[#c3c9d6] leading-relaxed mb-3 line-clamp-3">
          {report.description}
        </p>
      )}

      <div className="flex flex-col gap-1.5 mb-3 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> {report.address || report.sector}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {timeAgo}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40" /> A {distText} de ti
        </span>
        <span className="text-[10px] text-[#4a5568]">
          Reportado por {report.authorName || "Anónimo"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/mapa?reportId=${report.id}`}>
          <span className="flex-1 text-center px-3 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-semibold cursor-pointer hover:bg-primary/20 transition-colors">
            Ver en mapa completo
          </span>
        </Link>
        <button
          onClick={() => onConfirm(report.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-[12px] font-semibold hover:bg-white/10 transition-colors"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          <span>Yo también lo vi</span>
        </button>
      </div>
    </div>
  );
}

// ── Desktop popup ─────────────────────────────────────────────────────────────
function BlipPopover({
  report, distance, position, onConfirm, onClose,
}: {
  report: Report;
  distance: number;
  position: { x: number; y: number };
  onConfirm: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
      />
      <div
        className="fixed z-[61] w-[300px] bg-[#0f1219] border border-white/10 rounded-2xl shadow-2xl"
        style={{
          left: Math.min(position.x, window.innerWidth - 320),
          top: Math.max(10, Math.min(position.y - 10, window.innerHeight - 400)),
        }}
      >
        <BlipDetail
          report={report}
          reportIndex={0}
          distance={distance}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      </div>
    </>
  );
}

// ── Mobile Bottom Sheet (vaul) ────────────────────────────────────────────────
function BlipSheet({
  report, distance, onConfirm, onClose, open,
}: {
  report: Report | null;
  distance: number;
  onConfirm: (id: string) => void;
  onClose: () => void;
  open: boolean;
}) {
  if (!open || !report) return null;
  return (
    <>
      <div
        className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[61] bg-[#0f1219] border-t border-white/8 rounded-t-2xl max-h-[70vh] overflow-y-auto animate-slide-up">
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1" />
        <BlipDetail
          report={report}
          reportIndex={0}
          distance={distance}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      </div>
    </>
  );
}

// ── Leaflet radar overlay using canvas ────────────────────────────────────────
function RadarCanvasOverlay({
  reports, centerLat, centerLng,
  onBlipClick,
}: {
  reports: Report[];
  centerLat: number;
  centerLng: number;
  onBlipClick: (report: Report, pos: { x: number; y: number }) => void;
}) {
  const map = useMap();
  const sweepRef = useRef(0);
  const animRef = useRef<number>(0);
  const reportsRef = useRef(reports);
  const onBlipClickRef = useRef(onBlipClick);
  const centerRef = useRef({ centerLat, centerLng });

  useEffect(() => { reportsRef.current = reports; }, [reports]);
  useEffect(() => { onBlipClickRef.current = onBlipClick; }, [onBlipClick]);
  useEffect(() => { centerRef.current = { centerLat, centerLng }; }, [centerLat, centerLng]);

  // ── Memoized blip positions ─────────────────────────────────────────────
  const blips = useMemo(() => {
    // Sort by urgency, then recency; limit to MAX_BLIPS
    const sorted = [...reports].sort((a, b) => {
      const ua = URGENCY_ORDER[a.urgency] ?? 99;
      const ub = URGENCY_ORDER[b.urgency] ?? 99;
      if (ua !== ub) return ua - ub;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, MAX_BLIPS);
  }, [reports]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;top:0;left:0;pointer-events:none;z-index:450;";
    map.getContainer().appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    // Store click target boundaries
    let clickTargets: Array<{
      report: Report;
      cx: number;
      cy: number;
      r: number;
    }> = [];

    const draw = () => {
      const container = map.getContainer();
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(cx, cy) * 0.85;
      const { centerLat: clat, centerLng: clng } = centerRef.current;

      // Dark vignette overlay
      const vignette = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      vignette.addColorStop(0, "rgba(7,10,17,0.35)");
      vignette.addColorStop(0.5, "rgba(7,10,17,0.55)");
      vignette.addColorStop(1, "rgba(7,10,17,0.85)");
      ctx.fillStyle = vignette;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();

      // Radar rings
      const RINGS = 4;
      for (let i = 1; i <= RINGS; i++) {
        const r = (maxR / RINGS) * i;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(59,130,246,${0.18 - i * 0.03})`;
        ctx.lineWidth = i === RINGS ? 1.5 : 1;
        ctx.stroke();
      }

      // Crosshair
      ctx.strokeStyle = "rgba(59,130,246,0.08)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cardinal labels
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "rgba(59,130,246,0.55)";
      ctx.textAlign = "center";
      ctx.fillText("N", cx, 22);
      ctx.fillText("S", cx, height - 10);
      ctx.textAlign = "right";
      ctx.fillText("O", 16, cy + 4);
      ctx.textAlign = "left";
      ctx.fillText("E", width - 16, cy + 4);

      // Sweep
      const sweep = sweepRef.current;
      const TAIL = Math.PI / 2.2;
      const STEPS = 28;
      for (let i = 0; i < STEPS; i++) {
        const a0 = sweep - TAIL + (TAIL * i) / STEPS;
        const a1 = sweep - TAIL + (TAIL * (i + 1)) / STEPS;
        const alpha = (i / STEPS) * 0.55;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, a0, a1);
        ctx.closePath();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        g.addColorStop(0, `rgba(59,130,246,${alpha * 0.3})`);
        g.addColorStop(0.55, `rgba(59,130,246,${alpha})`);
        g.addColorStop(1, "rgba(59,130,246,0)");
        ctx.fillStyle = g;
        ctx.fill();
      }

      // Leading edge
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * maxR, cy + Math.sin(sweep) * maxR);
      ctx.strokeStyle = "rgba(59,130,246,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#3d7fff";
      ctx.fill();
      ctx.shadowColor = "#3d7fff";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.shadowBlur = 0;

      // Blips
      clickTargets = [];
      const currentReports = reportsRef.current;

      currentReports.forEach((report) => {
        const proj = projectBlip(
          report.latitude,
          report.longitude,
          clat,
          clng,
          maxR,
        );
        const col = CAT_HEX[report.category] ?? "#6b7280";
        const isCrit = report.urgency === "critical";
        const isHigh = report.urgency === "high";
        const baseR = isCrit ? 7 : isHigh ? 5.5 : 4;

        const px = cx + proj.x;
        const py = cy + proj.y;

        // Glow
        const glowR = baseR * 3;
        const g = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        g.addColorStop(0, proj.inRange ? `${col}cc` : `${col}44`);
        g.addColorStop(0.4, proj.inRange ? `${col}66` : `${col}22`);
        g.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(px, py, glowR, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(px, py, baseR, 0, Math.PI * 2);
        ctx.fillStyle = proj.inRange ? col : `${col}66`;
        ctx.fill();
        ctx.strokeStyle = proj.inRange
          ? "rgba(255,255,255,0.85)"
          : "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Emoji on blip
        ctx.font = `${isCrit ? 11 : 9}px serif`;
        ctx.textAlign = "center";
        ctx.fillText(
          CATEGORY_EMOJI[report.category] ?? "⚠️",
          px,
          py - baseR - 4,
        );
        ctx.textAlign = "left";

        // Store click target
        clickTargets.push({
          report,
          cx: px,
          cy: py,
          r: baseR + 6,
        });
      });

      // Labels
      ctx.fillStyle = "rgba(59,130,246,0.2)";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `RADAR_SYS · ${clat.toFixed(4)}°S, ${Math.abs(clng).toFixed(4)}°O`,
        cx,
        height - 12,
      );
      ctx.textAlign = "left";

      sweepRef.current = (sweep + 0.024) % (Math.PI * 2);
      animRef.current = requestAnimationFrame(draw);
    };

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const target of clickTargets) {
        const dx = mx - target.cx;
        const dy = my - target.cy;
        if (dx * dx + dy * dy <= target.r * target.r) {
          onBlipClickRef.current(target.report, {
            x: e.clientX,
            y: e.clientY,
          });
          return;
        }
      }
    };

    canvas.addEventListener("click", handleCanvasClick);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current!);
      canvas.removeEventListener("click", handleCanvasClick);
      canvas.remove();
    };
  }, [map]);

  return null;
}

// ── Main RadarHero Component ──────────────────────────────────────────────────
interface RadarHeroProps {
  reports: Report[];
  userPosition: { lat: number; lng: number } | null;
  districtInfo: { centerLat?: number | null; centerLng?: number | null; name: string } | null;
  onViewOnMap?: () => void;
}

export default function RadarHero({
  reports,
  userPosition,
  districtInfo,
  onViewOnMap,
}: RadarHeroProps) {
  const [selectedBlip, setSelectedBlip] = useState<{
    report: Report;
    pos: { x: number; y: number };
  } | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const isDesktop = useMemo(
    () => typeof window !== "undefined" && window.innerWidth >= 768,
    [],
  );

  const center = userPosition ?? {
    lat: districtInfo?.centerLat ?? -11.1282,
    lng: districtInfo?.centerLng ?? -75.3554,
  };
  const hasGps = !!userPosition;
  const districtName = districtInfo?.name ?? "San Ramón";

  const handleBlipClick = useCallback(
    (report: Report, pos: { x: number; y: number }) => {
      setSelectedBlip({ report, pos });
    },
    [],
  );

  const handleConfirm = useCallback(async (id: string) => {
    if (confirmedIds.has(id) || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/reports/${id}/confirm`, { method: "POST" });
      if (res.ok) {
        setConfirmedIds((prev) => new Set(prev).add(id));
      }
    } catch {
      // silent
    } finally {
      setConfirming(false);
    }
  }, [confirmedIds, confirming]);

  const handleCloseBlip = useCallback(() => {
    setSelectedBlip(null);
  }, []);

  // Calculate distance for selected blip
  const selectedDistance = selectedBlip
    ? haversineKm(
        center.lat,
        center.lng,
        selectedBlip.report.latitude,
        selectedBlip.report.longitude,
      )
    : 0;

  return (
    <div className="relative rounded-[20px] overflow-hidden border border-white/7 bg-[radial-gradient(circle_at_50%_50%,#0b1420,#070a11)] shadow-[0_24px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] min-h-[420px]">
      {/* Radar label */}
      <div className="absolute top-4 left-[18px] z-[10]">
        <div className="label-mono text-[10px] text-[#3d7fff] tracking-[0.14em]">
          RADAR_SYS · {districtName.toUpperCase()}
        </div>
        <div className="label-mono text-[9px] text-[#4a5568] tracking-[0.1em] mt-0.5">
          LAT {center.lat.toFixed(4)} · LON {center.lng.toFixed(4)}
        </div>
      </div>

      {/* Blips counter */}
      <div className="absolute top-4 right-4 z-[10] flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-primary/12 border border-primary/28">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3d7fff] status-blink" />
        <span className="label-mono text-[10px] text-[#5b8dff] tracking-normal">
          {reports.length} BLIPS
        </span>
      </div>

      {/* GPS accuracy badge */}
      {!hasGps && (
        <div className="absolute top-14 right-4 z-[10] flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-amber-500/10 border border-amber-500/20">
          <MapPin className="w-3 h-3 text-amber-400" />
          <span className="label-mono text-[9px] text-amber-400/80">
            Ubicación aproximada — activa el GPS para precisión
          </span>
        </div>
      )}

      {/* Leaflet map as base layer */}
      <div className="absolute inset-0">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={15}
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom={false}
          keyboard={false}
          style={{ width: "100%", height: "100%", background: "#070a11" }}
          attributionControl={false}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <RadarCanvasOverlay
            reports={reports}
            centerLat={center.lat}
            centerLng={center.lng}
            onBlipClick={handleBlipClick}
          />
        </MapContainer>
      </div>

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#070a11]/90 to-transparent pointer-events-none z-[5]" />

      {/* Bottom button */}
      <Link href="/mapa">
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-[18px] py-[9px] rounded-full bg-white/7 backdrop-blur-md border border-white/14 text-white text-[12.5px] font-medium cursor-pointer z-[10] hover:bg-white/12 transition-colors"
          onClick={onViewOnMap}
        >
          <Maximize2 className="w-3.5 h-3.5 text-[#3d7fff]" /> Abrir mapa
          completo
        </div>
      </Link>

      {/* Desktop popover for blip */}
      {isDesktop && selectedBlip && (
        <BlipPopover
          report={selectedBlip.report}
          distance={selectedDistance}
          position={selectedBlip.pos}
          onConfirm={handleConfirm}
          onClose={handleCloseBlip}
        />
      )}

      {/* Mobile sheet for blip */}
      {!isDesktop && (
        <BlipSheet
          report={selectedBlip?.report ?? null}
          distance={selectedDistance}
          onConfirm={handleConfirm}
          onClose={handleCloseBlip}
          open={!!selectedBlip}
        />
      )}
    </div>
  );
}
