import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, AlertTriangle, CheckCircle2, UserX, ShieldAlert,
  RefreshCw, Flame, Info, Filter, Check, ChevronRight, Trash2,
  Volume2, Zap,
} from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useGetNotifications } from "@workspace/api-client-react";

type NotifType = "panic" | "confirmation" | "missing" | "update" | "system" | "fire";
type NotifFilter = "all" | "unread" | "alerts" | "system";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: Date;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  critical?: boolean;
}

const DEMO_NOTIFS: Notification[] = [
  {
    id: "n1",
    type: "panic",
    title: "Alerta de Pánico Activa",
    body: "Se activó una alerta de asalto en Jr. Tarma, San Ramón Centro. Radio: 800m de tu ubicación.",
    time: new Date(Date.now() - 5 * 60000),
    read: false,
    critical: true,
    actionLabel: "Ver alerta",
    actionHref: "/alertas",
  },
  {
    id: "n2",
    type: "confirmation",
    title: "5 vecinos confirmaron tu reporte",
    body: 'Tu reporte "Actitud sospechosa en Plaza de Armas" fue validado por 5 vecinos del distrito.',
    time: new Date(Date.now() - 22 * 60000),
    read: false,
    actionLabel: "Ver reporte",
    actionHref: "/historial",
  },
  {
    id: "n3",
    type: "missing",
    title: "Menor extraviado en tu zona",
    body: "Sebastián, 9 años. Visto por última vez en Colegio San Miguel. Ayuda a difundir.",
    time: new Date(Date.now() - 1.2 * 3600000),
    read: false,
    critical: true,
    actionLabel: "Ver búsqueda",
    actionHref: "/menor-perdido",
  },
  {
    id: "n4",
    type: "update",
    title: "Reporte actualizado a Resuelto",
    body: 'El reporte "Pelea callejera en Jr. Progreso" fue marcado como resuelto por la administración.',
    time: new Date(Date.now() - 2.5 * 3600000),
    read: true,
    actionLabel: "Ver historial",
    actionHref: "/historial",
  },
  {
    id: "n5",
    type: "panic",
    title: "Alerta de Incendio Resuelta",
    body: "La alerta de incendio en Jr. Huánuco fue atendida y resuelta. Gracias a todos por reportar.",
    time: new Date(Date.now() - 5 * 3600000),
    read: true,
  },
  {
    id: "n6",
    type: "system",
    title: "Bienvenido a Radar Vecinal",
    body: "Tu cuenta ha sido activada en San Ramón, Chanchamayo. Activa las alertas sonoras para recibir notificaciones en tiempo real.",
    time: new Date(Date.now() - 8 * 3600000),
    read: true,
    actionLabel: "Configurar",
    actionHref: "/configuracion",
  },
  {
    id: "n7",
    type: "confirmation",
    title: "Tu reporte tiene 10 confirmaciones",
    body: 'El reporte "Basura acumulada en Av. Circunvalación" alcanzó 10 confirmaciones. Alta confiabilidad.',
    time: subDays(new Date(), 1),
    read: true,
  },
  {
    id: "n8",
    type: "system",
    title: "Actualización del sistema",
    body: "Radar Vecinal v2.1 disponible. Nuevo mapa de calor de inseguridad, mejoras de rendimiento y categorías sensibles.",
    time: subDays(new Date(), 1),
    read: true,
  },
  {
    id: "n9",
    type: "update",
    title: "Nueva zona de riesgo detectada",
    body: "Se detectó un aumento de incidentes en La Merced. Toma precauciones al circular por esa zona.",
    time: subDays(new Date(), 2),
    read: true,
  },
];

const TYPE_META: Record<NotifType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  panic:        { icon: ShieldAlert,   color: "#ef4444", bg: "rgba(239,68,68,0.15)",    label: "Pánico" },
  confirmation: { icon: CheckCircle2,  color: "#22c55e", bg: "rgba(34,197,94,0.15)",    label: "Confirmación" },
  missing:      { icon: UserX,         color: "#f59e0b", bg: "rgba(245,158,11,0.15)",   label: "Extraviado" },
  update:       { icon: RefreshCw,     color: "#3b82f6", bg: "rgba(59,130,246,0.15)",   label: "Actualización" },
  fire:         { icon: Flame,         color: "#f97316", bg: "rgba(249,115,22,0.15)",   label: "Incendio" },
  system:       { icon: Info,          color: "#6b7280", bg: "rgba(107,114,128,0.15)",  label: "Sistema" },
};

const FILTER_TABS: { id: NotifFilter; label: string }[] = [
  { id: "all",     label: "Todas" },
  { id: "unread",  label: "No leídas" },
  { id: "alerts",  label: "Alertas" },
  { id: "system",  label: "Sistema" },
];

function groupByDate(notifs: Notification[]) {
  const today:    Notification[] = [];
  const yesterday: Notification[] = [];
  const week:     Notification[] = [];
  const older:    Notification[] = [];

  notifs.forEach(n => {
    if (isToday(n.time))      today.push(n);
    else if (isYesterday(n.time)) yesterday.push(n);
    else if (isAfter(n.time, subDays(new Date(), 7))) week.push(n);
    else older.push(n);
  });

  return [
    { label: "Hoy",          items: today },
    { label: "Ayer",          items: yesterday },
    { label: "Esta semana",   items: week },
    { label: "Más antiguas",  items: older },
  ].filter(g => g.items.length > 0);
}

