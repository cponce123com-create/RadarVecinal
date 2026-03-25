import { useState } from "react";
import { motion } from "framer-motion";
import {
  useGetReports, useUpdateReport, ReportStatus, useGetUsers
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Shield, CheckCircle, XCircle, FileText,
  Users, AlertTriangle, TrendingUp, Clock,
  Search, ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetStats } from "@workspace/api-client-react";

const CATEGORY_DOT_COLORS: Record<string, string> = {
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

const ROLE_META: Record<string, { label: string; color: string }> = {
  admin:     { label: "Admin",       color: "#a855f7" },
  moderator: { label: "Moderador",   color: "#3b82f6" },
  user:      { label: "Usuario",     color: "#6b7280" },
};

type Tab = "reports" | "users";

export default function Admin() {
  const [tab, setTab] = useState<Tab>("reports");
  const [search, setSearch] = useState("");
  const { data: reportsData, refetch } = useGetReports();
  const { data: usersData } = useGetUsers();
  const { data: stats } = useGetStats();
  const updateReport = useUpdateReport();
  const { toast } = useToast();

  const handleStatus = (id: string, status: ReportStatus) => {
    updateReport.mutate({ id, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Estado cambiado a "${STATUS_META[status]?.label}"` });
        refetch();
      }
    });
  };

  const filteredReports = (reportsData?.reports ?? []).filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.sector.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = (usersData?.users ?? []).filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const KPI_CARDS = [
    { icon: FileText, label: "Reportes Totales", value: stats?.totalReports ?? "—", color: "#3b82f6" },
    { icon: AlertTriangle, label: "Alertas Activas", value: stats?.activeAlerts ?? "—", color: "#ef4444" },
    { icon: CheckCircle, label: "Resueltos Hoy", value: stats?.resolvedToday ?? "—", color: "#22c55e" },
    { icon: Users, label: "Usuarios", value: usersData?.users?.length ?? "—", color: "#a855f7" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white">Centro de Control</h2>
          <p className="text-sm text-muted-foreground">Gestión de incidentes, usuarios y moderación</p>
        </div>
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
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${kpi.color}18` }}
              >
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

        <div className="flex items-center gap-2 flex-1 max-w-sm ml-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === "reports" ? "Buscar reportes..." : "Buscar usuarios..."}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* ── Reports Table ── */}
      {tab === "reports" && (
        <div className="rounded-xl bg-card border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Incidente</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden md:table-cell">Sector</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden lg:table-cell">Hace</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Estado</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground text-sm">
                      No se encontraron reportes
                    </td>
                  </tr>
                ) : filteredReports.map(r => {
                  const dotColor = CATEGORY_DOT_COLORS[r.category] ?? "#6b7280";
                  const status = STATUS_META[r.status] ?? STATUS_META.active;
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.025] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                          <span className="font-medium text-white max-w-[160px] truncate">{r.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell text-xs">{r.sector}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">
                        {formatDistanceToNow(new Date(r.createdAt), { locale: es })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{ color: status.color, background: status.bg }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {r.status !== "resolved" && (
                            <button
                              onClick={() => handleStatus(r.id, ReportStatus.resolved)}
                              title="Marcar como resuelto"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-green-500 hover:bg-green-500/15 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {r.status !== "reviewing" && r.status !== "resolved" && (
                            <button
                              onClick={() => handleStatus(r.id, ReportStatus.reviewing)}
                              title="Poner en revisión"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-yellow-500 hover:bg-yellow-500/15 transition-colors"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}
                          {r.status !== "archived" && (
                            <button
                              onClick={() => handleStatus(r.id, ReportStatus.archived)}
                              title="Archivar"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-white/8 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-white/5 text-xs text-muted-foreground">
            {filteredReports.length} registro{filteredReports.length !== 1 ? "s" : ""}
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
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Usuario</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden md:table-cell">Sector</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Rol</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden lg:table-cell">Reportes</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground text-sm">
                      No se encontraron usuarios
                    </td>
                  </tr>
                ) : filteredUsers.map(u => {
                  const role = ROLE_META[u.role] ?? ROLE_META.user;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.025] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{u.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs hidden md:table-cell">{u.sector}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{ color: role.color, background: `${role.color}18` }}
                        >
                          {role.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">{u.reportsCount}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                          u.isActive
                            ? "text-green-400 bg-green-500/12"
                            : "text-red-400 bg-red-500/12"
                        }`}>
                          {u.isActive ? "Activo" : "Bloqueado"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-white/5 text-xs text-muted-foreground">
            {filteredUsers.length} usuario{filteredUsers.length !== 1 ? "s" : ""} registrado{filteredUsers.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
