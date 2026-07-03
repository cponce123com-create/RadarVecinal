import { useState } from "react";
import { motion } from "framer-motion";
import { Thermometer, Radar, RotateCcw, Map as MapIcon } from "lucide-react";
import { LeafletMap, MapMode } from "@/components/LeafletMap";
import ReportContextMenu from "@/components/ReportContextMenu";
import { useGetReports, ReportCategory } from "@workspace/api-client-react";
import { CAT_HEX, CATEGORY_CONFIG, DISTRICT } from "@/lib/constants";
import { useDistrict } from "@/contexts/DistrictContext";
import { useAuth } from "@/contexts/AuthContext";
import { subDays, subMonths, isAfter } from "date-fns";

const ALL_CATEGORY_FILTERS: { id: string; label: string }[] = [
  { id: "all",                                      label: "Todos" },
  { id: ReportCategory.robbery,                     label: "Robo / Asalto" },
  { id: ReportCategory.fight,                       label: "Peleas" },
  { id: ReportCategory.suspicious,                  label: "Sospechosos" },
  { id: ReportCategory.prostitution,                label: "Prostíbulos" },
  { id: ReportCategory.drug_point,                  label: "Drogas" },
  { id: ReportCategory.bar_trouble,                 label: "Bares" },
  { id: ReportCategory.missing_person,              label: "Extraviados" },
  { id: ReportCategory.medical_emergency,           label: "Emergencias" },
  { id: ReportCategory.fire,                        label: "Incendios" },
  { id: ReportCategory.noise,                       label: "Ruidos" },
  { id: ReportCategory.water_cut,                   label: "Agua" },
  { id: ReportCategory.garbage,                     label: "Basura" },
  { id: ReportCategory.informal_commerce,           label: "Com. Ilícito" },
  { id: ReportCategory.other,                       label: "Otros" },
];

const VIEW_MODES: { id: MapMode; label: string; Icon: React.ElementType; sub: string }[] = [
  { id: "map",   label: "Mapa",  Icon: MapIcon,     sub: "Últimos 15 días" },
  { id: "radar", label: "Radar", Icon: Radar,       sub: "Activos en vivo" },
  { id: "heat",  label: "Calor", Icon: Thermometer, sub: "6 meses · Robos y peleas" },
];

