import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Maximize2, MapPin, ThumbsUp, Clock, ShieldAlert } from "lucide-react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report, ReportCategory } from "@workspace/api-client-react";
import { CATEGORY_CONFIG, CAT_HEX } from "@/lib/constants";
import { useDistrict } from "@/contexts/DistrictContext";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_BLIPS = 30;
const RADAR_ZOOM = 15;
// Semiejes del óvalo como fracción del contenedor. rx > ry → abarca más a los
// costados (el widget es más ancho que alto).
const ELLIPSE_RX_FRAC = 0.47;
const ELLIPSE_RY_FRAC = 0.43;
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

// ── Blip popup / sheet detail ─────────────────────────────────────────────────
function BlipDetail({
  report, distance, onConfirm, onClose,
}: {
  report: Report;
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
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        className="fixed z-[61] w-[300px] bg-[#0f1219] border border-white/10 rounded-2xl shadow-2xl"
        style={{
          left: Math.min(position.x, window.innerWidth - 320),
          top: Math.max(10, Math.min(position.y - 10, window.innerHeight - 400)),
        }}
      >
        <BlipDetail
          report={report}
          distance={distance}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      </div>
    </>
  );
}

// ── Mobile Bottom Sheet ───────────────────────────────────────────────────────
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
          distance={distance}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      </div>
    </>
  );
}

// ── Recentrar el mapa cuando llega/cambia la posición GPS ─────────────────────
// FIX PRINCIPAL DE EXACTITUD: el prop `center` de MapContainer solo se aplica
// al montar. El GPS llega después (async), así que el mapa se quedaba en el
// centro del distrito mientras el punto del radar se dibujaba en el centro del
// viewport — por eso el radar marcaba una ubicación que no era la tuya.
function RecenterOnGps({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const lastRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const last = lastRef.current;
    if (last) {
      const moved = map.distance([last.lat, last.lng], [lat, lng]);
      if (moved < 20) return; // ignorar jitter del GPS (<20 m)
    }
    lastRef.current = { lat, lng };
    map.flyTo([lat, lng], RADAR_ZOOM, { duration: 1.1 });
  }, [lat, lng, map]);
  return null;
}

