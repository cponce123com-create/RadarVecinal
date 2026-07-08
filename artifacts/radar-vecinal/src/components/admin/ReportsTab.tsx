import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Phone, CheckCircle, Eye, Clock, FileText, MessageSquare, AlertTriangle, Loader2, Shield, ShieldCheck, X, Flag, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useUpdateReport, useDeleteReport, ReportStatus } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { CATEGORY_CONFIG, CAT_HEX } from "@/lib/constants";
import { STATUS_META } from "./constants";
import DeleteConfirmModal from "./DeleteConfirmModal";
import ContactNeighborModal from "./ContactNeighborModal";

interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  sector: string;
  district: string;
  createdAt: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  authorName?: string;
  isAnonymous?: boolean;
  authorUserId?: string | null;
}

// FASE 5: Extended report type for moderation queue
interface ReviewingReport extends Report {
  strikeCount?: number;
  trustScore?: number;
  communityFlagCount?: number;
}

type TabFilter = "all" | "reviewing";

interface Props {
  reports: Report[];
  search: string;
  onRefetch: () => void;
}

function getTrustColor(score: number): string {
  if (score < 30) return "#ef4444";
  if (score <= 60) return "#f59e0b";
  return "#22c55e";
}

function getTrustBg(score: number): string {
  if (score < 30) return "rgba(239,68,68,0.12)";
  if (score <= 60) return "rgba(245,158,11,0.12)";
  return "rgba(34,197,94,0.12)";
}

