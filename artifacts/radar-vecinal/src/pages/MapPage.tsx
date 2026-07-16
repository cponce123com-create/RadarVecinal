import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Thermometer, Radar, RotateCcw, Map as MapIcon, ShieldAlert, MapPinned, Radio } from "lucide-react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { LeafletMap, MapMode } from "@/components/LeafletMap";
import PanicAlertsLayer from "@/components/PanicAlertsLayer";
import LiveProvidersLayer from "@/components/LiveProvidersLayer";
import { listLiveProviders } from "@/lib/liveProviders";
import { useQuery } from "@tanstack/react-query";
import ReportContextMenu from "@/components/ReportContextMenu";
import { useGetReports, useGetPanicAlerts, ReportCategory, type Report } from "@workspace/api-client-react";
import { CAT_HEX, CATEGORY_CONFIG, SERVICE_CATEGORIES, SAFETY_CATEGORIES } from "@/lib/constants";
import { useDistrict } from "@/contexts/DistrictContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { subDays, subMonths, isAfter } from "date-fns";

const ALL_CATEGORY_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: ReportCategory.robbery, label: "Robo / Asalto" },
  { id: ReportCategory.fight, label: "Peleas" },
  { id: ReportCategory.suspicious, label: "Sospechosos" },
  { id: ReportCategory.prostitution, label: "Prostíbulos" },
  { id: ReportCategory.drug_point, label: "Drogas" },
  { id: ReportCategory.bar_trouble, label: "Bares" },
  { id: ReportCategory.missing_person, label: "Extraviados" },
  { id: ReportCategory.medical_emergency, label: "Emergencias" },
  { id: ReportCategory.fire, label: "Incendios" },
  { id: ReportCategory.noise, label: "Ruidos" },
  { id: ReportCategory.water_cut, label: "Agua" },
  { id: ReportCategory.garbage, label: "Basura" },
  { id: ReportCategory.informal_commerce, label: "Com. Ilícito" },
  { id: ReportCategory.other, label: "Otros" },
];

