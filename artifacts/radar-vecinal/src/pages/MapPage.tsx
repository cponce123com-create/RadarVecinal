import { useState } from "react";
import { motion } from "framer-motion";
import { Layers, Navigation, Filter, RotateCcw } from "lucide-react";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { useGetReports, ReportCategory } from "@workspace/api-client-react";
import { CATEGORY_CONFIG } from "@/lib/constants";

const CATEGORY_DOT_COLORS: Record<string, string> = {
  robbery: "#ef4444", fight: "#f97316", suspicious: "#eab308",
  water_cut: "#3b82f6", garbage: "#6b7280", informal_commerce: "#a855f7",
  noise: "#f59e0b", missing_person: "#f59e0b", fire: "#ef4444",
  medical_emergency: "#ef4444", other: "#6b7280",
};

const FILTERS: { id: string; label: string; category?: ReportCategory }[] = [
  { id: "all", label: "Todos" },
  { id: ReportCategory.robbery, label: "Robos", category: ReportCategory.robbery },
  { id: ReportCategory.suspicious, label: "Sospechosos", category: ReportCategory.suspicious },
  { id: ReportCategory.fight, label: "Peleas", category: ReportCategory.fight },
  { id: ReportCategory.missing_person, label: "Extraviados", category: ReportCategory.missing_person },
  { id: ReportCategory.medical_emergency, label: "Emergencias", category: ReportCategory.medical_emergency },
];

export default function MapPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const { data, isLoading } = useGetReports();

  const filteredReports = activeCategory === "all"
    ? (data?.reports ?? [])
    : (data?.reports ?? []).filter(r => r.category === activeCategory);

  const activeCategoryConfig = activeCategory !== "all"
    ? CATEGORY_CONFIG[activeCategory as keyof typeof CATEGORY_CONFIG]
    : null;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-5rem)] md:h-[calc(100vh-3rem)]">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white">Mapa de Incidentes</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando..." : `${filteredReports.length} incidentes visibles — Distrito San Miguel`}
          </p>
        </div>

        {/* Category filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 md:pb-0">
          {FILTERS.map(f => {
            const active = activeCategory === f.id;
            const color = f.category ? CATEGORY_DOT_COLORS[f.category] : undefined;
            return (
              <motion.button
                key={f.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  active
                    ? "text-white border-transparent"
                    : "bg-card border-white/8 text-muted-foreground hover:text-white hover:border-white/15"
                }`}
                style={active ? {
                  background: color ? `${color}22` : "hsl(217 100% 55% / 0.2)",
                  borderColor: color ? `${color}55` : "hsl(217 100% 55% / 0.5)",
                  color: color ?? "hsl(217 100% 75%)",
                } : {}}
              >
                {color && active && (
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                )}
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

      {/* Map Container */}
      <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl min-h-0">
        {isLoading ? (
          <div className="w-full h-full bg-[#060810] flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Cargando mapa...
            </div>
          </div>
        ) : (
          <MapPlaceholder reports={filteredReports} interactive />
        )}

        {/* Floating Controls */}
        <div className="absolute right-3 top-3 flex flex-col gap-2 z-20">
          <button className="w-9 h-9 rounded-xl bg-card/85 backdrop-blur-md border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all shadow-lg">
            <Layers className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-xl bg-card/85 backdrop-blur-md border border-white/10 flex items-center justify-center text-primary hover:bg-white/10 transition-all shadow-lg">
            <Navigation className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute left-3 bottom-3 z-20 p-3.5 rounded-xl bg-card/90 backdrop-blur-md border border-white/8 shadow-xl hidden sm:block"
        >
          <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2.5">Leyenda</h4>
          <div className="space-y-1.5 text-[11px]">
            {[
              { label: "Robo / Asalto", color: "#ef4444" },
              { label: "Emergencia médica", color: "#ef4444" },
              { label: "Pelea / Violencia", color: "#f97316" },
              { label: "Actividad sospechosa", color: "#eab308" },
              { label: "Corte de servicios", color: "#3b82f6" },
              { label: "Extraviados", color: "#f59e0b" },
              { label: "Otros", color: "#6b7280" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color, boxShadow: `0 0 4px ${item.color}66` }} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Report count overlay */}
        {activeCategory !== "all" && activeCategoryConfig && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-card/90 backdrop-blur-md border border-white/10 shadow-xl"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_DOT_COLORS[activeCategory] }} />
            <span className="text-xs font-semibold text-white">{activeCategoryConfig.label}</span>
            <span className="text-xs text-muted-foreground ml-1">— {filteredReports.length} reportes</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
