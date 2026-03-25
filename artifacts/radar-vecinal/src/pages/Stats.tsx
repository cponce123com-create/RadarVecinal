import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { useGetStats } from "@workspace/api-client-react";
import { Activity, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

export default function Stats() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading || !stats) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando métricas de red...</div>;
  }

  const kpis = [
    { label: "Reportes Totales", value: stats.totalReports, icon: Activity, color: "text-primary", bg: "bg-primary/10" },
    { label: "Alertas Activas", value: stats.activeAlerts, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Resueltos Hoy", value: stats.resolvedToday, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
    { label: "Zona Crítica", value: stats.criticalZone, icon: TrendingUp, color: "text-warning", bg: "bg-warning/10", isText: true },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-white mb-2">Métricas de Seguridad</h2>
        <p className="text-muted-foreground">Análisis de datos del distrito generados por la comunidad.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="p-6 rounded-2xl bg-card border border-white/5 flex flex-col items-center text-center relative overflow-hidden group hover:border-white/10 transition-colors">
            <div className={`absolute top-0 w-full h-1 ${kpi.bg.replace('/10', '')}`} />
            <div className={`p-3 rounded-full ${kpi.bg} ${kpi.color} mb-4`}>
              <kpi.icon className="w-6 h-6" />
            </div>
            <span className="text-sm text-muted-foreground mb-1">{kpi.label}</span>
            <span className={`font-bold ${kpi.isText ? 'text-lg' : 'text-3xl font-display'} text-white`}>
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend Line Chart */}
        <div className="p-6 rounded-2xl bg-card border border-white/5">
          <h3 className="font-bold text-white mb-6">Tendencia Semanal</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="day" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#101014', border: '1px solid #ffffff20', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Bar Chart */}
        <div className="p-6 rounded-2xl bg-card border border-white/5">
          <h3 className="font-bold text-white mb-6">Reportes por Categoría</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.reportsByCategory} layout="vertical" margin={{ left: 50 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="category" type="category" stroke="#ffffff80" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#ffffff05' }}
                  contentStyle={{ backgroundColor: '#101014', border: '1px solid #ffffff20', borderRadius: '8px' }}
                />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