export default function ReportsTab({ reports, search, onRefetch }: Props) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [contactReport, setContactReport] = useState<Report | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");
  const [reviewingReports, setReviewingReports] = useState<ReviewingReport[]>([]);
  const [loadingReviewing, setLoadingReviewing] = useState(false);
  const [flagFakeModal, setFlagFakeModal] = useState<{ id: string; title: string; isReviewing?: boolean } | null>(null);
  const [fakeReason, setFakeReason] = useState("");
  const [flagging, setFlagging] = useState(false);
  const updateReport = useUpdateReport();
  const deleteReport = useDeleteReport();
  const { toast } = useToast();

  const loadReviewing = async () => {
    setLoadingReviewing(true);
    try {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch("/api/reports/reviewing", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setReviewingReports(data.reports ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingReviewing(false);
    }
  };

  // Load reviewing reports when tab switches to reviewing
  const switchTab = (tab: TabFilter) => {
    setTabFilter(tab);
    if (tab === "reviewing") {
      loadReviewing();
    }
  };

  const handleFlagFake = async (reportId: string) => {
    if (!fakeReason.trim()) {
      toast({ title: "Escribe un motivo", variant: "destructive" });
      return;
    }
    setFlagging(true);
    try {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/reports/${reportId}/flag-fake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: fakeReason.trim() }),
      });
      if (res.ok) {
        toast({ title: "⚠️ Reporte marcado como falso", description: "Strike aplicado al usuario." });
        setFlagFakeModal(null);
        setFakeReason("");
        onRefetch();
        if (tabFilter === "reviewing") loadReviewing();
      } else {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setFlagging(false);
    }
  };

  const handleApprove = async (reportId: string) => {
    try {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/reports/${reportId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast({ title: "✅ Reporte aprobado", description: "TrustScore del autor +5" });
        onRefetch();
        loadReviewing();
      } else {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

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

  const getContactInfo = (r: Report) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    sector: r.sector,
    district: r.district,
    authorName: r.authorName ?? "",
    contactPhone: r.contactPhone ?? null,
    contactEmail: r.contactEmail ?? null,
    isAnonymous: r.isAnonymous ?? false,
    status: r.status,
  });

  const currentReports = tabFilter === "reviewing" ? reviewingReports : filtered;

  return (
    <>
      {/* FASE 5: Tab filter buttons */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => switchTab("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tabFilter === "all"
              ? "bg-primary/20 text-primary border border-primary/30"
              : "bg-card border border-white/8 text-muted-foreground hover:text-white hover:border-white/20"
          }`}
        >
          <FileText className="w-3.5 h-3.5 inline mr-1.5" />
          Todos
        </button>
        <button
          onClick={() => switchTab("reviewing")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tabFilter === "reviewing"
              ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
              : "bg-card border border-white/8 text-muted-foreground hover:text-white hover:border-white/20"
          }`}
        >
          <Eye className="w-3.5 h-3.5 inline mr-1.5" />
          Moderación
          {reviewingReports.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-[9px] font-bold text-yellow-400">
              {reviewingReports.length}
            </span>
          )}
        </button>
      </div>

      {tabFilter === "reviewing" && loadingReviewing && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl bg-card border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Incidente</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden lg:table-cell">Sector</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden lg:table-cell">Hace</th>
                {tabFilter === "reviewing" && (
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Autor</th>
                )}
                <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Estado</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {currentReports.length === 0 ? (
                <tr>
                  <td colSpan={tabFilter === "reviewing" ? 6 : 5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center gap-2">
                      {tabFilter === "reviewing" ? (
                        <>
                          <Eye className="w-8 h-8 text-muted-foreground/30" />
                          <p>No hay reportes en moderación.</p>
                        </>
                      ) : (
                        <>
                          <FileText className="w-8 h-8 text-muted-foreground/30" />
                          <p>No se encontraron reportes.</p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : currentReports.map((r: any) => {
                const catConfig = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
                const dotColor = CAT_HEX[r.category] ?? "#6b7280";
                const s = STATUS_META[r.status] ?? STATUS_META.active;
                const Icon = catConfig?.icon;
                const isReviewing = tabFilter === "reviewing";
                const trustScore = r.trustScore ?? 50;
                const isSuspended = r.suspendedUntil && new Date(r.suspendedUntil) > new Date();
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
                    {isReviewing && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white">{r.authorName}</span>
                          {r.trustScore !== undefined && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ color: getTrustColor(trustScore), background: getTrustBg(trustScore) }}
                            >
                              {trustScore}
                            </span>
                          )}
                          {(r.strikeCount ?? 0) > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                              {r.strikeCount} S
                            </span>
                          )}
                          {(r.communityFlagCount ?? 0) > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">
                              {r.communityFlagCount} ⚑
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: s.color, background: s.bg }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {isReviewing ? (
                          <>
                            <button
                              onClick={() => handleApprove(r.id)}
                              title="Aprobar reporte"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-green-500 hover:bg-green-500/15 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setFlagFakeModal({ id: r.id, title: r.title, isReviewing: true })}
                              title="Rechazar como falso"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/15 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setContactReport(r)}
                              title="Contactar vecino"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-500/15 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
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
                            <button
                              onClick={() => setFlagFakeModal({ id: r.id, title: r.title })}
                              title="Marcar como reporte falso (strike system)"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500/60 hover:text-red-500 hover:bg-red-500/15 transition-colors"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteId(r.id)} title="Eliminar reporte"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500/60 hover:text-red-500 hover:bg-red-500/15 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
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
        {currentReports.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-card border border-white/5 text-muted-foreground text-sm flex flex-col items-center gap-2">
            {tabFilter === "reviewing" ? (
              <><Eye className="w-7 h-7 text-muted-foreground/30" />No hay reportes en moderación.</>
            ) : (
              <><FileText className="w-7 h-7 text-muted-foreground/30" />No se encontraron reportes.</>
            )}
          </div>
        ) : currentReports.map((r: any) => {
          const catConfig = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
          const dotColor = CAT_HEX[r.category] ?? "#6b7280";
          const s = STATUS_META[r.status] ?? STATUS_META.active;
          const Icon = catConfig?.icon;
          const isReviewing = tabFilter === "reviewing";
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
                  {isReviewing && r.trustScore !== undefined && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ color: getTrustColor(r.trustScore), background: getTrustBg(r.trustScore) }}>
                        Trust: {r.trustScore}
                      </span>
                      {(r.strikeCount ?? 0) > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                          {r.strikeCount} strikes
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ color: s.color, background: s.bg }}>
                  {s.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 border-t border-white/5 pt-2.5">
                {isReviewing ? (
                  <>
                    <button onClick={() => handleApprove(r.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors">
                      <CheckCircle className="w-3 h-3" /> Aprobar
                    </button>
                    <button onClick={() => setFlagFakeModal({ id: r.id, title: r.title, isReviewing: true })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                      <X className="w-3 h-3" /> Rechazar
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setContactReport(r)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
                      <MessageSquare className="w-3 h-3" /> Contactar
                    </button>
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
                    <button onClick={() => setDeleteId(r.id)}
                      className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-400/70 bg-red-500/8 hover:bg-red-500/15 transition-colors">
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FASE 5: Flag as fake modal */}
      <AnimatePresence>
        {flagFakeModal && (
          <>
            <div className="fixed inset-0 bg-black/70 z-50" onClick={() => { setFlagFakeModal(null); setFakeReason(""); }} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-4 md:inset-auto md:top-[20%] md:left-1/2 md:-translate-x-1/2 md:w-[440px] z-50 bg-[#0b0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="font-display font-bold text-white">Marcar como falso</span>
                </div>
                <button onClick={() => { setFlagFakeModal(null); setFakeReason(""); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Reporte: <strong className="text-white">{flagFakeModal.title}</strong>
                </p>
                <p className="text-xs text-red-400/80 bg-red-500/8 rounded-xl p-3 leading-relaxed">
                  Esto aplicará un strike al autor. 3 strikes = ban permanente.
                </p>
                <div>
                  <label className="text-xs font-semibold text-white mb-1.5 block">Motivo</label>
                  <textarea
                    value={fakeReason}
                    onChange={e => setFakeReason(e.target.value)}
                    placeholder="Describe por qué este reporte es falso..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-red-500 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setFlagFakeModal(null); setFakeReason(""); }}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white hover:bg-white/8 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button onClick={() => handleFlagFake(flagFakeModal.id)} disabled={flagging || !fakeReason.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-50 hover:bg-red-600"
                  >
                    {flagging ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    Marcar falso
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <DeleteConfirmModal
        deleteId={deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isPending={deleteReport.isPending}
      />

      <ContactNeighborModal
        report={contactReport ? getContactInfo(contactReport) : null}
        open={!!contactReport}
        onClose={() => setContactReport(null)}
        onSent={() => { setContactReport(null); onRefetch(); }}
      />
    </>
  );
}
