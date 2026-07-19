/**
 * MyReports — Lista de los reportes propios del vecino (perfil, UX-AU4).
 * Usa GET /api/reports/mine (requiere sesión).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, MapPin, ChevronRight, Plus } from "lucide-react";
import { CATEGORY_CONFIG, CAT_HEX } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/Skeleton";

interface MyReport {
  id: string;
  title: string;
  category: string;
  status: string;
  sector: string;
  confirmedCount: number;
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:    { label: "Activo",    cls: "bg-destructive/15 text-red-400" },
  reviewing: { label: "Revisión",  cls: "bg-warning/15 text-amber-400" },
  resolved:  { label: "Resuelto",  cls: "bg-success/15 text-success" },
  archived:  { label: "Archivado", cls: "bg-white/8 text-muted-foreground" },
};

async function fetchMine(): Promise<{ reports: MyReport[]; total: number }> {
  const token = localStorage.getItem("radarvecinal_token");
  const res = await fetch("/api/reports/mine?limit=20", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("No se pudieron cargar tus reportes.");
  return res.json();
}

export default function MyReports() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-reports"],
    queryFn: fetchMine,
    staleTime: 30000,
  });

  const reports = data?.reports ?? [];

  return (
    <div className="rounded-2xl bg-card border border-white/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-white">Mis reportes</span>
          {data?.total ? <span className="text-[11px] text-muted-foreground">({data.total})</span> : null}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No se pudieron cargar tus reportes.</p>
      ) : reports.length === 0 ? (
        <div className="py-8 flex flex-col items-center text-center gap-3">
          <FileText className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground max-w-[240px]">Aún no has hecho reportes. Cuando reportes algo, aparecerá aquí.</p>
          <Link href="/reportar">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors cursor-pointer">
              <Plus className="w-4 h-4" /> Hacer mi primer reporte
            </span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => {
            const cfg = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
            const color = CAT_HEX[r.category] ?? "#6b7280";
            const Icon = cfg?.icon ?? FileText;
            const st = STATUS_META[r.status] ?? STATUS_META.active;
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/6">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}22` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> {r.sector}
                    <span className="text-[#4a5568]">·</span>
                    {formatDistanceToNow(new Date(r.createdAt), { locale: es, addSuffix: true })}
                    {r.confirmedCount > 0 && <><span className="text-[#4a5568]">·</span><span className="text-success/60">✓ {r.confirmedCount}</span></>}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-[3px] rounded-full whitespace-nowrap flex-shrink-0 ${st.cls}`}>{st.label}</span>
              </div>
            );
          })}
          {(data?.total ?? 0) > reports.length && (
            <Link href="/historial">
              <span className="flex items-center justify-center gap-1 text-xs text-primary hover:underline mt-1 cursor-pointer">
                Ver todo el historial <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
