import { useState, useMemo } from "react";
import { Siren, AlertTriangle, Heart, Users, Flame, UserX, Zap, MapPin, Clock, CheckCircle2, XCircle, Trash2, MessageSquare, Loader2, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useDistrict } from "@/contexts/DistrictContext";

const PANIC_META: Record<string, { icon: any; label: string; color: string }> = {
  robbery:        { icon: AlertTriangle, label: "Asalto",       color: "#ef4444" },
  medical:        { icon: Heart,         label: "Médica",        color: "#3b82f6" },
  fight:          { icon: Users,         label: "Pelea",         color: "#f97316" },
  fire:           { icon: Flame,         label: "Incendio",      color: "#f59e0b" },
  missing_person: { icon: UserX,         label: "Desaparecido",  color: "#8b5cf6" },
  other:          { icon: Zap,           label: "Otra",          color: "#a855f7" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  active:      { label: "Activa",      color: "#ef4444" },
  attending:   { label: "En Atención", color: "#f59e0b" },
  resolved:    { label: "Resuelta",    color: "#22c55e" },
  false_alarm: { label: "Falsa",       color: "#6b7280" },
  expired:     { label: "Expirada",    color: "#6b7280" },
};

const STATUSES = ["active", "attending", "resolved", "false_alarm", "expired"];
const TYPES = Object.keys(PANIC_META);

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("radarvecinal_token") || "";
}

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export default function AlertsTab() {
  const { user, isSuperAdmin } = useAuth();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [resolveModal, setResolveModal] = useState<{ id: string; action: "resolved" | "false_alarm" } | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [purgeModal, setPurgeModal] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch alerts (with district filter for admin, no filter for super_admin)
  const params = new URLSearchParams();
  if (!isSuperAdmin && currentDistrictId) params.set("districtId", String(currentDistrictId));
  if (filterStatus) params.set("status", filterStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["panic-alerts", currentDistrictId, filterStatus],
    queryFn: () => api(`/api/panic-alerts?${params.toString()}`),
  });
  const alerts: any[] = data?.alerts ?? [];

  const filtered = useMemo(() => {
    let items = alerts;
    if (filterType) items = items.filter(a => a.type === filterType);
    return items;
  }, [alerts, filterType]);

  const counts = useMemo(() => {
    return {
      active: alerts.filter((a: any) => a.status === "active" || a.isActive).length,
      attending: alerts.filter((a: any) => a.status === "attending").length,
      resolved: alerts.filter((a: any) => a.status === "resolved").length,
      falseAlarms: alerts.filter((a: any) => a.status === "false_alarm").length,
    };
  }, [alerts]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["panic-alerts"] });
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, resolutionNote }: { id: string; status: string; resolutionNote?: string }) => {
      return api(`/api/panic-alerts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, resolutionNote }),
      });
    },
    onSuccess: () => { invalidate(); setResolveModal(null); setResolveNote(""); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api(`/api/panic-alerts/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); setDeleteConfirm(null); },
  });

  const purgeMutation = useMutation({
    mutationFn: async () => {
      const body: any = { confirm: "ELIMINAR_TODO" };
      if (!isSuperAdmin && currentDistrictId) body.districtId = currentDistrictId;
      return api("/api/panic-alerts/purge", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { invalidate(); setPurgeModal(false); setPurgeConfirm(""); },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Counters */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Activas", count: counts.active, color: "#ef4444" },
          { label: "En Atención", count: counts.attending, color: "#f59e0b" },
          { label: "Resueltas Hoy", count: counts.resolved, color: "#22c55e" },
          { label: "Falsas", count: counts.falseAlarms, color: "#6b7280" },
        ].map(c => (
          <div key={c.label} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-black/20 border border-white/5">
            <span className="text-2xl font-bold" style={{ color: c.color }}>{c.count}</span>
            <span className="text-[10px] text-muted-foreground label-mono">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/8 text-xs text-white">
          <option value="">Todos los estados</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
          ))}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/8 text-xs text-white">
          <option value="">Todos los tipos</option>
          {TYPES.map(t => (
            <option key={t} value={t}>{PANIC_META[t]?.label ?? t}</option>
          ))}
        </select>

        {isSuperAdmin && (
          <button onClick={() => setPurgeModal(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-all">
            <Trash2 className="w-3 h-3" /> Limpiar historial
          </button>
        )}
      </div>

      {/* List */}
      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-card animate-pulse border border-white/5" />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">Sin alertas para mostrar.</div>
      )}

      {!isLoading && filtered.map((alert: any) => {
        const meta = PANIC_META[alert.type] ?? PANIC_META.other;
        const Icon = meta.icon;
        const statusMeta = STATUS_META[alert.status] ?? STATUS_META.active;
        const Icon2 = statusMeta.label === "Activa" || statusMeta.label === "En Atención"
          ? (alert.status === "attending" ? Users : AlertTriangle) : CheckCircle2;

        return (
          <div key={alert.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-white/5 hover:bg-white/[0.02] transition-all">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}18` }}>
              <Icon className="w-[18px] h-[18px]" style={{ color: meta.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{meta.label}</span>
                <span className="text-[9px] label-mono px-1.5 py-0.5 rounded-full" style={{ color: statusMeta.color, background: `${statusMeta.color}18` }}>
                  {statusMeta.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {alert.sector}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(alert.createdAt), { locale: es, addSuffix: true })}
                </span>
                <span>por {alert.authorName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {alert.status === "active" && (
                <button onClick={() => updateMutation.mutate({ id: alert.id, status: "attending" })}
                  disabled={updateMutation.isPending}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold hover:bg-amber-500/20 transition-all">
                  Atender
                </button>
              )}
              {(alert.status === "active" || alert.status === "attending") && (
                <>
                  <button onClick={() => setResolveModal({ id: alert.id, action: "resolved" })}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20 transition-all">
                    Resolver
                  </button>
                  <button onClick={() => setResolveModal({ id: alert.id, action: "false_alarm" })}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-500/10 border border-gray-500/30 text-gray-400 text-[10px] font-semibold hover:bg-gray-500/20 transition-all">
                    Falsa
                  </button>
                </>
              )}
              {isSuperAdmin && (
                <button onClick={() => setDeleteConfirm(alert.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Resolve Modal */}
      {resolveModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setResolveModal(null)} />
          <div className="fixed z-51 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-3">
              {resolveModal.action === "resolved" ? "Resolver alerta" : "Marcar como falsa alarma"}
            </h3>
            <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)}
              placeholder="Nota sobre la resolución (opcional)..."
              className="w-full h-24 px-3 py-2 rounded-xl bg-black/30 border border-white/8 text-sm text-white placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-primary/50" />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => setResolveModal(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                Cancelar
              </button>
              <button onClick={() => updateMutation.mutate({ id: resolveModal.id, status: resolveModal.action, resolutionNote: resolveNote })}
                disabled={updateMutation.isPending}
                className="flex-1 px-4 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-all">
                {updateMutation.isPending ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="fixed z-51 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">¿Eliminar alerta?</h3>
            <p className="text-sm text-muted-foreground mb-4">Se eliminará la alerta y su reporte asociado. Esta acción no se puede deshacer.</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white">
                Cancelar
              </button>
              <button onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/25">
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Purge Modal */}
      {purgeModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setPurgeModal(false)} />
          <div className="fixed z-51 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-[#0f1219] border border-white/10 rounded-2xl p-5 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-center text-base font-bold text-white mb-2">Limpiar todo el historial</h3>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Esto eliminará TODAS las alertas de pánico y sus reportes asociados. No se puede deshacer.
            </p>
            <p className="text-xs text-muted-foreground mb-2 text-center">
              Escribe <strong className="text-white">ELIMINAR_TODO</strong> para confirmar:
            </p>
            <input value={purgeConfirm} onChange={e => setPurgeConfirm(e.target.value)}
              placeholder="ELIMINAR_TODO"
              className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/8 text-sm text-white text-center font-mono focus:outline-none focus:border-destructive/50" />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => setPurgeModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white">
                Cancelar
              </button>
              <button onClick={() => purgeMutation.mutate()}
                disabled={purgeConfirm !== "ELIMINAR_TODO" || purgeMutation.isPending}
                className="flex-1 px-4 py-2 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-sm font-semibold disabled:opacity-30 hover:bg-destructive/25 transition-all">
                {purgeMutation.isPending ? "Eliminando..." : "Eliminar todo"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
