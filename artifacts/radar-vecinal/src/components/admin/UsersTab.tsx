import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldCheck, Eye, EyeOff, UserPlus, X, Loader2, Check, Trash2,
  Users, Calendar, Activity, MessageSquare, CheckCircle, Search, Filter,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
  reportsCount: number;
  createdAt: string;
}

interface UserStats {
  totalActions: number;
  resolvedReports: number;
  messagesSent: number;
}

const ROLE_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  super_admin: { icon: ShieldCheck, label: "Superadmin", color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
  admin:       { icon: Shield,      label: "Admin",      color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  moderator:   { icon: Eye,         label: "Moderador",  color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  user:        { icon: Users,       label: "Vecino",     color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3 } }),
};

export default function UsersTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const token = localStorage.getItem("radarvecinal_token");
      const res = await fetch("/api/users", {
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

  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "admin", sector: "" });
  const filtered = (data?.users ?? []).filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.includes(search.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.sector) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    createUser.mutate(formData);
  };

  return (
    <div className="flex flex-col gap-4 rv-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] font-bold text-white">Gestión de Usuarios</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data?.users.length ?? 0} usuarios registrados
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
          placeholder="Buscar por nombre, correo o rol..."
          className="w-full bg-card border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
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
            return (
              <motion.div key={user.id} custom={i} variants={cardVariants} initial="hidden" animate="visible">
                <div className="rounded-2xl bg-gradient-to-b from-card to-sidebar border border-white/6 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedUser(expanded ? null : user.id)}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: roleMeta.bg }}>
                      <Icon className="w-5 h-5" style={{ color: roleMeta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{user.name}</span>
                        <span className="label-mono text-[9px] px-2 py-0.5 rounded-full" style={{ background: roleMeta.bg, color: roleMeta.color }}>
                          {roleMeta.label}
                        </span>
                        {!user.isActive && (
                          <span className="label-mono text-[9px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                            INACTIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email} · {user.sector}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={e => { e.stopPropagation(); toggleStatus.mutate({ id: user.id, isActive: !user.isActive }); }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
                        title={user.isActive ? "Desactivar" : "Activar"}>
                        {user.isActive ? <Eye className="w-4 h-4 text-green-400/60" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Panel expandido con estadísticas */}
                  {expanded && <UserStatsPanel userId={user.id} userName={user.name} />}
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

  if (isLoading) return <div className="px-4 pb-4"><div className="h-16 rounded-xl bg-white/[0.03] animate-pulse" /></div>;

  const stats = [
    { label: "Acciones totales", value: data?.totalActions ?? 0, icon: Activity, color: "#3b82f6" },
    { label: "Reportes resueltos", value: data?.resolvedReports ?? 0, icon: CheckCircle, color: "#22c55e" },
    { label: "Mensajes enviados", value: data?.messagesSent ?? 0, icon: MessageSquare, color: "#a855f7" },
  ];

  return (
    <div className="px-4 pb-4 pt-1 border-t border-white/5">
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