const VIEW_MODES: { id: MapMode; label: string; Icon: React.ElementType; sub: string }[] = [
  { id: "map",   label: "Mapa",  Icon: MapIcon,     sub: "ÚLTIMOS 15 DÍAS" },
  { id: "radar", label: "Radar", Icon: Radar,       sub: "ACTIVOS EN VIVO" },
  { id: "heat",  label: "Calor", Icon: Thermometer, sub: "6 MESES · ROBOS Y PELEAS" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

// ── Marcadores simples (puntos de color) para el mapa estático ───────────────
function StaticDots({ reports }: { reports: Report[] }) {
  const map = useMap();
  const layersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => {
    layersRef.current.forEach(m => m.remove());
    layersRef.current = [];
    reports.forEach(r => {
      const color = CAT_HEX[r.category] ?? "#6b7280";
      const dot = L.circleMarker([r.latitude, r.longitude], {
        radius: 5, fillColor: color, fillOpacity: 0.9, color: "#0d1117", weight: 1.5,
        interactive: false,
      }).addTo(map);
      layersRef.current.push(dot);
    });
    return () => { layersRef.current.forEach(m => m.remove()); layersRef.current = []; };
  }, [map, reports]);

  return null;
}

// ── Mapa estático según ubicación (debajo del radar) ─────────────────────────
// Vista fija, sin arrastre ni zoom, centrada en la ubicación real del vecino
// (o en el centro del distrito si el GPS no está disponible).
function StaticMiniMap({ reports }: { reports: Report[] }) {
  const { districtCenter } = useDistrict();
  const [center, setCenter] = useState<{ lat: number; lng: number }>(districtCenter);
  const [located, setLocated] = useState(false);

  // Mientras no haya GPS, seguir al centro del distrito activo (puede
  // resolverse después del primer render)
  useEffect(() => {
    if (!located) setCenter({ lat: districtCenter.lat, lng: districtCenter.lng });
  }, [districtCenter.lat, districtCenter.lng, located]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => { setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocated(true); },
      () => { /* sin GPS: se mantiene el centro del distrito */ },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
    );
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-shrink-0 relative rounded-2xl overflow-hidden border border-white/6 shadow-xl"
      style={{ height: 150 }}
    >
      <MapContainer
        key={`${center.lat.toFixed(4)},${center.lng.toFixed(4)}`}
        center={[center.lat, center.lng]}
        zoom={15}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
        style={{ width: "100%", height: "100%", background: "#0d1117", pointerEvents: "none" }}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <StaticDots reports={reports} />
      </MapContainer>

      {/* Punto del usuario en el centro */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
        <span className="relative flex w-3.5 h-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500 border-2 border-white" />
        </span>
      </div>

      <div className="absolute top-2 left-2 z-[500] flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10"
        style={{ background: "rgba(7,9,15,0.85)" }}>
        <MapPinned className="w-3 h-3 text-primary" />
        <span className="label-mono text-[9px] font-semibold text-white/80">
          {located ? "TU ZONA · VISTA ESTÁTICA" : "CENTRO DEL DISTRITO · VISTA ESTÁTICA"}
        </span>
      </div>
    </motion.div>
  );
}

export default function MapPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("all");
  const [viewMode, setViewMode] = useState<MapMode>("map");
  const [contextReport, setContextReport] = useState<{ id: string; title: string; status: string } | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showLive, setShowLive] = useState(true);

  const { currentDistrictId, currentDistrict } = useDistrict();
  const { user, token } = useAuth();
  const isAdmin = !!user && (user.role === "admin" || user.role === "moderator" || user.role === "super_admin");
  const { data, isLoading, refetch } = useGetReports({ districtId: currentDistrictId ?? undefined });

  // Los reportes archivados (verificados como solucionados por 10 vecinos)
  // desaparecen del mapa, del radar y del mapa de calor.
  const allReports = (data?.reports ?? []).filter(r => r.status !== "archived");

  // Alertas de pánico activas — comparte caché con PanicAlertsLayer (misma
  // query key), así que NO genera una segunda petición al servidor.
  const { data: panicData } = useGetPanicAlerts(
    currentDistrictId ? { districtId: currentDistrictId, active: true } : undefined,
    // Cast necesario: el tipo generado por Orval exige queryKey, pero el hook lo construye internamente
    { query: { refetchInterval: 20000 } as any },
  );
  const activePanicCount = (panicData?.alerts ?? []).filter(a => a.isActive).length;

  // Servicios en vivo del distrito (comparte caché con LiveProvidersLayer).
  const { data: liveProviders } = useQuery({
    queryKey: ["live-providers", currentDistrictId],
    queryFn: () => listLiveProviders(currentDistrictId as number),
    enabled: !!currentDistrictId,
    refetchInterval: 12000,
    staleTime: 8000,
  });
  const liveCount = liveProviders?.length ?? 0;

  const cutoff15d = subDays(new Date(), 15);
  // Modo mapa: últimos 15 días + reportes resueltos pendientes de verificación
  // comunitaria (siguen visibles hasta que 10 vecinos confirmen la solución).
  const last15d = allReports.filter(r => isAfter(new Date(r.createdAt), cutoff15d) || r.status === "resolved");
  const cutoff6m = subMonths(new Date(), 6);
  const last6m = allReports.filter(r => isAfter(new Date(r.createdAt), cutoff6m));
  const radarReports = allReports.filter(r => r.status === "active");

  const applyFilter = (arr: typeof allReports) =>
    activeCategory === "all" ? arr : arr.filter(r => r.category === activeCategory);

  const displayReports = applyFilter(
    viewMode === "map" ? last15d : viewMode === "radar" ? radarReports : last6m
  );
  const heatReports = applyFilter(last6m);
  const currentMode = VIEW_MODES.find(v => v.id === viewMode)!;

  // ── Reportar directamente desde el mapa ──
  const handleSelectPoint = (lat: number, lng: number) => {
    setLocation(`/reportar?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
  };

  // ── Verificación comunitaria: "sí, ya se solucionó" ──
  const handleConfirmResolution = async (reportId: string) => {
    if (confirming) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/confirm-resolution`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: body.archived ? "✓ Solución verificada" : "✓ Confirmación registrada",
          description: body.message ?? "Gracias por confirmar.",
        });
        refetch();
      } else {
        toast({
          title: res.status === 409 ? "Ya confirmaste este reporte" : "No se pudo confirmar",
          description: body.error ?? "Intenta de nuevo.",
          variant: res.status === 409 ? undefined : "destructive",
        });
      }
    } catch {
      toast({ title: "Error de conexión", description: "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100dvh-5rem)] md:h-[calc(100dvh-3rem)] pb-1 rv-in">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[20px] font-bold text-white tracking-tight leading-tight">Mapa de Incidentes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLoading ? "Cargando..." : `${displayReports.length} visibles · ${currentDistrict || "Distrito"}`}
            </p>
          </div>
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-card border border-white/8">
            {VIEW_MODES.map(v => {
              const Icon = v.Icon;
              const active = viewMode === v.id;
              return (
                <button key={v.id} onClick={() => setViewMode(v.id)} title={v.sub}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white"
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Banner de alertas de pánico activas */}
        <AnimatePresence>
          {activePanicCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-destructive/15 border border-destructive/40"
            >
              <span className="relative flex w-2.5 h-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
              </span>
              <ShieldAlert className="w-4 h-4 text-red-300 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-200">
                {activePanicCount === 1
                  ? "1 alerta de pánico activa en el mapa"
                  : `${activePanicCount} alertas de pánico activas en el mapa`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category filter pills with grouping */}
        <div className="flex flex-col gap-1">
          {/* Items de seguridad */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
            {ALL_CATEGORY_FILTERS.filter(f => f.id === "all" || SAFETY_CATEGORIES.includes(f.id)).map(f => {
              const active = activeCategory === f.id;
              const color = f.id !== "all" ? (CAT_HEX[f.id] ?? undefined) : undefined;
              const catConf = f.id !== "all" ? CATEGORY_CONFIG[f.id as ReportCategory] : null;
              const Icon = catConf?.icon;
              return (
                <motion.button key={f.id} whileTap={{ scale: 0.95 }} onClick={() => setActiveCategory(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                    active ? "text-white border-transparent" : "bg-white/[0.04] border-white/8 text-muted-foreground hover:text-white"
                  }`}
                  style={active ? {
                    background: color ? `${color}22` : "hsl(217 100% 55% / 0.2)",
                    borderColor: color ? `${color}55` : "hsl(217 100% 55% / 0.5)",
                    color: color ?? "hsl(217 100% 75%)",
                  } : {}}>
                  {Icon && active && <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />}
                  {!Icon && color && active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />}
                  {f.label}
                </motion.button>
              );
            })}
          </div>

          {/* Separator visual entre seguridad y servicios */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider px-1">
            <span>Servicios Públicos</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Items de servicios públicos */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
            {ALL_CATEGORY_FILTERS.filter(f => SERVICE_CATEGORIES.includes(f.id)).map(f => {
              const active = activeCategory === f.id;
              const color = f.id !== "all" ? (CAT_HEX[f.id] ?? undefined) : undefined;
              const catConf = f.id !== "all" ? CATEGORY_CONFIG[f.id as ReportCategory] : null;
              const Icon = catConf?.icon;
              return (
                <motion.button key={f.id} whileTap={{ scale: 0.95 }} onClick={() => setActiveCategory(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                    active ? "text-white border-transparent" : "bg-white/[0.04] border-white/8 text-muted-foreground hover:text-white"
                  }`}
                  style={active ? {
                    background: color ? `${color}22` : "hsl(217 100% 55% / 0.2)",
                    borderColor: color ? `${color}55` : "hsl(217 100% 55% / 0.5)",
                    color: color ?? "hsl(217 100% 75%)",
                  } : {}}>
                  {Icon && active && <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />}
                  {!Icon && color && active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />}
                  {f.label}
                </motion.button>
              );
            })}
          </div>

          {/* Otras categorías */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
            {ALL_CATEGORY_FILTERS.filter(f => f.id !== "all" && !SAFETY_CATEGORIES.includes(f.id) && !SERVICE_CATEGORIES.includes(f.id)).map(f => {
              const active = activeCategory === f.id;
              const color = f.id !== "all" ? (CAT_HEX[f.id] ?? undefined) : undefined;
              const catConf = f.id !== "all" ? CATEGORY_CONFIG[f.id as ReportCategory] : null;
              const Icon = catConf?.icon;
              return (
                <motion.button key={f.id} whileTap={{ scale: 0.95 }} onClick={() => setActiveCategory(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                    active ? "text-white border-transparent" : "bg-white/[0.04] border-white/8 text-muted-foreground hover:text-white"
                  }`}
                  style={active ? {
                    background: color ? `${color}22` : "hsl(217 100% 55% / 0.2)",
                    borderColor: color ? `${color}55` : "hsl(217 100% 55% / 0.5)",
                    color: color ?? "hsl(217 100% 75%)",
                  } : {}}>
                  {Icon && active && <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />}
                  {!Icon && color && active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />}
                  {f.label}
                </motion.button>
              );
            })}
            {activeCategory !== "all" && (
              <button onClick={() => setActiveCategory("all")}
                className="p-1.5 rounded-full text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/6 shadow-2xl min-h-0">
        {isLoading ? (
          <div className="w-full h-full bg-[#060810] flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Cargando mapa...
            </div>
          </div>
        ) : (
          <LeafletMap reports={displayReports} heatReports={heatReports} mode={viewMode}
            isAdmin={isAdmin}
            onContextMenu={(report, pos) => {
              setContextReport({ id: report.id, title: report.title, status: report.status });
              setContextPos(pos);
            }}
            onSelectPoint={handleSelectPoint}
            onConfirmResolution={handleConfirmResolution}
          >
            {/* Alertas de pánico activas — visibles en los 3 modos del mapa */}
            <PanicAlertsLayer />
            {/* Servicios en vivo (recolector, panadero, vendedores…) */}
            <LiveProvidersLayer enabled={showLive} />
          </LeafletMap>
        )}

        <ReportContextMenu report={contextReport} position={contextPos}
          onClose={() => { setContextReport(null); setContextPos(null); }}
          onResolved={() => { setContextReport(null); setContextPos(null); refetch(); }}
        />

        {/* Mode badge */}
        <div className="absolute top-3 left-3 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-lg"
          style={{
            background: "rgba(7,9,15,0.85)",
            borderColor: viewMode === "radar" ? "rgba(0,200,80,0.35)" : viewMode === "heat" ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.1)",
          }}>
          {viewMode === "map" && <MapIcon className="w-3.5 h-3.5 text-primary" />}
          {viewMode === "radar" && <Radar className="w-3.5 h-3.5" style={{ color: "#00c853" }} />}
          {viewMode === "heat" && <Thermometer className="w-3.5 h-3.5 text-red-400" />}
          <span className="label-mono text-[10px] font-semibold" style={{ color: viewMode === "radar" ? "#00c853" : viewMode === "heat" ? "#f87171" : "#fff" }}>
            {currentMode.sub}
          </span>
          <span className="text-[10px] text-muted-foreground">· {displayReports.length}</span>
        </div>

        {/* Toggle de servicios en vivo */}
        <button
          onClick={() => setShowLive(v => !v)}
          className="absolute top-3 right-3 z-[500] flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-lg transition-all"
          style={{
            background: "rgba(7,9,15,0.88)",
            borderColor: showLive ? "rgba(34,197,94,0.45)" : "rgba(255,255,255,0.1)",
          }}
          title={showLive ? "Ocultar servicios en vivo" : "Mostrar servicios en vivo"}
        >
          {showLive && liveCount > 0 && (
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          )}
          <Radio className="w-3.5 h-3.5" style={{ color: showLive ? "#22c55e" : "#9ca3af" }} />
          <span className="text-[10px] font-semibold" style={{ color: showLive ? "#4ade80" : "#9ca3af" }}>
            {liveCount > 0 ? `${liveCount} en vivo` : "En vivo"}
          </span>
        </button>

        {/* Hint: reportar tocando el mapa */}
        {viewMode === "map" && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg pointer-events-none"
            style={{ background: "rgba(7,9,15,0.85)" }}>
            <span className="text-[10px] text-white/70 font-medium whitespace-nowrap">👆 Toca cualquier punto del mapa para reportar ahí</span>
          </motion.div>
        )}

        {viewMode === "heat" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 right-3 z-[500] px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-lg"
            style={{ background: "rgba(7,9,15,0.90)", borderColor: "rgba(239,68,68,0.3)" }}>
            <span className="label-mono text-[10px] text-red-400 font-medium">🔥 SOLO ROBOS Y PELEAS</span>
          </motion.div>
        )}

        {viewMode === "map" && (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="absolute left-3 bottom-3 z-[500] p-3 rounded-xl backdrop-blur-md border shadow-xl hidden sm:block"
            style={{ background: "rgba(7,9,15,0.90)", borderColor: "rgba(255,255,255,0.08)" }}>
            <h4 className="label-mono text-[9px] text-white/40 mb-2">Leyenda</h4>
            <div className="space-y-1.5">
              {[
                { label: "Alerta de pánico", color: "#ef4444", emoji: "🚨" },
                { label: "Robo / Asalto", color: "#ef4444", emoji: "🔪" },
                { label: "Pelea", color: "#f97316", emoji: "👊" },
                { label: "Sospechoso", color: "#eab308", emoji: "👁️" },
                { label: "Prostíbulo", color: "#ec4899", emoji: "🏠" },
                { label: "Drogas", color: "#84cc16", emoji: "💊" },
                { label: "Bar / Cantina", color: "#f59e0b", emoji: "🍺" },
                { label: "Emergencia", color: "#ef4444", emoji: "🚑" },
                { label: "Otros", color: "#6b7280", emoji: "⚠️" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-sm">{item.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeCategory !== "all" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="absolute top-14 right-3 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/10 shadow-xl"
            style={{ background: "rgba(7,9,15,0.90)" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: CAT_HEX[activeCategory] }} />
            <span className="text-xs font-semibold text-white">{displayReports.length} reportes</span>
          </motion.div>
        )}
      </div>

      {/* Mapa estático según ubicación — solo debajo del radar */}
      {viewMode === "radar" && !isLoading && <StaticMiniMap reports={displayReports} />}
    </div>
  );
}