export default function Notifications() {
  const { toast } = useToast();
  const [notifs, setNotifs] = useState<Notification[]>(DEMO_NOTIFS);
  const [filter, setFilter] = useState<NotifFilter>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { data: apiNotifs } = useGetNotifications();

  // B-16: Merge API system notifications into local state
  useEffect(() => {
    if (!apiNotifs?.notifications?.length) return;
    setNotifs(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const merged = apiNotifs.notifications
        .filter((n: any) => !existingIds.has(n.id))
        .map((n: any) => ({
          id: n.id,
          type: (n.type ?? "system") as NotifType,
          title: n.title ?? "Notificación del sistema",
          body: n.message ?? "",
          time: new Date(n.createdAt ?? Date.now()),
          read: false,
        }));
      return merged.length > 0 ? [...merged, ...prev] : prev;
    });
  }, [apiNotifs]);

  const unreadCount = notifs.filter(n => !n.read).length;

  const filtered = useMemo(() => {
    switch (filter) {
      case "unread":  return notifs.filter(n => !n.read);
      case "alerts":  return notifs.filter(n => n.type === "panic" || n.type === "fire" || n.type === "missing");
      case "system":  return notifs.filter(n => n.type === "system" || n.type === "update");
      default:        return notifs;
    }
  }, [notifs, filter]);

  const groups = groupByDate(filtered);

  const markAllRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    toast({ title: "Todas marcadas como leídas" });
  };

  const markRead = (id: string) =>
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const deleteNotif = (id: string) =>
    setNotifs(prev => prev.filter(n => n.id !== id));

  const clearAll = () => {
    setNotifs([]);
    toast({ title: "Notificaciones eliminadas" });
  };

  return (
    <div className="max-w-2xl mx-auto pb-8 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Notificaciones
            {unreadCount > 0 && (
              <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                {unreadCount}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Alertas, actualizaciones y actividad del distrito
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-medium text-primary hover:text-blue-300 transition-colors whitespace-nowrap"
            >
              Marcar todo leído
            </button>
          )}
        </div>
      </div>

      {/* Push permission banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 p-4 rounded-xl bg-primary/8 border border-primary/25"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Volume2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Alertas sonoras {soundEnabled ? "activadas" : "desactivadas"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {soundEnabled
              ? "Recibirás alertas de audio cuando ocurra un incidente en tu radio de cercanía."
              : "Activa las alertas para ser notificado de incidentes cercanos en tiempo real."}
          </p>
        </div>
        <button
          onClick={() => setSoundEnabled(v => !v)}
          className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-all duration-300 ${soundEnabled ? "bg-primary" : "bg-white/10"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${soundEnabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTER_TABS.map(tab => {
          const count = tab.id === "unread" ? unreadCount : undefined;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                filter === tab.id
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-card border-white/8 text-muted-foreground hover:text-white hover:border-white/15"
              }`}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {notifs.length > 0 && (
          <button
            onClick={clearAll}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors whitespace-nowrap px-2 flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Notification list */}
      {groups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16 gap-3"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/4 flex items-center justify-center">
            <BellOff className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Sin notificaciones</p>
          <p className="text-xs text-muted-foreground/50 text-center max-w-xs">
            Las alertas de incidentes cercanos y actualizaciones del distrito aparecerán aquí.
          </p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(group => (
            <div key={group.label}>
              {/* Date separator */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <div className="flex flex-col gap-1.5">
                <AnimatePresence initial={false}>
                  {group.items.map((notif, idx) => {
                    const meta = TYPE_META[notif.type];
                    const Icon = meta.icon;
                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`relative flex items-start gap-3 p-3.5 rounded-xl border transition-all group ${
                          !notif.read
                            ? "bg-white/[0.035] border-white/10 hover:border-white/15"
                            : "bg-card border-white/5 hover:border-white/8 opacity-75 hover:opacity-100"
                        }`}
                      >
                        {/* Unread dot */}
                        {!notif.read && (
                          <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        )}

                        {/* Icon */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: meta.bg }}
                        >
                          <Icon className="w-4.5 h-4.5" style={{ color: meta.color, width: "18px", height: "18px" }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white leading-snug">
                                {notif.title}
                              </span>
                              {notif.critical && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wide">
                                  Urgente
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => deleteNotif(notif.id)}
                              className="p-1 rounded-lg text-muted-foreground/30 hover:text-muted-foreground hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                            {notif.body}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] text-muted-foreground/50">
                              {formatDistanceToNow(notif.time, { locale: es, addSuffix: true })}
                            </span>
                            <span
                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: meta.bg, color: meta.color }}
                            >
                              {meta.label}
                            </span>
                            {notif.actionLabel && notif.actionHref && (
                              <a
                                href={notif.actionHref}
                                onClick={() => markRead(notif.id)}
                                className="text-[10px] text-primary hover:text-blue-300 font-medium flex items-center gap-0.5 transition-colors ml-auto"
                              >
                                {notif.actionLabel}
                                <ChevronRight className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Mark read button */}
                        {!notif.read && (
                          <button
                            onClick={() => markRead(notif.id)}
                            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-green-400 hover:bg-green-500/10 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                            title="Marcar como leída"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tip */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-white/2 border border-white/5 text-xs text-muted-foreground/50">
        <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-yellow-500/40" />
        Las alertas de pánico y búsqueda de personas extraviadas siempre aparecerán aquí aunque no tengas alertas sonoras activadas.
      </div>
    </div>
  );
}
