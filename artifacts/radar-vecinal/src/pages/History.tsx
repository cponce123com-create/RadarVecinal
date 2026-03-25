import { useState } from "react";
import { Filter, Search } from "lucide-react";
import { ReportCard } from "@/components/ReportCard";
import { useGetReports } from "@workspace/api-client-react";

export default function History() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data, isLoading } = useGetReports();

  const filteredReports = data?.reports.filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.sector.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-2">Historial</h2>
          <p className="text-muted-foreground">Archivo de todos los incidentes reportados en la red.</p>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl bg-card border border-white/10 text-white focus:border-primary focus:outline-none w-full md:w-64"
            />
          </div>
          <button className="px-4 py-2 rounded-xl bg-card border border-white/10 text-white flex items-center gap-2 hover:bg-white/5 transition-colors">
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtrar</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-card animate-pulse border border-white/5" />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground bg-card rounded-2xl border border-white/5">
          No se encontraron reportes que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map(report => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
