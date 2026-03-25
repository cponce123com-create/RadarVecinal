import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  AlertTriangle, Map as MapIcon, ChevronRight, Activity,
  Plus, Bell, Clock, UserX, BarChart3, CheckCircle2,
  ShieldAlert, Flame, Zap, Users, TrendingUp
} from "lucide-react";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { ReportCard } from "@/components/ReportCard";
import {
  useGetStats, useGetReports, useGetPanicAlerts, useGetMissingPersons, useGetAdSlots
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CATEGORY_CONFIG, STATUS_CONFIG } from "@/lib/constants";

const PANIC_TYPE_ICONS: Record<string, any> = {
  robbery: AlertTriangle,
  medical: ShieldAlert,
  fight: Users,
  fire: Flame,
  missing_person: UserX,
  other: Zap,
};

const PANIC_TYPE_ES: Record<string, string> = {
  robbery:        "Asalto en Progreso",
  medical:        "Emergencia Médica",
  fight:          "Violencia Física",
  fire:           "Incendio",
  missing_person: "Persona Extraviada",
  other:          "Otra Emergencia",
};

const CATEGORY_DOT_COLORS: Record<string, string> = {
  robbery: "#ef4444", fight: "#f97316", suspicious: "#eab308",
  water_cut: "#3b82f6", garbage: "#6b7280", informal_commerce: "#a855f7",
  noise: "#f59e0b", missing_person: "#f59e0b", fire: "#ef4444",
  medical_emergency: "#ef4444", other: "#6b7280",
};

