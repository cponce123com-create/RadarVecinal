import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, MapPin, Clock, CheckCircle2, AlertTriangle, Heart, Users, Flame, UserX, Zap, Wifi, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useGetPanicAlerts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDistrict } from "@/contexts/DistrictContext";

const PANIC_META: Record<string, { icon: any; label: string; color: string }> = {
  robbery:        { icon: AlertTriangle, label: "Asalto en Progreso",       color: "#ef4444" },
  medical:        { icon: Heart,         label: "Emergencia Médica",         color: "#3b82f6" },
  fight:          { icon: Users,         label: "Violencia Física",          color: "#f97316" },
  fire:           { icon: Flame,         label: "Incendio",                  color: "#f59e0b" },
  missing_person: { icon: UserX,         label: "Persona Extraviada",        color: "#f59e0b" },
  other:          { icon: Zap,           label: "Otra Emergencia",           color: "#a855f7" },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3 } }),
};

export default function Alerts() {
  const { currentDistrictId } = useDistrict();

  // FIX: antes se llamaba useGetPanicAlerts() sin districtId — para usuarios
  // anónimos el backend no podía determinar el distrito y devolvía lista
  // vacía SIEMPRE. Ahora se pasa el distrito y la query espera a tenerlo.
  const { data, isLoading, refetch } = useGetPanicAlerts(
    currentDistrictId ? { districtId: currentDistrictId } : undefined,
  );
  const queryClient = useQueryClient();
  const alerts = data?.alerts ?? [];
  const [sseConnected, setSseConnected] = useState(false);
  const [newAlertFlash, setNewAlertFlash] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // FIX: antes se conectaba a /api/panic-alerts/stream SIN districtId.
    // El backend responde 400 sin ese parámetro, así que la conexión SSE
    // fallaba, reintentaba cada 5s en bucle infinito (agotando el rate
    // limit) y el indicador quedaba en "Conectando..." para siempre.
    if (!currentDistrictId) return;

    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const url = `${BASE}/api/panic-alerts/stream?districtId=${currentDistrictId}`;

    function connect() {
      const es = new EventSource(url);
      esRef.current = es;
      es.onopen = () => setSseConnected(true);
      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // FIX: antes se comparaba msg.type === "new_alert", pero el backend
          // envía `type` con el TIPO DE EMERGENCIA (robbery, fire...). La
          // condición nunca era verdadera y la lista jamás se refrescaba.
          // Ahora el backend marca las alertas nuevas con `event: "new_alert"`.
          if (msg.event === "new_alert") {
            queryClient.invalidateQueries({ queryKey: ["panic-alerts"] });
            refetch();
            setNewAlertFlash(true);
            setTimeout(() => setNewAlertFlash(false), 3000);
          }
        } catch { /* ignore */ }
      };
      es.onerror = () => {
        setSseConnected(false);
        es.close();
        reconnectRef.current = setTimeout(connect, 5000);
      };
    }
    connect();
    return () => {
      esRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [queryClient, currentDistrictId, refetch]);

  return (
    <div className="max-w-3xl mx-auto pb-8 flex flex-col gap-5 rv-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-destructive" />
            Alertas de Pánico
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1">Emergencias activadas por vecinos en tiempo real.</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-[7px] rounded-[10px] text-xs font-medium border transition-all ${
          sseConnected ? "bg-success/10 text-success border-success/25" : "bg-white/5 text-muted-foreground border-white/8"
        }`}>
          {sseConnected ? <><Wifi className="w-3 h-3" /> <span className="label-mono text-[10px]">EN VIVO</span></> : <><WifiOff className="w-3 h-3" /> Conectando...</>}
        </div>
      </div>

      {newAlertFlash && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/15 border border-destructive/40 text-red-300 text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-destructive status-blink" />
          ¡Nueva alerta de pánico recibida!
        </motion.div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-[14px] bg-card animate-pulse border border-white/5" />)}
        </div>
      )}

      {!isLoading && alerts.length === 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="py-20 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h3 className="font-display text-xl font-bold text-white mb-2">Sin alertas activas</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Todo tranquilo en el distrito. Cuando un vecino active el botón de pánico, aparecerá aquí automáticamente.
          </p>
        </motion.div>
      )}

      {!isLoading && alerts.length > 0 && (
        <div className="flex flex-col gap-3">
          {alerts.filter(a => a.isActive).map((alert, i) => {
            const meta = PANIC_META[alert.type] ?? PANIC_META.other;
            const Icon = meta.icon;
            return (
              <motion.div key={alert.id} custom={i} variants={cardVariants} initial="hidden" animate="visible"
                className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-card to-sidebar border border-white/6"
                style={{ borderColor: `${meta.color}30` }}>
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: meta.color }} />
                <div className="pl-4 pr-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}18` }}>
                      <Icon className="w-6 h-6" style={{ color: meta.color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="text-base font-bold text-white">{meta.label}</h3>
                        <span className="label-mono text-[9px] font-bold px-2 py-0.5 rounded-full status-blink" style={{ color: meta.color, background: `${meta.color}18` }}>
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
              <span className="label-mono text-[9px] text-muted-foreground/50">Historial</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
          )}

          {alerts.filter(a => !a.isActive).map((alert, i) => {
            const meta = PANIC_META[alert.type] ?? PANIC_META.other;
            const Icon = meta.icon;
            return (
              <motion.div key={alert.id} custom={i} variants={cardVariants} initial="hidden" animate="visible"
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-card border border-white/5 opacity-60">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}18` }}>
                  <Icon className="w-[18px] h-[18px]" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{meta.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{alert.address || alert.sector}</p>
                </div>
                <span className="label-mono text-[9px] text-muted-foreground whitespace-nowrap">
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
