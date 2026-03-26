import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetReports, useUpdateReport, useDeleteReport,
  ReportStatus, useGetUsers
} from "@workspace/api-client-react";

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Shield, CheckCircle, XCircle, FileText,
  Users, AlertTriangle, Clock, Search,
  Trash2, Phone, Database, Eye, Lock, KeyRound,
  Megaphone, Plus, Link as LinkIcon, ToggleLeft, ToggleRight, Edit3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetStats } from "@workspace/api-client-react";
import { CATEGORY_CONFIG, CAT_HEX } from "@/lib/constants";

const seedDemoData = async (): Promise<{ seeded: boolean; message: string }> => {
  const res = await fetch("/api/reports/seed", { method: "POST" });
  if (!res.ok) throw new Error("seed failed");
  return res.json();
};

// B-04: Simple PIN gate — stored in session so it clears on tab close
const ADMIN_PIN = "admin2024";
const SESSION_KEY = "radar_admin_unlocked";

function AdminPin({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onUnlock();
    } else {
      setError(true);
      setPin("");
      toast({ title: "PIN incorrecto", description: "Verifica el código de acceso.", variant: "destructive" });
      setTimeout(() => setError(false), 1000);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className={`rounded-2xl bg-card border p-8 flex flex-col items-center gap-5 transition-all ${error ? "border-red-500/60" : "border-white/8"}`}>
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-accent" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-1">Acceso Restringido</h2>
            <p className="text-sm text-muted-foreground">Ingresa el PIN de administrador para continuar.</p>
          </div>
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="PIN de acceso"
              autoFocus
              className={`w-full text-center text-xl font-bold tracking-[0.3em] bg-background border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground/40 focus:outline-none transition-colors ${
                error ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-primary"
              }`}
            />
            <button
              type="submit"
              disabled={pin.length < 4}
              className="w-full py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-40"
            >
              <Lock className="w-4 h-4 inline mr-2" />
              Desbloquear panel
            </button>
          </form>
          <p className="text-[10px] text-muted-foreground/40 text-center">
            Solo personal autorizado de Radar Vecinal
          </p>
        </div>
      </motion.div>
    </div>
  );
}

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

type Tab = "reports" | "users" | "ads";

// B-26: Ad slot data structure
interface AdSlot {
  id: string;
  label: string;
  position: string;
  client: string;
  url: string;
  active: boolean;
  impressions: number;
  clicks: number;
}

const DEMO_AD_SLOTS: AdSlot[] = [
  { id: "ad1", label: "Banner Superior", position: "home_top",      client: "Ferretería San Ramón",  url: "https://example.com/fsr",   active: true,  impressions: 4820, clicks: 93 },
  { id: "ad2", label: "Tarjeta Mapa",    position: "map_card",      client: "Farmacia Cruz Verde",   url: "https://example.com/cv",    active: true,  impressions: 2115, clicks: 41 },
  { id: "ad3", label: "Banner Historial",position: "history_mid",   client: "Banco de Crédito BCP",  url: "https://example.com/bcp",   active: false, impressions: 0,    clicks: 0  },
  { id: "ad4", label: "Notificaciones",  position: "notif_footer",  client: "Disponible",            url: "",                          active: false, impressions: 0,    clicks: 0  },
];