export default function MapPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [viewMode, setViewMode] = useState<MapMode>("map");
  const [contextReport, setContextReport] = useState<{ id: string; title: string; status: string } | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);

  const { currentDistrictId } = useDistrict();
  const { user } = useAuth();
  const isAdmin = !!user && (user.role === "admin" || user.role === "moderator" || user.role === "super_admin");
  const { data, isLoading, refetch } = useGetReports({ districtId: currentDistrictId ?? undefined });
  const allReports = data?.reports ?? [];

  const cutoff15d   = subDays(new Date(), 15);
  const last15d     = allReports.filter(r => isAfter(new Date(r.createdAt), cutoff15d));

  const cutoff6m    = subMonths(new Date(), 6);
  const last6m      = allReports.filter(r => isAfter(new Date(r.createdAt), cutoff6m));

  const radarReports = allReports.filter(r => r.status === "active");

  const applyFilter = (arr: typeof allReports) =>
    activeCategory === "all" ? arr : arr.filter(r => r.category === activeCategory);

  const displayReports = applyFilter(
    viewMode === "map"   ? last15d :
    viewMode === "radar" ? radarReports :
    last6m
  );

  const heatReports = applyFilter(last6m);
  const currentMode = VIEW_MODES.find(v => v.id === viewMode)!;

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-5rem)] md:h-[calc(100dvh-3rem)] pb-1">

      {/* Header */}
      <div className="flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white leading-tight">Mapa de Incidentes</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Cargando..."
                : `${displayReports.length} visibles · ${currentMode.sub} · ${DISTRICT.displayName}`
              }
            </p>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-card border border-white/8">
            {VIEW_MODES.map(v => {
              const Icon = v.Icon;
              const active = viewMode === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setViewMode(v.id)}
                  title={v.sub}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category filter pills — scrollable, all categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
          {ALL_CATEGORY_FILTERS.map(f => {
            const active = activeCategory === f.id;
            const color  = f.id !== "all" ? (CAT_HEX[f.id] ?? undefined) : undefined;
            const catConf = f.id !== "all" ? CATEGORY_CONFIG[f.id as ReportCategory] : null;
            const Icon = catConf?.icon;
            return (
              <motion.button
                key={f.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  active ? "text-white border-transparent" : "bg-card border-white/8 text-muted-foreground hover:text-white"
                }`}
                style={active ? {
                  background: color ? `${color}22` : "hsl(217 100% 55% / 0.2)",
                  borderColor: color ? `${color}55` : "hsl(217 100% 55% / 0.5)",
                  color: color ?? "hsl(217 100% 75%)",
                } : {}}
              >
                {Icon && active && <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />}
                {!Icon && color && active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />}
                {f.label}
              </motion.button>
            );
          })}
          {activeCategory !== "all" && (
            <button
              onClick={() => setActiveCategory("all")}
              className="p-1.5 rounded-full text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl min-h-0">
        {isLoading ? (
          <div className="w-full h-full bg-[#060810] flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Cargando mapa...
            </div>
          </div>
        ) : (
          <LeafletMap
            reports={displayReports}
            heatReports={heatReports}
            mode={viewMode}
            isAdmin={isAdmin}
            onContextMenu={(report, pos) => {
              setContextReport({ id: report.id, title: report.title, status: report.status });
              setContextPos(pos);
            }}
          />
        )}

        {/* Menu contextual para admin (clic derecho) */}
        <ReportContextMenu
          report={contextReport}
          position={contextPos}
          onClose={() => { setContextReport(null); setContextPos(null); }}
          onResolved={() => { setContextReport(null); setContextPos(null); refetch(); }}
        />

        {/* Mode info badge */}
        <div
          className="absolute top-3 left-3 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-lg"
          style={{
            background: "rgba(10,14,23,0.85)",
            borderColor: viewMode === "radar" ? "rgba(0,200,80,0.35)"
                       : viewMode === "heat"  ? "rgba(239,68,68,0.35)"
                       : "rgba(255,255,255,0.1)",
          }}
        >
          {viewMode === "map"   && <MapIcon     className="w-3.5 h-3.5 text-primary" />}
          {viewMode === "radar" && <Radar       className="w-3.5 h-3.5" style={{ color: "#00c853" }} />}
          {viewMode === "heat"  && <Thermometer className="w-3.5 h-3.5 text-red-400" />}
          <span className="text-xs font-semibold" style={{ color: viewMode === "radar" ? "#00c853" : viewMode === "heat" ? "#f87171" : "#fff" }}>
            {currentMode.sub}
          </span>
          <span className="text-[10px] text-muted-foreground">
            · {displayReports.length}
          </span>
        </div>

        {/* Heat mode info notice */}
        {viewMode === "heat" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 right-3 z-[500] px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-lg"
            style={{ background: "rgba(10,14,23,0.90)", borderColor: "rgba(239,68,68,0.3)" }}
          >
            <span className="text-[10px] text-red-400 font-medium">🔥 Solo robos y peleas</span>
          </motion.div>
        )}

        {/* Category icon legend — map mode */}
        {viewMode === "map" && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute left-3 bottom-3 z-[500] p-3 rounded-xl backdrop-blur-md border shadow-xl hidden sm:block"
            style={{ background: "rgba(10,14,23,0.90)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <h4 className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">Leyenda</h4>
            <div className="space-y-1.5">
              {[
                { label: "Robo / Asalto",  color: "#ef4444", emoji: "🔪" },
                { label: "Pelea",          color: "#f97316", emoji: "👊" },
                { label: "Sospechoso",     color: "#eab308", emoji: "👁️" },
                { label: "Prostíbulo",     color: "#ec4899", emoji: "🏠" },
                { label: "Drogas",         color: "#84cc16", emoji: "💊" },
                { label: "Bar / Cantina",  color: "#f59e0b", emoji: "🍺" },
                { label: "Emergencia",     color: "#ef4444", emoji: "🚑" },
                { label: "Otros",          color: "#6b7280", emoji: "⚠️" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-sm">{item.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Active category badge */}
        {activeCategory !== "all" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 right-14 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/10 shadow-xl"
            style={{ background: "rgba(10,14,23,0.90)" }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: CAT_HEX[activeCategory] }} />
            <span className="text-xs font-semibold text-white">{displayReports.length} reportes</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

