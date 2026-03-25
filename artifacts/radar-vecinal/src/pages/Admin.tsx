import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetReports, useUpdateReport, useDeleteReport, seedDemoData,
  ReportStatus, useGetUsers
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Shield, CheckCircle, XCircle, FileText,
  Users, AlertTriangle, Clock, Search,
  Trash2, Phone, Database, RotateCcw, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetStats } from "@workspace/api-client-react";
import { CATEGORY_CONFIG, CAT_HEX } from "@/lib/constants";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Activo",      color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  reviewing: { label: "En Revisión", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  resolved:  { label: "Resuelto",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  archived:  { label: "Archivado",   color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const ROLE_META: Record<string, { label: string; color: string }> = {
  admin:     { label: "Admin",       color: "#a855f7" },
  moderator: { label: "Moderador",   color: "#3b82f6" },
  user:      { label: "Usuario",     color: "#6b7280" },
};

type Tab = "reports" | "users";

export default function Admin() {
  const [tab, setTab]             = useState<Tab>("reports");
  const [search, setSearch]       = useState("");
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [seeding, setSeeding]     = useState(false);

  const { data: reportsData, refetch } = useGetReports();
  const { data: usersData }   = useGetUsers();
  const { data: stats }       = useGetStats();
  const updateReport  = useUpdateReport();
  const deleteReport  = useDeleteReport();
  const { toast }     = useToast();

  const handleStatus = (id: string, status: ReportStatus) => {
    updateReport.mutate({ id, data: { status } }, {
      onSuccess: () => { toast({ title: `Estado → "${STATUS_META[status]?.label}"` }); refetch(); }
    });
  };

  const handleDelete = (id: string) => {
    deleteReport.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Reporte eliminado", variant: "destructive" });
        setDeleteId(null);
        refetch();
      },
      onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
    });
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await seedDemoData();
      toast({ title: res.seeded ? "✅ Datos cargados" : "ℹ️ " + res.message, description: res.message });
      refetch();
    } catch {
      toast({ title: "Error al cargar datos", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const filteredReports = (reportsData?.reports ?? []).filter(r =>
    !search ||
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.sector.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = (usersData?.users ?? []).filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const KPI_CARDS = [
    { icon: FileText,      label: "Reportes Totales", value: stats?.totalReports ?? "—", color: "#3b82f6" },
    { icon: AlertTriangle, label: "Alertas Activas",  value: stats?.activeAlerts ?? "—", color: "#ef4444" },
    { icon: CheckCircle,   label: "Resueltos Hoy",    value: stats?.resolvedToday ?? "—", color: "#22c55e" },
    { icon: Users,         label: "Usuarios",          value: usersData?.users?.length ?? "—", color: "#a855f7" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Centro de Control</h2>
            <p className="text-sm text-muted-foreground">Gestión de incidentes, usuarios y moderación</p>
          </div>
        </div>

        {/* Seed button */}
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-all disabled:opacity-50"
        >
          {seeding
            ? <><div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /> Cargando...</>
            : <><Database className="w-4 h-4" /> Cargar datos demo</>
          }
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CARDS.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="p-4 rounded-xl bg-card border border-white/5 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}18` }}>
                <Icon className="w-5 h-5" style={{ color: kpi.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-white">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-0 border border-white/8 rounded-xl overflow-hidden p-0.5 bg-card w-fit">
          {(["reports", "users"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(""); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
              }`}
            >
              {t === "reports" ? <FileText className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              {t === "reports" ? "Reportes" : "Usuarios"}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === "reports" ? "Buscar reportes..." : "Buscar usuarios..."}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* ── Reports Table ── */}
      {tab === "reports" && (
        <div className="rounded-xl bg-card border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Incidente</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden md:table-cell">Sector</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden lg:table-cell">Hace</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Estado</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-8 h-8 text-muted-foreground/30" />
                        <p>No se encontraron reportes.</p>
                        <button onClick={handleSeed} className="text-primary text-xs hover:underline">
                          Cargar datos demo →
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredReports.map(r => {
                  const catConfig = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
                  const dotColor = CAT_HEX[r.category] ?? "#6b7280";
                  const status = STATUS_META[r.status] ?? STATUS_META.active;
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
                            <span className="font-medium text-white max-w-[200px] truncate block">{r.title}</span>
                            <span className="text-[10px] text-muted-foreground/50">{catConfig?.label ?? r.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{r.sector}</td>
                      <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">
                        {formatDistanceToNow(new Date(r.createdAt), { locale: es })}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: status.color, background: status.bg }}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">

                          {/* Call button — only if report has a contact phone */}
                          {(r as any).contactPhone && (
                            <a
                              href={`tel:${(r as any).contactPhone}`}
                              title={`Llamar: ${(r as any).contactPhone}`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}

                          {/* Resolve */}
                          {r.status !== "resolved" && (
                            <button
                              onClick={() => handleStatus(r.id, ReportStatus.resolved)}
                              title="Marcar como resuelto"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-green-500 hover:bg-green-500/15 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Reviewing */}
                          {r.status !== "reviewing" && r.status !== "resolved" && (
                            <button
                              onClick={() => handleStatus(r.id, ReportStatus.reviewing)}
                              title="Poner en revisión"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-yellow-500 hover:bg-yellow-500/15 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          {/* Archive */}
                          {r.status === "resolved" && (
                            <button
                              onClick={() => handleStatus(r.id, ReportStatus.archived)}
                              title="Archivar"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-white/8 transition-colors"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete — with confirmation */}
                          <button
                            onClick={() => setDeleteId(r.id)}
                            title="Eliminar reporte"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500/60 hover:text-red-500 hover:bg-red-500/15 transition-colors"
                          >
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
      )}

      {/* ── Users Table ── */}
      {tab === "users" && (
        <div className="rounded-xl bg-card border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Usuario</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden md:table-cell">Sector</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Rol</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Reportes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground text-sm">No se encontraron usuarios</td>
                  </tr>
                ) : filteredUsers.map(u => {
                  const role = ROLE_META[u.role ?? "user"] ?? ROLE_META.user;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.025] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{u.name}</p>
                            <p className="text-[10px] text-muted-foreground/60 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{u.sector}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{ color: role.color, background: `${role.color}20` }}>
                          {role.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-white font-semibold">{u.reportsCount ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0f1219] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Eliminar reporte</h3>
                  <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                ¿Estás seguro de que deseas eliminar este reporte permanentemente del sistema?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-muted-foreground hover:text-white hover:border-white/20 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  disabled={deleteReport.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-sm font-bold text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                >
                  {deleteReport.isPending
                    ? <span className="flex items-center justify-center gap-1.5"><div className="w-3.5 h-3.5 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" /> Eliminando...</span>
                    : "Sí, eliminar"
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
