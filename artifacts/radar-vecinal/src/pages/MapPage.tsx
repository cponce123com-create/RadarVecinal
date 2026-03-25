import { useState } from "react";
import { motion } from "framer-motion";
import { Thermometer, Radar, RotateCcw } from "lucide-react";
import { LeafletMap } from "@/components/LeafletMap";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { useGetReports, ReportCategory } from "@workspace/api-client-react";
import { CAT_HEX, DISTRICT } from "@/lib/constants";

type ViewMode = "map" | "radar" | "heat";

const FILTERS: { id: string; label: string }[] = [
  { id: "all",                                  label: "Todos" },
  { id: ReportCategory.robbery,                 label: "Robos" },
  { id: ReportCategory.suspicious,              label: "Sospechosos" },
  { id: ReportCategory.fight,                   label: "Peleas" },
  { id: ReportCategory.missing_person,          label: "Extraviados" },
  { id: ReportCategory.medical_emergency,       label: "Emergencias" },
];

export default function MapPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const { data, isLoading } = useGetReports();

  const filteredReports = activeCategory === "all"
    ? (data?.reports ?? [])
    : (data?.reports ?? []).filter(r => r.category === activeCategory);

  const showHeatmap = viewMode === "heat";
  const showRadar   = viewMode === "radar";

  return (
    <div className="flex flex-col gap-3 h-[calc(100dvh-5rem)] md:h-[calc(100dvh-3rem)] pb-1">

      {/* Header */}
      <div className="flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white leading-tight">Mapa de Incidentes</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Cargando..." : `${filteredReports.length} visibles · ${DISTRICT.displayName}`}
            </p>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-card border border-white/8">
            {([
              { id: "map",   label: "Mapa",  Icon: null,        title: "Calles" },
              { id: "radar", label: "Radar", Icon: Radar,       title: "Radar" },
              { id: "heat",  label: "Calor", Icon: Thermometer, title: "Mapa de calor" },
            ] as const).map(v => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                title={v.title}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === v.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {v.Icon && <v.Icon className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          {FILTERS.map(f => {
            const active = activeCategory === f.id;
            const color = f.id !== "all" ? CAT_HEX[f.id] : undefined;
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
                {color && active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />}
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
        ) : showRadar ? (
          <MapPlaceholder reports={filteredReports} interactive />
        ) : (
          <LeafletMap reports={filteredReports} showHeatmap={showHeatmap} />
        )}

        {/* Heatmap info badge */}
        {showHeatmap && (
          <div className="absolute top-3 left-3 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 border border-red-500/30 backdrop-blur-md">
            <Thermometer className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs text-white font-medium">Mapa de Calor Activo</span>
          </div>
        )}

        {/* Legend (map + radar mode) */}
        {!showHeatmap && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute left-3 bottom-3 z-[500] p-3 rounded-xl bg-[#0a0e17]/90 backdrop-blur-md border border-white/8 shadow-xl hidden sm:block"
          >
            <h4 className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">Leyenda</h4>
            <div className="space-y-1.5">
              {[
                { label: "Robo / Asalto",  color: "#ef4444" },
                { label: "Pelea",          color: "#f97316" },
                { label: "Sospechoso",     color: "#eab308" },
                { label: "Servicios",      color: "#3b82f6" },
                { label: "Extraviados",    color: "#f59e0b" },
                { label: "Otros",          color: "#6b7280" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color, boxShadow: `0 0 4px ${item.color}88` }} />
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
            className="absolute top-3 right-3 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0a0e17]/90 backdrop-blur-md border border-white/10 shadow-xl"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: CAT_HEX[activeCategory] }} />
            <span className="text-xs font-semibold text-white">{filteredReports.length} reportes</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