const QUICK_ACTIONS = [
  { href: "/reportar", icon: Plus, label: "Reportar\nIncidente", color: "from-blue-600 to-blue-700", glow: "hover:shadow-[0_0_24px_rgba(37,99,235,0.5)]" },
  { href: "/alertas", icon: Bell, label: "Ver\nAlertas", color: "from-red-600/90 to-red-700/90", glow: "hover:shadow-[0_0_24px_rgba(220,38,38,0.45)]" },
  { href: "/menor-perdido", icon: UserX, label: "Menor\nPerdido", color: "from-amber-600/90 to-amber-700/90", glow: "hover:shadow-[0_0_24px_rgba(217,119,6,0.45)]" },
  { href: "/historial", icon: Clock, label: "Historial", color: "from-neutral-700 to-neutral-800", glow: "hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } }),
};

export default function Home() {
  const { data: stats } = useGetStats();
  const { data: reportsData, isLoading: reportsLoading } = useGetReports({ limit: 6 });
  const { data: alertsData } = useGetPanicAlerts({ active: true });
  const { data: missingData } = useGetMissingPersons({ active: true });
  const { data: adsData } = useGetAdSlots();

  const activeAlerts = alertsData?.alerts?.filter(a => a.isActive) ?? [];
  const activeMissing = missingData?.alerts?.filter(m => m.status === "active") ?? [];
  const activeAd = adsData?.ads?.find(a => a.isActive);

  return (
    <div className="flex flex-col gap-5 pb-8">

      {/* ── Sticky Alert Banner (Missing Person) ── */}
      {activeMissing.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/menor-perdido">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-400/50 transition-all cursor-pointer group">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <UserX className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Búsqueda activa</span>
                <p className="text-sm text-white font-medium truncate">
                  {activeMissing[0].name}, {activeMissing[0].age ? `${activeMissing[0].age} años` : "edad desconocida"} — {activeMissing[0].lastSeenAddress}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </motion.div>
      )}

      {/* ── Header Row: greeting + KPIs ── */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-1">
            Hola, Vecino
          </h2>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 status-blink inline-block" />
            Conectado — San Ramón, Chanchamayo
          </p>
        </div>

        <div className="flex gap-2 sm:gap-3">
          {[
            { value: stats?.todayIncidents ?? "—", label: "Hoy", accent: false },
            { value: activeAlerts.length, label: "Alertas", accent: true },
            { value: stats?.resolvedToday ?? "—", label: "Resueltos", accent: false, green: true },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className={`px-4 py-2.5 rounded-xl flex flex-col items-center min-w-[72px] border relative overflow-hidden ${
                kpi.accent
                  ? "bg-red-950/40 border-red-900/40"
                  : kpi.green
                  ? "bg-green-950/30 border-green-900/30"
                  : "bg-card border-white/5"
              }`}
            >
              {kpi.accent && (
                <div className="absolute inset-0 bg-destructive/5 status-blink pointer-events-none" />
              )}
              <span className={`text-2xl font-bold relative z-10 ${
                kpi.accent ? "text-destructive" : kpi.green ? "text-green-400" : "text-white"
              }`}>
                {kpi.value}
              </span>
              <span className={`text-[10px] font-medium uppercase tracking-wide relative z-10 ${
                kpi.accent ? "text-red-400/70" : kpi.green ? "text-green-600" : "text-muted-foreground"
              }`}>
                {kpi.label}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Map (large) ── */}
      <motion.section
        custom={1} variants={cardVariants} initial="hidden" animate="visible"
        className="w-full rounded-2xl overflow-hidden border border-white/8 shadow-2xl relative group"
        style={{ height: "clamp(220px, 36vw, 420px)" }}
      >
        <MapPlaceholder reports={reportsData?.reports ?? []} />

        {/* Overlay gradient at bottom with CTA */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#060810]/90 to-transparent pointer-events-none" />
        <Link href="/mapa">
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm font-medium hover:bg-white/20 transition-all cursor-pointer shadow-lg opacity-0 group-hover:opacity-100 duration-300">
            <MapIcon className="w-4 h-4 text-primary" />
            Abrir mapa completo
          </div>
        </Link>
      </motion.section>

      {/* ── Quick Actions Grid ── */}
      <motion.section custom={2} variants={cardVariants} initial="hidden" animate="visible">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {QUICK_ACTIONS.map((action, i) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <div className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-gradient-to-br ${action.color} border border-white/5 cursor-pointer transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${action.glow} shadow-md`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  <span className="text-[10px] sm:text-xs font-semibold text-white/90 text-center leading-tight whitespace-pre-line">
                    {action.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </motion.section>

      {/* ── Two column layout: Feed + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Activity Feed (3/5 width on desktop) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2 text-white">
              <Activity className="w-4 h-4 text-primary" />
              Actividad Reciente
            </h3>
            <Link href="/historial" className="text-xs text-primary hover:text-blue-300 flex items-center gap-0.5 transition-colors">
              Ver todo <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {reportsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl bg-card animate-pulse border border-white/5" />
              ))}
            </div>
          ) : reportsData?.reports.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-card border border-white/5 text-muted-foreground text-sm">
              No hay reportes recientes.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {reportsData?.reports.slice(0, 5).map((report, i) => {
                const config = CATEGORY_CONFIG[report.category as keyof typeof CATEGORY_CONFIG];
                const color = CATEGORY_DOT_COLORS[report.category] ?? "#6b7280";
                const Icon = config?.icon;
                return (
                  <motion.div
                    key={report.id}
                    custom={i}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex items-start gap-3 p-3 rounded-xl bg-card border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all cursor-pointer group"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${color}18`, boxShadow: `0 0 12px ${color}30` }}
                    >
                      {Icon && <Icon className="w-4 h-4" style={{ color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white truncate">{report.title}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${
                          report.status === "active" ? "bg-red-500/15 text-red-400" :
                          report.status === "resolved" ? "bg-green-500/15 text-green-400" :
                          "bg-yellow-500/15 text-yellow-400"
                        }`}>
                          {report.status === "active" ? "Activo" : report.status === "resolved" ? "Resuelto" : "Revisión"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{report.sector}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatDistanceToNow(new Date(report.createdAt), { locale: es, addSuffix: true })}
                        </span>
                        {report.confirmedCount > 0 && (
                          <span className="text-[10px] text-muted-foreground/50">
                            ✓ {report.confirmedCount} confirmaciones
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar (2/5 width on desktop) */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Active Panic Alerts */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-red-950/30 to-card border border-red-900/25">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Alertas Activas
              </h3>
              {activeAlerts.length > 0 && (
                <span className="text-[10px] font-bold text-destructive bg-destructive/15 px-1.5 py-0.5 rounded-full">
                  {activeAlerts.length}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {activeAlerts.length > 0 ? activeAlerts.slice(0, 3).map(alert => {
                const Icon = PANIC_TYPE_ICONS[alert.type] ?? ShieldAlert;
                return (
                  <div key={alert.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-destructive/8 border border-destructive/15">
                    <Icon className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-red-300">{PANIC_TYPE_ES[alert.type] ?? "Emergencia"}</p>
                      <p className="text-[10px] text-red-400/60 truncate">{alert.address || alert.sector}</p>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0 status-blink" />
                  </div>
                );
              }) : (
                <div className="text-center py-3 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-green-500/50 mx-auto mb-1" />
                  Sin alertas activas
                </div>
              )}
            </div>
          </div>

          {/* Stats Summary */}
          {stats && (
            <div className="p-4 rounded-xl bg-card border border-white/5">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                Resumen del Distrito
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Zona más crítica</span>
                  <span className="text-white font-semibold text-right">{stats.criticalZone ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Reportes totales</span>
                  <span className="text-white font-semibold">{stats.totalReports}</span>
                </div>
                {stats.topSectors?.slice(0, 3).map(s => (
                  <div key={s.sector} className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full"
                        style={{ width: `${Math.min(100, (s.count / (stats.totalReports || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-24 truncate text-right">{s.sector}</span>
                  </div>
                ))}
                <Link href="/estadisticas" className="flex items-center gap-1 text-[11px] text-primary hover:text-blue-300 transition-colors pt-1">
                  <BarChart3 className="w-3 h-3" />
                  Ver estadísticas completas
                </Link>
              </div>
            </div>
          )}

          {/* Ad Slot */}
          {activeAd && (
            <a
              href={activeAd.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3.5 rounded-xl bg-card border border-white/5 hover:border-white/10 transition-all cursor-pointer"
            >
              <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">Patrocinado</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🏪</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{activeAd.businessName}</p>
                  <p className="text-xs text-muted-foreground truncate">{activeAd.tagline}</p>
                </div>
              </div>
            </a>
          )}

        </div>
      </div>
    </div>
  );
}
