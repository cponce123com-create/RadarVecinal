import { useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Siren, Map as MapIcon, ChevronRight, Activity, Plus, UserX,
  Clock, BarChart3, CheckCircle2, ShieldAlert, Flame, Users,
  HeartPulse, TrendingUp, Maximize2, Store, MapPin, Eye,
} from "lucide-react";
import {
  useGetStats, useGetReports, useGetPanicAlerts, useGetMissingPersons, useGetAdSlots,
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CATEGORY_CONFIG, CAT_HEX } from "@/lib/constants";
import { useGeofenceWatcher } from "@/lib/useGeofenceWatcher";
import { useDistrict } from "@/contexts/DistrictContext";
import ProximityBanner from "@/components/ProximityBanner";
import RadarHero from "@/components/RadarHero";

const PANIC_TYPE_ICONS: Record<string, any> = {
  robbery: ShieldAlert, medical: HeartPulse, fight: Users,
  fire: Flame, missing_person: UserX, other: Siren,
};
const PANIC_TYPE_ES: Record<string, string> = {
  robbery: "Asalto en Progreso", medical: "Emergencia Médica", fight: "Violencia Física",
  fire: "Incendio", missing_person: "Persona Extraviada", other: "Otra Emergencia",
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } }),
};

export default function Home() {
  const { currentDistrict, currentDistrictId, province, districtInfo, setDistrict, districts, isLocationApproximate } = useDistrict();
  const districtDisplay = [currentDistrict, province].filter(Boolean).join(", ") || "Selecciona tu distrito";
  const districtDisplaySuffix = currentDistrict && isLocationApproximate ? " (aprox.)" : "";
  // FIX: antes estas queries iban SIN districtId — para usuarios anónimos el
  // backend devolvía estadísticas GLOBALES (todos los distritos mezclados).
  // Por eso el "Resumen del Distrito" mostraba zonas de otro distrito.
  const dq = currentDistrictId ? { districtId: currentDistrictId } : undefined;
  const { data: stats } = useGetStats(dq);
  const { data: reportsData, isLoading: reportsLoading } = useGetReports({ limit: 6, ...(dq ?? {}) });
  const { data: alertsData } = useGetPanicAlerts({ active: true, ...(dq ?? {}) });
  const { data: missingData } = useGetMissingPersons({ active: true, ...(dq ?? {}) });
  const { data: adsData } = useGetAdSlots();
  const geofence = useGeofenceWatcher({ radius: 1000 });

  useEffect(() => { geofence.start(); return () => geofence.stop(); }, []);

  // Auto-detectar distrito por GPS cuando se obtiene ubicación
  useEffect(() => {
    if (geofence.currentPosition) {
      const { lat, lng } = geofence.currentPosition;
      // Solo si el distrito actual es el default (San Ramón) o no se ha cambiado manualmente
      const manualSelection = localStorage.getItem("radarvecinal_district_slug");
      if (!manualSelection || manualSelection === "san-ramon") {
        fetch(`/api/districts/nearby?lat=${lat}&lng=${lng}&limit=1`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.districts?.length > 0) {
              const nearest = data.districts[0];
              if (nearest.distance < 30000 && nearest.slug !== "san-ramon") {
                setDistrict(nearest.slug);
              }
            }
          })
          .catch(() => {});
      }
    }
  }, [geofence.currentPosition]);

  const reports = reportsData?.reports ?? [];
  const activeAlerts = alertsData?.alerts?.filter(a => a.isActive) ?? [];
  const activeMissing = missingData?.alerts?.filter(m => m.status === "active") ?? [];
  const activeAd = adsData?.ads?.find(a => a.isActive);

  const kpis = [
    { value: stats?.todayIncidents ?? 0, label: "Hoy", cls: "text-white bg-card border-white/7", lbl: "text-muted-foreground" },
    { value: activeAlerts.length, label: "Alertas", cls: "text-destructive bg-destructive/12 border-destructive/25", lbl: "text-destructive/60" },
    { value: stats?.resolvedToday ?? 0, label: "Resueltos", cls: "text-success bg-success/10 border-success/22", lbl: "text-success/60" },
  ];

  const quickActions = [
    { href: "/reportar", icon: Plus, label: "Reportar Incidente", bg: "from-primary/16 to-primary/5", border: "border-primary/30", ibg: "bg-primary/20", ic: "text-[#5b8dff]" },
    { href: "/alertas", icon: Siren, label: "Ver Alertas", bg: "from-destructive/14 to-destructive/4", border: "border-destructive/28", ibg: "bg-destructive/20", ic: "text-red-400" },
    { href: "/menor-perdido", icon: UserX, label: "Menor Perdido", bg: "from-warning/14 to-warning/4", border: "border-warning/26", ibg: "bg-warning/20", ic: "text-amber-400" },
    { href: "/mapa", icon: MapIcon, label: "Ver Mapa", bg: "from-cyan/12 to-cyan/4", border: "border-cyan/24", ibg: "bg-cyan/18", ic: "text-cyan" },
  ];

  return (
    <div className="flex flex-col gap-[18px] rv-in">
      {/* Banner persona extraviada */}
      {activeMissing.length > 0 && (
        <Link href="/menor-perdido">
          <div className="flex items-center gap-3 px-4 py-3 rounded-[15px] bg-gradient-to-r from-warning/14 to-warning/4 border border-warning/28 cursor-pointer group">
            <div className="w-[38px] h-[38px] rounded-[11px] bg-warning/18 flex items-center justify-center flex-shrink-0">
              <UserX className="w-[18px] h-[18px] text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="label-mono text-[10.5px] font-bold text-amber-400">Búsqueda activa</span>
              <p className="text-[13.5px] text-white font-medium truncate">
                {activeMissing[0].name}, {activeMissing[0].age ? `${activeMissing[0].age} años` : "edad desconocida"} — {activeMissing[0].lastSeenAddress}
              </p>
            </div>
            <ChevronRight className="w-[18px] h-[18px] text-amber-400 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      )}

      <ProximityBanner nearbyAlerts={geofence.nearbyAlerts} onDismiss={() => {}} />

      {/* Saludo + KPIs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-display text-[30px] font-bold text-white tracking-tight m-0">Hola, Vecino</h1>
          <p className="text-[13px] text-muted-foreground mt-1.5 flex items-center gap-2">
            <span className="w-[7px] h-[7px] rounded-full bg-success shadow-[0_0_8px_hsl(142_71%_55%)]" />
            Conectado — {districtDisplay}{districtDisplaySuffix}
          </p>
        </div>
        <div className="flex gap-2.5">
          {kpis.map((k, i) => (
            <motion.div key={k.label} custom={i} variants={cardVariants} initial="hidden" animate="visible"
              className={`min-w-[84px] px-4 py-3 rounded-[14px] border flex flex-col items-center ${k.cls}`}>
              <span className="font-display text-[26px] font-bold leading-none">{k.value}</span>
              <span className={`label-mono text-[9.5px] mt-[5px] ${k.lbl}`}>{k.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Radar + columna derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-[18px]">
        <RadarHero
          reports={reports}
          userPosition={geofence.currentPosition}
          districtInfo={districtInfo ? { centerLat: districtInfo.centerLat, centerLng: districtInfo.centerLng, name: districtInfo.name } : null}
          onViewOnMap={() => {}}
        />

        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            {quickActions.map(a => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href}>
                  <div className={`flex flex-col gap-2.5 p-[15px] rounded-[15px] bg-gradient-to-br ${a.bg} border ${a.border} cursor-pointer transition-transform hover:-translate-y-0.5`}>
                    <div className={`w-[34px] h-[34px] rounded-[10px] ${a.ibg} flex items-center justify-center`}>
                      <Icon className={`w-[17px] h-[17px] ${a.ic}`} />
                    </div>
                    <span className="text-xs font-semibold text-white leading-tight">{a.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-b from-destructive/8 to-card/60 border border-destructive/20 flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Siren className="w-4 h-4 text-red-400" />
                <span className="text-[13px] font-bold text-white">Alertas Activas</span>
              </div>
              {activeAlerts.length > 0 && (
                <span className="label-mono text-[10px] font-semibold text-red-400 bg-destructive/16 px-2 py-0.5 rounded-full">
                  {String(activeAlerts.length).padStart(2, "0")}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {activeAlerts.length > 0 ? activeAlerts.slice(0, 3).map(alert => {
                const Icon = PANIC_TYPE_ICONS[alert.type] ?? ShieldAlert;
                return (
                  <Link key={alert.id} href="/alertas">
                    <div className="flex items-center gap-2.5 p-2.5 rounded-[11px] bg-destructive/7 border border-destructive/15 cursor-pointer">
                      <Icon className="w-[15px] h-[15px] text-red-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-red-300">{PANIC_TYPE_ES[alert.type] ?? "Emergencia"}</p>
                        <p className="text-[10.5px] text-red-400/60 truncate">{alert.address || alert.sector}</p>
                      </div>
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0 status-blink" />
                    </div>
                  </Link>
                );
              }) : (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-success/50 mx-auto mb-1" /> Sin alertas activas
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feed + Resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[18px]">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-white">Actividad Reciente</span>
            </div>
            <Link href="/historial" className="text-xs text-[#5b8dff] flex items-center gap-0.5">
              Ver todo <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {reportsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-[68px] rounded-[14px] bg-card animate-pulse border border-white/5" />)}
            </div>
          ) : reports.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-card border border-white/5 flex items-center justify-center mb-3">
                <Activity className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <p className="text-white font-semibold mb-1">No hay reportes recientes</p>
              <p className="text-xs text-muted-foreground max-w-[220px]">Cuando los vecinos reporten incidentes, aparecerán aquí.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {reports.slice(0, 5).map((report, i) => {
                const config = CATEGORY_CONFIG[report.category as keyof typeof CATEGORY_CONFIG];
                const color = CAT_HEX[report.category] ?? "#6b7280";
                const Icon = config?.icon ?? Eye;
                return (
                  <motion.div key={report.id} custom={i} variants={cardVariants} initial="hidden" animate="visible"
                    className="flex items-start gap-3 p-[13px] rounded-[14px] bg-gradient-to-b from-card to-sidebar border border-white/6 hover:border-white/14 transition-colors cursor-pointer">
                    <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}22`, boxShadow: `0 0 14px ${color}30` }}>
                      <Icon className="w-[17px] h-[17px]" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="text-[13.5px] font-semibold text-white truncate">{report.title}</span>
                        <span className={`text-[10px] font-semibold px-2 py-[3px] rounded-full whitespace-nowrap flex-shrink-0 ${
                          report.status === "active" ? "bg-destructive/15 text-red-400" :
                          report.status === "resolved" ? "bg-success/15 text-success" : "bg-warning/15 text-amber-400"
                        }`}>
                          {report.status === "active" ? "Activo" : report.status === "resolved" ? "Resuelto" : "Revisión"}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-muted-foreground mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> {report.sector}
                        <span className="text-[#4a5568]">·</span>
                        <span className="label-mono text-[10.5px] tracking-normal">
                          {formatDistanceToNow(new Date(report.createdAt), { locale: es, addSuffix: true })}
                        </span>
                        {report.confirmedCount > 0 && (
                          <><span className="text-[#4a5568]">·</span><span className="text-success/60">✓ {report.confirmedCount}</span></>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          {stats && stats.totalReports > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-b from-card to-sidebar border border-white/6">
              <div className="flex items-center gap-2 mb-3.5">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-bold text-white">Resumen del Distrito</span>
              </div>
              <div className="flex justify-between items-center pb-3 mb-3 border-b border-white/6">
                <span className="text-xs text-muted-foreground">Zona más crítica</span>
                <span className="text-[12.5px] font-semibold text-red-400">{stats.criticalZone === "Ninguna" ? "—" : stats.criticalZone}</span>
              </div>
              <div className="flex flex-col gap-3">
                {stats.topSectors?.slice(0, 4).map(s => (
                  <div key={s.sector}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[11.5px] text-[#c3c9d6] truncate">{s.sector}</span>
                      <span className="label-mono text-[10.5px] text-muted-foreground tracking-normal">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan"
                        style={{ width: `${Math.min(100, (s.count / (stats.totalReports || 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/estadisticas" className="flex items-center gap-1.5 mt-3.5 text-xs text-[#5b8dff]">
                <BarChart3 className="w-3.5 h-3.5" /> Ver estadísticas completas
              </Link>
            </div>
          )}

          {activeAd && (
            <a href={activeAd.targetUrl} target="_blank" rel="noopener noreferrer"
              className="block p-3.5 rounded-2xl bg-card border border-white/6 hover:border-white/10 transition-colors">
              <p className="label-mono text-[9px] text-muted-foreground/50 mb-2.5">Patrocinado</p>
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-[11px] bg-gradient-to-br from-cyan/20 to-primary/15 flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-cyan" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{activeAd.businessName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{activeAd.tagline}</p>
                </div>
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
