import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, MapPin, Clock, CheckCircle2, AlertTriangle, Heart, Users, Flame, UserX, Zap, Wifi, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useGetPanicAlerts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const PANIC_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  robbery:        { icon: AlertTriangle, label: "Asalto en Progreso",       color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  medical:        { icon: Heart,         label: "Emergencia Médica",         color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  fight:          { icon: Users,         label: "Violencia Física",          color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  fire:           { icon: Flame,         label: "Incendio",                  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  missing_person: { icon: UserX,         label: "Persona Extraviada",        color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  other:          { icon: Zap,           label: "Otra Emergencia",           color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
};

export default function Alerts() {
  const { data, isLoading, refetch } = useGetPanicAlerts();
  const queryClient = useQueryClient();
  const alerts = data?.alerts ?? [];
  const [sseConnected, setSseConnected] = useState(false);
  const [newAlertFlash, setNewAlertFlash] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // B-13: Connect to SSE stream for real-time panic alerts
  useEffect(() => {
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const url = `${BASE}/api/panic-alerts/stream`;

    function connect() {
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => setSseConnected(true);

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "new_alert") {
            queryClient.invalidateQueries({ queryKey: ["panic-alerts"] });
            setNewAlertFlash(true);
            setTimeout(() => setNewAlertFlash(false), 3000);
          }
        } catch { /* ignore parse errors */ }
      };

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        // Reconnect after 5 s
        setTimeout(connect, 5000);
      };
    }

    connect();
    return () => { esRef.current?.close(); };
  }, [queryClient]);

  return (
    <div className="max-w-3xl mx-auto pb-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            Alertas de Pánico
          </h2>
          <p className="text-sm text-muted-foreground">Emergencias activadas por vecinos en tiempo real.</p>
        </div>

        {/* B-13: SSE connection indicator */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          sseConnected
            ? "bg-green-500/10 text-green-400 border border-green-500/20"
            : "bg-white/5 text-muted-foreground border border-white/8"
        }`}>
          {sseConnected
            ? <><Wifi className="w-3 h-3" /> En vivo</>
            : <><WifiOff className="w-3 h-3" /> Conectando...</>
          }
        </div>
      </div>

      {/* New alert flash banner */}
      {newAlertFlash && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm font-semibold"
        >
          <span className="w-2 h-2 rounded-full bg-destructive status-blink" />
          ¡Nueva alerta de pánico recibida!
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-xl bg-card animate-pulse border border-white/5" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && alerts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-20 flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Sin alertas activas</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Todo tranquilo en el distrito. Cuando un vecino active el botón de pánico, aparecerá aquí automáticamente.
          </p>
        </motion.div>
      )}

      {/* Alert cards */}
      {!isLoading && alerts.length > 0 && (
        <div className="flex flex-col gap-3">
          {/* Active first */}
          {alerts.filter(a => a.isActive).map((alert, i) => {
            const meta = PANIC_META[alert.type] ?? PANIC_META.other;
            const Icon = meta.icon;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="relative overflow-hidden rounded-xl border"
                style={{ borderColor: `${meta.color}40`, background: `${meta.color}08` }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: meta.color }} />

                <div className="pl-4 pr-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                      <Icon className="w-6 h-6" style={{ color: meta.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="text-base font-bold text-white">{meta.label}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full status-blink"
                          style={{ color: meta.color, background: meta.bg }}>
                          EN PROGRESO
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Reportado por: <span className="text-white/70">{alert.authorName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col gap-3 sm:gap-1.5 sm:items-end text-xs text-muted-foreground ml-11 sm:ml-0">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{alert.address || alert.sector}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: es })}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {alerts.filter(a => !a.isActive).length > 0 && (
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Historial</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
          )}

          {alerts.filter(a => !a.isActive).map((alert, i) => {
            const meta = PANIC_META[alert.type] ?? PANIC_META.other;
            const Icon = meta.icon;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="flex items-center gap-3.5 p-3.5 rounded-xl bg-card border border-white/5 opacity-60"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{meta.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{alert.address || alert.sector}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(alert.createdAt), { locale: es })}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
