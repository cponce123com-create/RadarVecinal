import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldCheck, Eye, EyeOff, UserPlus, X, Loader2, Check, Trash2,
  Users, Calendar, Activity, MessageSquare, CheckCircle, Search, Filter,
  AlertTriangle, Gavel, Ban,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  sector: string;
  district: string;
  districtId: number;
  isActive: boolean;
  status?: "active" | "suspended" | "banned";
  reportsCount: number;
  trustScore: number;
  suspendedUntil: string | null;
  createdAt: string;
}

type StatusFilter = "all" | "active" | "suspended" | "banned";
type RoleFilter = "all" | "user" | "moderator" | "admin" | "super_admin";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activos" },
  { id: "suspended", label: "Suspendidos" },
  { id: "banned", label: "Baneados" },
];

interface UserStats {
  totalActions: number;
  resolvedReports: number;
  messagesSent: number;
}

interface Strike {
  id: string;
  userId: string;
  reportId: string;
  reportTitle: string;
  motivo: string;
  adminName: string;
  adminId: string;
  activo: boolean;
  createdAt: string;
  expiresAt: string | null;
}

const ROLE_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  super_admin: { icon: ShieldCheck, label: "Superadmin", color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
  admin:       { icon: Shield,      label: "Admin",      color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  moderator:   { icon: Eye,         label: "Moderador",  color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  user:        { icon: Users,       label: "Vecino",     color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
};

function getTrustScoreMeta(score: number): { color: string; bg: string; label: string } {
  if (score < 30) return { color: "#ef4444", bg: "rgba(239,68,68,0.15)", label: "Bajo" };
  if (score <= 60) return { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: "Medio" };
  return { color: "#22c55e", bg: "rgba(34,197,94,0.15)", label: "Alto" };
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3 } }),
};

