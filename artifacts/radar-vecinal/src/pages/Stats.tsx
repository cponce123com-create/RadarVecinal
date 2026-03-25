import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import { useGetStats } from "@workspace/api-client-react";
import { Activity, AlertTriangle, CheckCircle, TrendingUp, MapPin } from "lucide-react";

const KPI_CONFIG = [
  { key: "totalReports",  label: "Reportes Totales", icon: Activity,      color: "#3b82f6",  bg: "rgba(59,130,246,0.12)" },
  { key: "activeAlerts",  label: "Alertas Activas",  icon: AlertTriangle,  color: "#ef4444",  bg: "rgba(239,68,68,0.12)" },
  { key: "resolvedToday", label: "Resueltos Hoy",    icon: CheckCircle,    color: "#22c55e",  bg: "rgba(34,197,94,0.12)" },
  { key: "criticalZone",  label: "Zona Crítica",     icon: MapPin,         color: "#f59e0b",  bg: "rgba(245,158,11,0.12)", isText: true },
];

const CHART_TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#0f1219", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", fontSize: "12px" },
  itemStyle: { color: "#fff" },
  labelStyle: { color: "rgba(255,255,255,0.5)" },
  cursor: { fill: "rgba(255,255,255,0.03)" },
};

export default function Stats() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="h-8 w-48 bg-card rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-card rounded-xl animate-pulse border border-white/5" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="max-w-5xl mx-auto pb-8 flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Métricas de Seguridad</h2>
        <p className="text-sm text-muted-foreground">Análisis de incidentes en el Distrito San Miguel.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_CONFIG.map((kpi, i) => {
          const Icon = kpi.icon;
          const value = stats[kpi.key as keyof typeof stats];
          return (
            <motion.div
              key={kpi.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="relative overflow-hidden p-4 rounded-xl bg-card border border-white/5 flex flex-col"
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: kpi.color }}
              />
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: kpi.bg }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: kpi.color }} />
                </div>
              </div>
              <p className={`font-bold mb-0.5 ${kpi.isText ? "text-lg leading-tight" : "text-2xl"} text-white`}>
                {String(value ?? "—")}
              </p>
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly trend */}
        <div className="p-5 rounded-xl bg-card border border-white/5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-white text-sm">Tendencia Semanal</h3>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weeklyTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ fill: "#3b82f6", strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: "#fff", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By category */}
        <div className="p-5 rounded-xl bg-card border border-white/5">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-white text-sm">Por Categoría</h3>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.reportsByCategory} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 60 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="category"
                  type="category"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top sectors table */}
      {stats.topSectors && stats.topSectors.length > 0 && (
        <div className="p-5 rounded-xl bg-card border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-destructive" />
            <h3 className="font-bold text-white text-sm">Sectores con más incidentes</h3>
          </div>
          <div className="space-y-3">
            {stats.topSectors.map((s: any, i: number) => {
              const pct = stats.totalReports > 0 ? Math.round((s.count / stats.totalReports) * 100) : 0;
              const colors = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#6b7280"];
              const color = colors[i] ?? "#6b7280";
              return (
                <div key={s.sector} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground/60 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white truncate">{s.sector}</span>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{s.count} reportes</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
