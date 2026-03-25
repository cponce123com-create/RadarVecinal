import { useState } from "react";
import { Filter, Layers, Navigation } from "lucide-react";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { useGetReports, ReportCategory } from "@workspace/api-client-react";

export default function MapPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  
  // Real implementation would use the category filter in the API call
  const { data, isLoading } = useGetReports();
  
  const filters = [
    { id: "all", label: "Todos" },
    { id: ReportCategory.robbery, label: "Robos" },
    { id: ReportCategory.suspicious, label: "Sospechosos" },
    { id: ReportCategory.missing_person, label: "Desaparecidos" },
  ];

  const filteredReports = activeCategory === "all" 
    ? data?.reports 
    : data?.reports.filter(r => r.category === activeCategory);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Mapa de Incidentes</h2>
          <p className="text-sm text-muted-foreground">Visualización en tiempo real del distrito</p>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2 md:pb-0">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveCategory(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === f.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-card border border-white/10 text-muted-foreground hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <MapPlaceholder reports={filteredReports || []} interactive={true} />
        
        {/* Floating Map Controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-2">
          <button className="w-10 h-10 rounded-xl bg-card/80 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors shadow-lg">
            <Layers className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-xl bg-card/80 backdrop-blur border border-white/10 flex items-center justify-center text-primary hover:bg-white/10 transition-colors shadow-lg">
            <Navigation className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute left-4 bottom-4 p-4 rounded-xl bg-card/90 backdrop-blur-md border border-white/10 shadow-xl max-w-[200px] hidden sm:block">
          <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider">Leyenda</h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-destructive" /> Robo/Asalto</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-warning" /> Sospechoso</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-primary" /> Servicios</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-accent" /> Otros</div>
          </div>
        </div>
      </div>
    </div>
  );
}