function AdminPanel() {
  const [tab, setTab]             = useState<Tab>("reports");
  const [search, setSearch]       = useState("");
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [seeding, setSeeding]     = useState(false);
  // B-26: Ad slots state
  const [adSlots, setAdSlots]     = useState<AdSlot[]>(DEMO_AD_SLOTS);
  const [editingAd, setEditingAd] = useState<AdSlot | null>(null);

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
      toast({ title: res.seeded ? "Datos cargados" : "ℹ️ " + res.message, description: res.message });
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
          {([
            { id: "reports", label: "Reportes",   icon: FileText  },
            { id: "users",   label: "Usuarios",   icon: Users     },
            { id: "ads",     label: "Publicidad", icon: Megaphone },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSearch(""); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.id ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab !== "ads" && (
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === "reports" ? "Buscar reportes..." : "Buscar usuarios..."}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        )}
      </div>

      {/* ── Reports: desktop table / mobile cards (B-06) ── */}
      {tab === "reports" && (
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
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: status.color, background: status.bg }}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {(r as any).contactPhone && (
                              <a href={`tel:${(r as any).contactPhone}`} title={`Llamar: ${(r as any).contactPhone}`}
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

          {/* Mobile cards (B-06) */}
          <div className="md:hidden flex flex-col gap-2">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-card border border-white/5 text-muted-foreground text-sm flex flex-col items-center gap-2">
                <FileText className="w-7 h-7 text-muted-foreground/30" />
                No se encontraron reportes.
              </div>
            ) : filteredReports.map(r => {
              const catConfig = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
              const dotColor  = CAT_HEX[r.category] ?? "#6b7280";
              const status    = STATUS_META[r.status] ?? STATUS_META.active;
              const Icon      = catConfig?.icon;
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
                      style={{ color: status.color, background: status.bg }}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 border-t border-white/5 pt-2.5">
                    {(r as any).contactPhone && (
                      <a href={`tel:${(r as any).contactPhone}`}
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
        </>
      )}

      {/* ── Users: desktop table / mobile cards (B-06) ── */}
      {tab === "users" && (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-xl bg-card border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Usuario</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest hidden lg:table-cell">Sector</th>
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
                        <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell text-xs">{u.sector}</td>
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

          {/* Mobile cards (B-06) */}
          <div className="md:hidden flex flex-col gap-2">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-card border border-white/5 text-muted-foreground text-sm">No se encontraron usuarios</div>
            ) : filteredUsers.map(u => {
              const role = ROLE_META[u.role ?? "user"] ?? ROLE_META.user;
              return (
                <div key={u.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{u.email}</p>
                    <p className="text-[10px] text-muted-foreground/40">{u.sector}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: role.color, background: `${role.color}20` }}>
                      {role.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{u.reportsCount ?? 0} rep.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── B-26: Ad Slots Tab ── */}
      {tab === "ads" && (
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Espacios Publicitarios</p>
              <p className="text-xs text-muted-foreground">Gestiona los espacios de publicidad local disponibles en la app.</p>
            </div>
            <button
              onClick={() => {
                const newSlot: AdSlot = {
                  id: `ad${Date.now()}`,
                  label: "Nuevo Banner",
                  position: "custom",
                  client: "Disponible",
                  url: "",
                  active: false,
                  impressions: 0,
                  clicks: 0,
                };
                setAdSlots(prev => [...prev, newSlot]);
                setEditingAd(newSlot);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo espacio
            </button>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Activos",     value: adSlots.filter(a => a.active).length,              color: "#22c55e" },
              { label: "Impresiones", value: adSlots.reduce((s, a) => s + a.impressions, 0).toLocaleString(), color: "#3b82f6" },
              { label: "Clics",       value: adSlots.reduce((s, a) => s + a.clicks, 0),         color: "#a855f7" },
            ].map(kpi => (
              <div key={kpi.label} className="p-3 rounded-xl bg-card border border-white/5 text-center">
                <p className="text-xl font-bold text-white">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Ad Slot Cards */}
          <div className="flex flex-col gap-2">
            {adSlots.map(slot => {
              const ctr = slot.impressions > 0 ? ((slot.clicks / slot.impressions) * 100).toFixed(1) : "0.0";
              return (
                <div key={slot.id} className="p-4 rounded-xl bg-card border border-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Status toggle */}
                  <button
                    onClick={() => setAdSlots(prev => prev.map(a => a.id === slot.id ? { ...a, active: !a.active } : a))}
                    className="flex-shrink-0"
                  >
                    {slot.active
                      ? <ToggleRight className="w-7 h-7 text-green-400" />
                      : <ToggleLeft  className="w-7 h-7 text-muted-foreground" />
                    }
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white truncate">{slot.label}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        slot.active
                          ? "bg-green-500/15 text-green-400"
                          : "bg-white/5 text-muted-foreground"
                      }`}>
                        {slot.active ? "Activo" : "Pausado"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{slot.client}</p>
                    {slot.url && (
                      <a href={slot.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-primary/60 hover:text-primary transition-colors mt-0.5">
                        <LinkIcon className="w-3 h-3" />
                        <span className="truncate">{slot.url}</span>
                      </a>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-4 text-center flex-shrink-0">
                    <div>
                      <p className="text-xs font-bold text-white">{slot.impressions.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Impr.</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{slot.clicks}</p>
                      <p className="text-[10px] text-muted-foreground">Clics</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{ctr}%</p>
                      <p className="text-[10px] text-muted-foreground">CTR</p>
                    </div>
                  </div>

                  {/* Edit */}
                  <button
                    onClick={() => setEditingAd({ ...slot })}
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/20 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── B-26: Edit Ad Slot Modal ── */}
      <AnimatePresence>
        {editingAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setEditingAd(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Megaphone className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="font-bold text-white">Editar espacio publicitario</h3>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { label: "Nombre del banner",  field: "label",    type: "text",  placeholder: "Ej. Banner Superior" },
                  { label: "Posición (código)",   field: "position", type: "text",  placeholder: "Ej. home_top" },
                  { label: "Cliente / Anunciante",field: "client",   type: "text",  placeholder: "Nombre del anunciante" },
                  { label: "URL de destino",      field: "url",      type: "url",   placeholder: "https://..." },
                ].map(({ label, field, type, placeholder }) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-white/70 mb-1">{label}</label>
                    <input
                      type={type}
                      value={(editingAd as any)[field]}
                      onChange={e => setEditingAd(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
                  <span className="text-sm text-white font-medium">Estado activo</span>
                  <button
                    onClick={() => setEditingAd(prev => prev ? { ...prev, active: !prev.active } : prev)}
                    className="relative"
                  >
                    {editingAd.active
                      ? <ToggleRight className="w-7 h-7 text-green-400" />
                      : <ToggleLeft  className="w-7 h-7 text-muted-foreground" />
                    }
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setEditingAd(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-muted-foreground hover:text-white transition-all">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setAdSlots(prev => prev.map(a => a.id === editingAd.id ? editingAd : a));
                    setEditingAd(null);
                    toast({ title: "Espacio actualizado", description: `"${editingAd.label}" guardado correctamente.` });
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-sm font-bold text-primary hover:bg-primary/30 transition-all"
                >
                  Guardar cambios
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                ¿Estás seguro de que deseas eliminar este reporte permanentemente?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-muted-foreground hover:text-white hover:border-white/20 transition-all">
                  Cancelar
                </button>
                <button onClick={() => handleDelete(deleteId)} disabled={deleteReport.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-sm font-bold text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50">
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

export default function Admin() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "1"
  );

  if (!unlocked) {
    return <AdminPin onUnlock={() => setUnlocked(true)} />;
  }

  return <AdminPanel />;
}