export default function UsersTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [strikeModalUser, setStrikeModalUser] = useState<User | null>(null);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [loadingStrikes, setLoadingStrikes] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Los filtros de estado/rol se resuelven en el BACKEND (los suspendidos/
  // baneados pueden estar fuera de la ventana de los primeros resultados). La
  // búsqueda de texto se refina localmente para respuesta instantánea.
  const { data, isLoading } = useQuery<{ users: User[]; total?: number }>({
    queryKey: ["admin-users", statusFilter, roleFilter],
    queryFn: async () => {
      const token = localStorage.getItem("radarvecinal_token");
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (roleFilter !== "all") params.set("role", roleFilter);
      const res = await fetch(`/api/users?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al cargar usuarios");
      return res.json();
    },
  });

  const createUser = useMutation({
    mutationFn: async (userData: any) => {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch("/api/users/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear usuario");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreate(false);
      toast({ title: "✅ Usuario creado", description: "La cuenta ha sido creada correctamente." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/users/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Estado actualizado" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const liftSuspension = useMutation({
    mutationFn: async (userId: string) => {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/users/${userId}/lift-suspension`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al levantar suspensión");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "✅ Suspensión levantada" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeStrike = useMutation({
    mutationFn: async (strikeId: string) => {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/reports/strikes/${strikeId}/revoke`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al revocar strike");
      return res.json();
    },
    onSuccess: (_data, strikeId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setStrikes(prev => prev.map(s => s.id === strikeId ? { ...s, activo: false } : s));
      toast({ title: "✅ Strike revocado", description: "TrustScore restaurado en +20" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const loadStrikes = async (userId: string) => {
    setLoadingStrikes(true);
    try {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/users/${userId}/strikes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setStrikes(data.strikes ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStrikes(false);
    }
  };

  const openStrikeModal = (user: User) => {
    setStrikeModalUser(user);
    loadStrikes(user.id);
  };

  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "admin", sector: "" });
  // Estado/rol ya vienen filtrados por el backend; aquí solo refinamos por texto.
  const q = search.trim().toLowerCase();
  const filtered = (data?.users ?? []).filter(u =>
    !q ||
    u.name.toLowerCase().includes(q) ||
    (u.email ?? "").toLowerCase().includes(q) ||
    u.role.toLowerCase().includes(q) ||
    (u.sector ?? "").toLowerCase().includes(q)
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.sector) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    createUser.mutate(formData);
  };

  const isSuspended = (user: User) => user.suspendedUntil && new Date(user.suspendedUntil) > new Date();
  const activeStrikesCount = (userId: string) => strikes.filter(s => s.activo).length;

  return (
    <div className="flex flex-col gap-4 rv-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] font-bold text-white">Gestión de Usuarios</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data?.total ?? data?.users?.length ?? 0} usuarios
            {statusFilter !== "all" || roleFilter !== "all" ? " (filtrados)" : " registrados"}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-primary to-[#1e52d6] text-white text-xs font-semibold transition-all hover:opacity-90">
          <UserPlus className="w-4 h-4" /> Crear usuario
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, correo, rol o sector..."
          className="w-full bg-card border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Filtros de moderación: estado + rol (resueltos en el backend) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                statusFilter === f.id
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-card text-muted-foreground border-white/10 hover:text-white"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as RoleFilter)}
            className="appearance-none bg-card border border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white focus:outline-none focus:border-primary">
            <option value="all">Todos los roles</option>
            <option value="user">Vecinos</option>
            <option value="moderator">Moderadores</option>
            <option value="admin">Admins</option>
            <option value="super_admin">Superadmins</option>
          </select>
        </div>
      </div>

      {/* Modal crear usuario */}
      <AnimatePresence>
        {showCreate && (
          <>
            <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowCreate(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-4 md:inset-auto md:top-[10%] md:left-1/2 md:-translate-x-1/2 md:w-[440px] z-50 bg-[#0b0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div className="flex items-center gap-2.5">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <span className="font-display font-bold text-white">Nuevo Usuario</span>
                </div>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white mb-1.5 block">Nombre completo</label>
                  <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ej: Juan Pérez" required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white mb-1.5 block">Correo electrónico</label>
                  <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="Ej: admin@mdsr.gob.pe" required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white mb-1.5 block">Contraseña</label>
                  <input type="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres" required minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white mb-1.5 block">Rol</label>
                  <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary">
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderador</option>
                    <option value="user">Vecino</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-white mb-1.5 block">Sector</label>
                  <input type="text" value={formData.sector} onChange={e => setFormData(p => ({ ...p, sector: e.target.value }))}
                    placeholder="Ej: San Ramón Centro" required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  />
                </div>
                <button type="submit" disabled={createUser.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-primary to-[#1e52d6] text-white text-sm font-semibold transition-all disabled:opacity-50">
                  {createUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Crear usuario
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-card animate-pulse border border-white/5" />)}
        </div>
      )}

      {/* Lista de usuarios */}
      {!isLoading && (
        <div className="space-y-2">
          {filtered.map((user, i) => {
            const roleMeta = ROLE_META[user.role] ?? ROLE_META.user;
            const Icon = roleMeta.icon;
            const expanded = expandedUser === user.id;
            const trustMeta = getTrustScoreMeta(user.trustScore);
            const suspended = isSuspended(user);
            return (
              <motion.div key={user.id} custom={i} variants={cardVariants} initial="hidden" animate="visible">
                <div className="rounded-2xl bg-gradient-to-b from-card to-sidebar border border-white/6 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedUser(expanded ? null : user.id)}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: roleMeta.bg }}>
                      <Icon className="w-5 h-5" style={{ color: roleMeta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">{user.name}</span>
                        <span className="label-mono text-[9px] px-2 py-0.5 rounded-full" style={{ background: roleMeta.bg, color: roleMeta.color }}>
                          {roleMeta.label}
                        </span>
                        {/* FASE 5: Trust Score badge */}
                        <span className="label-mono text-[9px] px-2 py-0.5 rounded-full"
                          style={{ color: trustMeta.color, background: trustMeta.bg }}>
                          Trust: {user.trustScore}
                        </span>
                        {!user.isActive && (
                          <span className="label-mono text-[9px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                            INACTIVO
                          </span>
                        )}
                        {suspended && (
                          <span className="label-mono text-[9px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">
                            SUSPENDIDO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email} · {user.sector}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* FASE 5: Ver strikes button */}
                      <button onClick={e => { e.stopPropagation(); openStrikeModal(user); }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Ver strikes">
                        <Gavel className="w-4 h-4" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggleStatus.mutate({ id: user.id, isActive: !user.isActive }); }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
                        title={user.isActive ? "Desactivar" : "Activar"}>
                        {user.isActive ? <Eye className="w-4 h-4 text-green-400/60" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* FASE 5: Expanded panel with stats + strike info */}
                  {expanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-white/5">
                      <UserStatsPanel userId={user.id} userName={user.name} />
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3">
                        <button onClick={() => openStrikeModal(user)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                          <Gavel className="w-3.5 h-3.5" /> Ver strikes
                        </button>
                        {suspended && (
                          <button onClick={() => liftSuspension.mutate(user.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-colors">
                            <Ban className="w-3.5 h-3.5" /> Levantar suspensión
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 flex flex-col items-center text-center">
              <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No se encontraron usuarios</p>
            </div>
          )}
        </div>
      )}

      {/* FASE 5: Strike History Modal */}
      <AnimatePresence>
        {strikeModalUser && (
          <>
            <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setStrikeModalUser(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-4 md:inset-auto md:top-[10%] md:left-1/2 md:-translate-x-1/2 md:w-[560px] max-h-[80vh] z-50 bg-[#0b0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <Gavel className="w-5 h-5 text-red-400" />
                  <span className="font-display font-bold text-white">Historial de Strikes</span>
                </div>
                <button onClick={() => setStrikeModalUser(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 flex-shrink-0 border-b border-white/5">
                <p className="text-sm text-white font-semibold">{strikeModalUser.name}</p>
                <p className="text-xs text-muted-foreground">TrustScore: {strikeModalUser.trustScore}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingStrikes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : strikes.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mb-2 text-green-400/50" />
                    <p className="text-sm">No tiene strikes</p>
                  </div>
                ) : strikes.map(strike => (
                  <div key={strike.id}
                    className={`p-3 rounded-xl border ${
                      strike.activo
                        ? "bg-red-500/8 border-red-500/20"
                        : "bg-white/[0.02] border-white/5 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            strike.activo
                              ? "bg-red-500/15 text-red-400"
                              : "bg-green-500/15 text-green-400"
                          }`}>
                            {strike.activo ? "Activo" : "Revocado"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(strike.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                          </span>
                        </div>
                        <p className="text-xs text-white font-medium mb-0.5">{strike.motivo}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Reporte: <span className="text-white/70">{strike.reportTitle}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Admin: {strike.adminName}
                        </p>
                      </div>
                      {strike.activo && (
                        <button
                          onClick={() => revokeStrike.mutate(strike.id)}
                          disabled={revokeStrike.isPending}
                          className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                          title="Revocar strike"
                        >
                          Revocar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserStatsPanel({ userId, userName }: { userId: string; userName: string }) {
  const { data, isLoading } = useQuery<UserStats>({
    queryKey: ["user-stats", userId],
    queryFn: async () => {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch(`/api/users/${userId}/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  if (isLoading) return <div className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />;

  const stats = [
    { label: "Acciones totales", value: data?.totalActions ?? 0, icon: Activity, color: "#3b82f6" },
    { label: "Reportes resueltos", value: data?.resolvedReports ?? 0, icon: CheckCircle, color: "#22c55e" },
    { label: "Mensajes enviados", value: data?.messagesSent ?? 0, icon: MessageSquare, color: "#a855f7" },
  ];

  return (
    <div>
      <p className="label-mono text-[9px] text-muted-foreground/50 mb-2.5">DESEMPEÑO · {userName.toUpperCase()}</p>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/6 flex flex-col items-center text-center">
              <Icon className="w-4 h-4 mb-1.5" style={{ color: s.color }} />
              <span className="font-display text-lg font-bold text-white">{s.value}</span>
              <span className="label-mono text-[8px] text-muted-foreground/60 mt-0.5">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
