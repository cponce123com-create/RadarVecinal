import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Clock, MapPin, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import { useGetReports, ReportCategory } from "@workspace/api-client-react";
import { useDistrict } from "@/contexts/DistrictContext";
import { CATEGORY_CONFIG } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORY_COLORS: Record<string, string> = {
  robbery: "#ef4444", fight: "#f97316", suspicious: "#eab308",
  water_cut: "#3b82f6", garbage: "#6b7280", informal_commerce: "#a855f7",
  noise: "#f59e0b", missing_person: "#f59e0b", fire: "#ef4444",
  medical_emergency: "#ef4444", other: "#6b7280",
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Activo",      color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  reviewing: { label: "En Revisión", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  resolved:  { label: "Resuelto",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  archived:  { label: "Archivado",   color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const CATEGORY_FILTERS = [
  { id: "all", label: "Todos" },
  { id: ReportCategory.robbery, label: "Robos" },
  { id: ReportCategory.suspicious, label: "Sospechosos" },
  { id: ReportCategory.fight, label: "Peleas" },
  { id: ReportCategory.medical_emergency, label: "Emergencias" },
  { id: ReportCategory.other, label: "Otros" },
];

const PAGE_SIZE = 20;

export default function History() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useGetReports();

  const filtered = (data?.reports ?? []).filter(r => {
    const term = search.toLowerCase();
    const matchSearch = !search
      || r.title.toLowerCase().includes(term)
      || (r.description ?? "").toLowerCase().includes(term)
      || r.sector.toLowerCase().includes(term);
    const matchCat = category === "all" || r.category === category;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto pb-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Historial</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando..." : `${filtered.length} incidente${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar incidentes..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
        {CATEGORY_FILTERS.map(f => {
          const active = category === f.id;
          const color = f.id !== "all" ? CATEGORY_COLORS[f.id] : undefined;
          return (
            <button
              key={f.id}
              onClick={() => { setCategory(f.id); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                active
                  ? "text-white"
                  : "bg-card border-white/8 text-muted-foreground hover:text-white hover:border-white/15"
              }`}
              style={active ? {
                background: color ? `${color}22` : "hsl(217 100% 55% / 0.18)",
                borderColor: color ? `${color}55` : "hsl(217 100% 55% / 0.5)",
                color: color ?? "hsl(217 100% 75%)",
              } : {}}
            >
              {color && active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
              {f.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-xl bg-card animate-pulse border border-white/5" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-16 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400/70" />
          </div>
          <p className="text-white font-semibold">No se pudo cargar el historial</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white/80 hover:bg-white/10 transition-all min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-card border border-white/5 flex items-center justify-center mb-4">
            <Search className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-white font-semibold mb-1">Sin resultados</p>
          <p className="text-sm text-muted-foreground">
            {search ? `No hay incidentes que coincidan con "${search}"` : "No hay incidentes en esta categoría."}
          </p>
          {(search || category !== "all") && (
            <button
              onClick={() => { setSearch(""); setCategory("all"); }}
              className="mt-4 text-xs text-primary hover:text-blue-300 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div
          style={{ maxHeight: 'calc(100dvh - 24rem)', overflowY: 'auto' }}
          className="relative space-y-2"
        >
          {paginated.map((report, i) => {
            const config = CATEGORY_CONFIG[report.category as keyof typeof CATEGORY_CONFIG];
            const Icon = config?.icon;
            const color = CATEGORY_COLORS[report.category] ?? "#6b7280";
            const status = STATUS_META[report.status] ?? STATUS_META.active;

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.15) }}
                className="flex items-start gap-3.5 p-4 rounded-xl bg-card border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all cursor-pointer"
              >
                {/* Category icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15` }}
                >
                  {Icon && <Icon className="w-5 h-5" style={{ color }} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-white leading-snug truncate">{report.title}</p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                      style={{ color: status.color, background: status.bg }}
                    >
                      {status.label}
                    </span>
                  </div>

                  {report.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">{report.description}</p>
                  ) : null}

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {report.sector}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(report.createdAt), { locale: es, addSuffix: true })}
                    </span>
                    {report.confirmedCount > 0 && (
                      <span className="text-primary/60">✓ {report.confirmedCount}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p =>
            p === 1 || p === totalPages || Math.abs(p - page) <= 1
          ).reduce<(number | "...")[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, []).map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="text-xs text-muted-foreground/50 px-1">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p as number)}
                className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                  page === p
                    ? "bg-primary text-white"
                    : "bg-card border border-white/8 text-muted-foreground hover:text-white hover:border-white/20"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-xl bg-card border border-white/8 flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {totalPages > 1 && !isLoading && (
        <p className="text-center text-[11px] text-muted-foreground/50">
          Página {page} de {totalPages} · {filtered.length} incidentes
        </p>
      )}
    </div>
  );
}
