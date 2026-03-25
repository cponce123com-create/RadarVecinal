import { Link } from "wouter";
import { AlertTriangle, Map as MapIcon, ChevronRight, Activity } from "lucide-react";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { ReportCard } from "@/components/ReportCard";
import { useGetStats, useGetReports, useGetPanicAlerts } from "@workspace/api-client-react";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: reportsData, isLoading: reportsLoading } = useGetReports({ limit: 5 });
  const { data: alertsData } = useGetPanicAlerts({ active: true });

  const activeAlertsCount = alertsData?.alerts?.length || 0;

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-10">
      {/* Welcome & Global Status */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-1">
            Hola, Vecino
          </h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Conectado a la red de San Miguel
          </p>
        </div>
        
        {stats && (
          <div className="flex gap-4">
            <div className="px-4 py-3 rounded-2xl bg-card border border-white/5 flex flex-col items-center min-w-[100px]">
              <span className="text-2xl font-bold text-white">{stats.todayIncidents}</span>
              <span className="text-xs text-muted-foreground">Hoy</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-destructive/10 border border-destructive/20 flex flex-col items-center min-w-[100px] relative overflow-hidden">
              <div className="absolute inset-0 bg-destructive/5 animate-pulse" />
              <span className="text-2xl font-bold text-destructive relative z-10">{activeAlertsCount}</span>
              <span className="text-xs text-destructive/80 relative z-10 font-medium">Alertas</span>
            </div>
          </div>
        )}
      </section>

      {/* Map Section */}
      <section className="w-full h-[250px] md:h-[400px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative group">
        <MapPlaceholder reports={reportsData?.reports || []} />
        <Link 
          href="/mapa" 
          className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-background to-transparent flex justify-center opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        >
          <button className="px-6 py-2 rounded-full bg-white text-black font-semibold text-sm flex items-center gap-2 hover:scale-105 transition-transform shadow-xl">
            <MapIcon className="w-4 h-4" />
            Abrir Mapa Completo
          </button>
        </Link>
      </section>

      {/* Two Column Layout for Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Left Column: Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2 text-white">
              <Activity className="w-5 h-5 text-primary" />
              Actividad Reciente
            </h3>
            <Link href="/historial" className="text-sm text-primary hover:underline flex items-center">
              Ver todo <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {reportsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 rounded-2xl bg-card animate-pulse border border-white/5" />
              ))}
            </div>
          ) : reportsData?.reports.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-card border border-white/5 text-muted-foreground">
              No hay reportes recientes.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportsData?.reports.slice(0, 4).map(report => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Alerts & Missing */}
        <div className="flex flex-col gap-6">
          <div className="p-5 rounded-2xl bg-gradient-to-b from-red-950/40 to-card border border-red-900/30">
            <h3 className="font-bold text-white flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Alertas Activas
            </h3>
            <div className="space-y-3">
              {alertsData?.alerts.slice(0,3).map(alert => (
                <div key={alert.id} className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm">
                  <p className="font-medium text-red-200">{alert.type}</p>
                  <p className="text-xs text-red-400/70 mt-1 truncate">{alert.address || alert.sector}</p>
                </div>
              ))}
              {(!alertsData?.alerts || alertsData.alerts.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay alertas críticas en este momento.</p>
              )}
            </div>
          </div>

          <Link href="/menor-perdido" className="p-5 rounded-2xl bg-card hover:bg-card/80 border border-white/5 transition-colors group">
            <h3 className="font-bold text-amber-500 mb-2 group-hover:text-amber-400 transition-colors">
              Búsqueda de Personas
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ayuda a la comunidad a localizar personas o mascotas extraviadas.
            </p>
            <div className="text-sm font-medium text-white flex items-center gap-1">
              Ver panel de búsqueda <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Ad Slot Placeholder */}
          <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-white/10 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Patrocinado</p>
              <p className="text-sm font-medium text-white/90 leading-tight">Apoya el comercio local de tu distrito.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
