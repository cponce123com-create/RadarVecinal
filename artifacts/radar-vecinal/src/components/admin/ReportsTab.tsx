import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Phone, CheckCircle, Eye, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useUpdateReport, useDeleteReport, ReportStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { CATEGORY_CONFIG, CAT_HEX } from "@/lib/constants";
import { STATUS_META } from "./constants";
import DeleteConfirmModal from "./DeleteConfirmModal";

interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  sector: string;
  createdAt: string;
  contactPhone?: string | null;
}

interface Props {
  reports: Report[];
  search: string;
  onRefetch: () => void;
}

export default function ReportsTab({ reports, search, onRefetch }: Props) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const updateReport = useUpdateReport();
  const deleteReport = useDeleteReport();
  const { toast } = useToast();

  const filtered = reports.filter(r =>
    !search ||
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.sector.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleStatus = (id: string, status: ReportStatus) => {
    updateReport.mutate({ id, data: { status } }, {
      onSuccess: () => { toast({ title: `Estado → "${STATUS_META[status]?.label}"` }); onRefetch(); }
    });
  };

  const handleDelete = (id: string) => {
    deleteReport.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Reporte eliminado", variant: "destructive" });
        setDeleteId(null);
        onRefetch();
      },
      onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
    });
  };

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-xl bg-card border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Incidente</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden lg:table-cell">Sector</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden lg:table-cell">Hace</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Estado</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-muted-foreground/30" />
                      <p>No se encontraron reportes.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(r => {
                const catConfig = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
                const dotColor = CAT_HEX[r.category] ?? "#6b7280";
                const s = STATUS_META[r.status] ?? STATUS_META.active;
                const Icon = catConfig?.icon;
                return (
                  <tr key={r.id} className="hover:bg-white/[0.025] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {Icon
                          ? <Icon className="w-4 h-4 flex-shrink-0" style={{ color: dotColor }} />
                          : <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                        }
                        <div className="min-w-0">
                          <span className="font-medium text-white max-w-[220px] truncate block">{r.title}</span>
                          <span className="text-[10px] text-muted-foreground/50">{catConfig?.label ?? r.category}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{r.sector}</td>
                    <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">
                      {formatDistanceToNow(new Date(r.createdAt), { locale: es })}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: s.color, background: s.bg }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {r.contactPhone && (
                          <a href={`tel:${r.contactPhone}`} title={`Llamar: ${r.contactPhone}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/15 transition-colors">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {r.status !== "resolved" && (
                          <button onClick={() => handleStatus(r.id, ReportStatus.resolved)} title="Marcar como resuelto"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-green-500 hover:bg-green-500/15 transition-colors">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {r.status !== "reviewing" && r.status !== "resolved" && (
                          <button onClick={() => handleStatus(r.id, ReportStatus.reviewing)} title="Poner en revisión"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-yellow-500 hover:bg-yellow-500/15 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {r.status === "resolved" && (
                          <button onClick={() => handleStatus(r.id, ReportStatus.archived)} title="Archivar"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-white/8 transition-colors">
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setDeleteId(r.id)} title="Eliminar reporte"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500/60 hover:text-red-500 hover:bg-red-500/15 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-card border border-white/5 text-muted-foreground text-sm flex flex-col items-center gap-2">
            <FileText className="w-7 h-7 text-muted-foreground/30" />
            No se encontraron reportes.
          </div>
        ) : filtered.map(r => {
          const catConfig = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
          const dotColor = CAT_HEX[r.category] ?? "#6b7280";
          const s = STATUS_META[r.status] ?? STATUS_META.active;
          const Icon = catConfig?.icon;
          return (
            <div key={r.id} className="p-3.5 rounded-xl bg-card border border-white/5">
              <div className="flex items-start gap-2.5 mb-3">
                {Icon
                  ? <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: dotColor }} />
                  : <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: dotColor }} />
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm leading-tight mb-0.5">{r.title}</p>
                  <p className="text-[10px] text-muted-foreground/60">{r.sector} · {formatDistanceToNow(new Date(r.createdAt), { locale: es })}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ color: s.color, background: s.bg }}>
                  {s.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 border-t border-white/5 pt-2.5">
                {r.contactPhone && (
                  <a href={`tel:${r.contactPhone}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                    <Phone className="w-3 h-3" /> Llamar
                  </a>
                )}
                {r.status !== "resolved" && (
                  <button onClick={() => handleStatus(r.id, ReportStatus.resolved)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors">
                    <CheckCircle className="w-3 h-3" /> Resolver
                  </button>
                )}
                {r.status !== "reviewing" && r.status !== "resolved" && (
                  <button onClick={() => handleStatus(r.id, ReportStatus.reviewing)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors">
                    <Eye className="w-3 h-3" /> Revisar
                  </button>
                )}
                <button onClick={() => setDeleteId(r.id)}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-400/70 bg-red-500/8 hover:bg-red-500/15 transition-colors">
                  <Trash2 className="w-3 h-3" /> Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <DeleteConfirmModal
        deleteId={deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isPending={deleteReport.isPending}
      />
    </>
  );
}
