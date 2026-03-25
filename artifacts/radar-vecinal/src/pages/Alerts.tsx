import { ShieldAlert, MapPin, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useGetPanicAlerts } from "@workspace/api-client-react";
import { PANIC_TYPES } from "@/lib/constants";

export default function Alerts() {
  const { data, isLoading } = useGetPanicAlerts();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-destructive" />
          Alertas Críticas
        </h2>
        <p className="text-muted-foreground mt-2">Emergencias activas en tu zona que requieren atención inmediata.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-40 rounded-2xl bg-card animate-pulse border border-white/5" />
          ))}
        </div>
      ) : data?.alerts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-card border border-white/5 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center text-success mb-4">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Todo tranquilo</h3>
          <p className="text-muted-foreground">No hay alertas críticas activas en este momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.alerts.map(alert => {
            const config = PANIC_TYPES[alert.type] || PANIC_TYPES.other;
            const Icon = config.icon;
            
            return (
              <div 
                key={alert.id} 
                className="relative overflow-hidden p-6 rounded-2xl bg-card border border-destructive/30 shadow-[0_0_20px_rgba(220,38,38,0.1)] group"
              >
                <div className={`absolute top-0 left-0 w-2 h-full ${config.color}`} />
                <div className="absolute top-0 right-0 w-64 h-64 bg-destructive/5 rounded-full blur-3xl pointer-events-none group-hover:bg-destructive/10 transition-colors" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${config.color} text-white shadow-lg shadow-black/50`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-white">{config.label}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-destructive text-white animate-pulse">
                          EN PROGRESO
                        </span>
                      </div>
                      <p className="text-muted-foreground">Reportado por: {alert.authorName}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 md:items-end bg-background/50 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 text-sm text-white/90">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {alert.address || alert.sector}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/90">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: es })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