// ── Overlay del radar (canvas, forma ovoide, anclado a coordenadas reales) ────
function RadarCanvasOverlay({
  reports, centerLat, centerLng, onBlipClick,
}: {
  reports: Report[];
  centerLat: number;
  centerLng: number;
  onBlipClick: (report: Report, pos: { x: number; y: number }) => void;
}) {
  const map = useMap();
  const sweepRef = useRef(0);
  const animRef = useRef<number>(0);
  const onBlipClickRef = useRef(onBlipClick);
  const centerRef = useRef({ centerLat, centerLng });
  const sortedRef = useRef<Report[]>([]);

  useEffect(() => { onBlipClickRef.current = onBlipClick; }, [onBlipClick]);
  useEffect(() => { centerRef.current = { centerLat, centerLng }; }, [centerLat, centerLng]);

  // Ordenar por urgencia y recencia, limitar a MAX_BLIPS
  const sorted = useMemo(() => {
    const s = [...reports].sort((a, b) => {
      const ua = URGENCY_ORDER[a.urgency] ?? 99;
      const ub = URGENCY_ORDER[b.urgency] ?? 99;
      if (ua !== ub) return ua - ub;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return s.slice(0, MAX_BLIPS);
  }, [reports]);
  useEffect(() => { sortedRef.current = sorted; }, [sorted]);

  useEffect(() => {
    const container = map.getContainer();
    const canvas = document.createElement("canvas");
    // pointer-events:none → los clicks se capturan en el contenedor del mapa,
    // no en el canvas (antes el listener estaba en un canvas que nunca recibía
    // eventos, por eso los blips no abrían nada).
    canvas.style.cssText =
      "position:absolute;top:0;left:0;pointer-events:none;z-index:450;";
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    let clickTargets: Array<{ report: Report; cx: number; cy: number; r: number }> = [];

    // Punto sobre el borde del óvalo en dirección (dx,dy) desde el ancla
    const clampToEllipse = (dx: number, dy: number, rx: number, ry: number) => {
      const v = Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2) || 1;
      return { x: (dx / v) * 0.97, y: (dy / v) * 0.97 };
    };

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);

      const { centerLat: clat, centerLng: clng } = centerRef.current;

      // ── ANCLA GEOGRÁFICA REAL ─────────────────────────────────────────────
      // Todo el radar (óvalo, anillos, barrido, punto central) se dibuja sobre
      // la proyección REAL de la posición GPS en el mapa, no sobre el centro
      // del viewport. Así el punto central siempre está sobre tu calle exacta.
      const anchor = map.latLngToContainerPoint(L.latLng(clat, clng));
      const acx = anchor.x;
      const acy = anchor.y;

      // Semiejes del óvalo (más ancho que alto → cubre más a los costados)
      const rx = width * ELLIPSE_RX_FRAC;
      const ry = height * ELLIPSE_RY_FRAC;

      // ── Máscara ovoide: oscurecer todo, "abrir" el óvalo con gradiente ────
      ctx.fillStyle = "rgba(6,9,15,0.82)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "destination-out";
      ctx.save();
      ctx.translate(acx, acy);
      ctx.scale(rx, ry);
      const hole = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      hole.addColorStop(0, "rgba(0,0,0,0.93)");
      hole.addColorStop(0.7, "rgba(0,0,0,0.82)");
      hole.addColorStop(0.92, "rgba(0,0,0,0.35)");
      hole.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hole;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";

      // Tinte azul sutil dentro del óvalo
      ctx.save();
      ctx.translate(acx, acy);
      ctx.scale(rx, ry);
      const tint = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      tint.addColorStop(0, "rgba(20,40,80,0.10)");
      tint.addColorStop(1, "rgba(59,130,246,0.05)");
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── Anillos elípticos concéntricos ────────────────────────────────────
      const RINGS = 4;
      for (let i = 1; i <= RINGS; i++) {
        const f = i / RINGS;
        ctx.beginPath();
        ctx.ellipse(acx, acy, rx * f, ry * f, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(96,165,250,${i === RINGS ? 0.28 : 0.16 - i * 0.02})`;
        ctx.lineWidth = i === RINGS ? 1.5 : 1;
        ctx.stroke();
      }
      // Borde exterior con leve resplandor
      ctx.beginPath();
      ctx.ellipse(acx, acy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(61,127,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(61,127,255,0.6)";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ── Ejes punteados ────────────────────────────────────────────────────
      ctx.strokeStyle = "rgba(59,130,246,0.10)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(acx - rx, acy);
      ctx.lineTo(acx + rx, acy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(acx, acy - ry);
      ctx.lineTo(acx, acy + ry);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Puntos cardinales pegados al óvalo ────────────────────────────────
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "rgba(96,165,250,0.6)";
      ctx.textAlign = "center";
      ctx.fillText("N", acx, acy - ry - 8);
      ctx.fillText("S", acx, acy + ry + 16);
      ctx.textAlign = "right";
      ctx.fillText("O", acx - rx - 8, acy + 4);
      ctx.textAlign = "left";
      ctx.fillText("E", acx + rx + 8, acy + 4);

      // ── Barrido elíptico ──────────────────────────────────────────────────
      const sweep = sweepRef.current;
      const TAIL = Math.PI / 2.2;
      const STEPS = 28;
      ctx.save();
      ctx.translate(acx, acy);
      ctx.scale(rx, ry);
      for (let i = 0; i < STEPS; i++) {
        const a0 = sweep - TAIL + (TAIL * i) / STEPS;
        const a1 = sweep - TAIL + (TAIL * (i + 1)) / STEPS;
        const alpha = (i / STEPS) * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 1, a0, a1);
        ctx.closePath();
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, `rgba(61,127,255,${alpha * 0.3})`);
        g.addColorStop(0.55, `rgba(61,127,255,${alpha})`);
        g.addColorStop(1, "rgba(61,127,255,0)");
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.restore();

      // Línea de borde del barrido (sin transform para grosor uniforme)
      ctx.beginPath();
      ctx.moveTo(acx, acy);
      ctx.lineTo(acx + Math.cos(sweep) * rx, acy + Math.sin(sweep) * ry);
      ctx.strokeStyle = "rgba(96,165,250,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Punto central (TU posición GPS real) ──────────────────────────────
      ctx.beginPath();
      ctx.arc(acx, acy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(61,127,255,0.35)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(acx, acy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#3d7fff";
      ctx.fill();
      ctx.shadowColor = "#3d7fff";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(acx, acy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.shadowBlur = 0;

      // ── Blips en su posición geográfica EXACTA ────────────────────────────
      // Se proyectan con latLngToContainerPoint (la misma proyección del mapa),
      // así cada blip cae sobre la calle real del incidente. Los que quedan
      // fuera del óvalo se pegan al borde con opacidad reducida.
      clickTargets = [];
      sortedRef.current.forEach((report) => {
        if (report.latitude == null || report.longitude == null) return;
        const p = map.latLngToContainerPoint(
          L.latLng(report.latitude, report.longitude),
        );
        let dx = p.x - acx;
        let dy = p.y - acy;
        const insideVal = (dx / rx) ** 2 + (dy / ry) ** 2;
        const inRange = insideVal <= 1;
        if (!inRange) {
          const c = clampToEllipse(dx, dy, rx, ry);
          dx = c.x * rx;
          dy = c.y * ry;
        }
        const px = acx + dx;
        const py = acy + dy;

        const col = CAT_HEX[report.category] ?? "#6b7280";
        const isCrit = report.urgency === "critical";
        const isHigh = report.urgency === "high";
        const baseR = isCrit ? 7 : isHigh ? 5.5 : 4.5;

        // Halo
        const glowR = baseR * 3;
        const g = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        g.addColorStop(0, inRange ? `${col}cc` : `${col}44`);
        g.addColorStop(0.4, inRange ? `${col}66` : `${col}22`);
        g.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(px, py, glowR, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        // Punto
        ctx.beginPath();
        ctx.arc(px, py, baseR, 0, Math.PI * 2);
        ctx.fillStyle = inRange ? col : `${col}66`;
        ctx.fill();
        ctx.strokeStyle = inRange
          ? "rgba(255,255,255,0.85)"
          : "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Emoji encima del blip (solo dentro del óvalo, para no ensuciar el borde)
        if (inRange) {
          ctx.font = `${isCrit ? 12 : 10}px serif`;
          ctx.textAlign = "center";
          ctx.fillText(
            CATEGORY_EMOJI[report.category] ?? "⚠️",
            px,
            py - baseR - 4,
          );
          ctx.textAlign = "left";
        }

        clickTargets.push({ report, cx: px, cy: py, r: Math.max(baseR + 8, 14) });
      });

      // ── Etiqueta de cobertura real (según escala actual del mapa) ─────────
      const p0 = map.containerPointToLatLng(L.point(acx, acy));
      const p1 = map.containerPointToLatLng(L.point(acx + rx, acy));
      const coverEW = map.distance(p0, p1); // metros del semieje horizontal
      const coverTxt =
        coverEW >= 1000
          ? `${((coverEW * 2) / 1000).toFixed(1)} KM`
          : `${Math.round(coverEW * 2)} M`;
      ctx.fillStyle = "rgba(96,165,250,0.35)";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `COBERTURA ≈ ${coverTxt} E-O · ${clat.toFixed(4)}°, ${clng.toFixed(4)}°`,
        width / 2,
        height - 10,
      );
      ctx.textAlign = "left";

      sweepRef.current = (sweep + 0.022) % (Math.PI * 2);
      animRef.current = requestAnimationFrame(draw);
    };

    // Click y hover sobre el CONTENEDOR del mapa (funciona en touch y mouse)
    const hitTest = (mx: number, my: number) => {
      for (const t of clickTargets) {
        const dx = mx - t.cx;
        const dy = my - t.cy;
        if (dx * dx + dy * dy <= t.r * t.r) return t;
      }
      return null;
    };
    const handleClick = (e: MouseEvent) => {
      const r = container.getBoundingClientRect();
      const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (hit) {
        e.stopPropagation();
        onBlipClickRef.current(hit.report, { x: e.clientX, y: e.clientY });
      }
    };
    const handleMove = (e: MouseEvent) => {
      const r = container.getBoundingClientRect();
      container.style.cursor = hitTest(e.clientX - r.left, e.clientY - r.top)
        ? "pointer"
        : "";
    };

    container.addEventListener("click", handleClick);
    container.addEventListener("mousemove", handleMove);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current!);
      container.removeEventListener("click", handleClick);
      container.removeEventListener("mousemove", handleMove);
      container.style.cursor = "";
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

  // Sin GPS ni distrito aún: centro del distrito activo (única fuente, sin
  // coordenadas hardcodeadas de un distrito en particular)
  const { districtCenter } = useDistrict();
  const center = userPosition ?? {
    lat: districtInfo?.centerLat ?? districtCenter.lat,
    lng: districtInfo?.centerLng ?? districtCenter.lng,
  };
  const hasGps = !!userPosition;
  const districtName = districtInfo?.name ?? "tu distrito";

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
          {hasGps ? " · GPS" : ""}
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
        <div className="absolute top-14 right-4 z-[10] flex items-center gap-1.5 px-2.5 py-[5px] rounded-full bg-amber-500/10 border border-amber-500/20 max-w-[240px]">
          <MapPin className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span className="label-mono text-[9px] text-amber-400/80 leading-tight">
            Ubicación aproximada — activa el GPS para precisión
          </span>
        </div>
      )}

      {/* Leaflet map as base layer */}
      <div className="absolute inset-0">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={RADAR_ZOOM}
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
          {/* FIX: recentrar el mapa cuando llega/cambia el GPS */}
          <RecenterOnGps lat={center.lat} lng={center.lng} />
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
