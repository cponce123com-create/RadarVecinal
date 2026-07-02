import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, BarChart3, Activity, ArrowUp, ArrowDown } from "lucide-react";
import { useDistrict } from "@/contexts/DistrictContext";

interface TrendItem {
  date: string;
  count: number;
}

interface AnalyticsData {
  totalReports: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  dailyTrend: TrendItem[];
  avgResolutionHours: number;
  bySector: { sector: string; count: number }[];
}

/**
 * AnalyticsTab — Dashboard de tendencias y métricas.
 * Inspirado en CivicReporter (analytics) + Civix (insights).
 */
export default function AnalyticsTab() {
  const { currentDistrictId, currentDistrict } = useDistrict();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentDistrictId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/stats?districtId=${currentDistrictId}`).then(r => r.json()),
      fetch(`/api/reports?districtId=${currentDistrictId}&limit=1000`).then(r => r.json()),
    ]).then(([stats, reports]) => {
      const reportsList = reports?.reports ?? [];

      // By category
      const byCategory: Record<string, number> = {};
      reportsList.forEach((r: any) => { byCategory[r.category] = (byCategory[r.category] || 0) + 1; });

      // By status
      const byStatus: Record<string, number> = {};
      reportsList.forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

      // Daily trend (last 7 days)
      const dailyMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dailyMap[d.toISOString().slice(0, 10)] = 0;
      }
      reportsList.forEach((r: any) => {
        const day = new Date(r.createdAt).toISOString().slice(0, 10);
        if (dailyMap[day] !== undefined) dailyMap[day]++;
      });
      const dailyTrend = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

      // Avg resolution time (rough: resolved vs created diff)
      let totalHours = 0;
      let resolvedCount = 0;
      reportsList.forEach((r: any) => {
        if (r.status === "resolved" && r.updatedAt) {
          const created = new Date(r.createdAt).getTime();
          const resolved = new Date(r.updatedAt).getTime();
          totalHours += (resolved - created) / (1000 * 60 * 60);
          resolvedCount++;
        }
      });

      // By sector
      const sectorMap: Record<string, number> = {};
      reportsList.forEach((r: any) => { if (r.sector) sectorMap[r.sector] = (sectorMap[r.sector] || 0) + 1; });
      const bySector = Object.entries(sectorMap)
        .map(([sector, count]) => ({ sector, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setData({
        totalReports: reportsList.length,
        byCategory,
        byStatus,
        dailyTrend,
        avgResolutionHours: resolvedCount > 0 ? Math.round(totalHours / resolvedCount) : 0,
        bySector,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [currentDistrictId]);

  const MAX_BAR = Math.max(...(data?.dailyTrend.map(d => d.count) || [0]), 1);
  const CAT_LABELS: Record<string, string> = {
    robbery: "Robo", fight: "Pelea", suspicious: "Sospechoso", water_cut: "Corte de agua",
    garbage: "Basura", noise: "Ruido", missing_person: "Desaparecido", fire: "Incendio",
    medical_emergency: "Emergencia médica", other: "Otro", informal_commerce: "Comercio informal",
    prostitution: "Prostitución", drug_point: "Punto de drogas", bar_trouble: "Problemas en bar",
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /></div>;
  if (!data) return <div className="p-8 text-center text-muted-foreground">No hay datos disponibles</div>;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: BarChart3, label: "Total Reportes",   value: data.totalReports,          color: "#3b82f6" },
          { icon: Activity,  label: "Resueltos",        value: data.byStatus.resolved ?? 0, color: "#22c55e" },
          { icon: Clock,     label: "Tiempo prom. (h)", value: `${data.avgResolutionHours}h`, color: "#f59e0b" },
          { icon: TrendingUp,label: "Sectores activos", value: data.bySector.length,        color: "#a855f7" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl bg-card border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Daily trend chart */}
      <div className="p-4 rounded-xl bg-card border border-white/5">
        <p className="text-xs font-semibold text-white mb-3">Tendencia diaria (últimos 7 días)</p>
        <div className="flex items-end gap-2 h-24">
          {data.dailyTrend.map((d, i) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{d.count}</span>
              <div className="w-full rounded-t-md transition-all"
                style={{ height: `${(d.count / MAX_BAR) * 80}px`, minHeight: d.count > 0 ? "4px" : "0",
                  background: `linear-gradient(to top, #3b82f640, #3b82f6${d.count > 0 ? "80" : "20"})` }}
              />
              <span className="text-[8px] text-muted-foreground/60">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-card border border-white/5">
          <p className="text-xs font-semibold text-white mb-3">Por categoría</p>
          <div className="flex flex-col gap-1.5">
            {Object.entries(data.byCategory)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 8)
              .map(([cat, count], i) => {
                const pct = Math.round((count / data.totalReports) * 100);
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-24 truncate">{CAT_LABELS[cat] ?? cat}</span>
                    <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[11px] text-white font-semibold w-8 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Top sectors */}
        <div className="p-4 rounded-xl bg-card border border-white/5">
          <p className="text-xs font-semibold text-white mb-3">Top sectores</p>
          <div className="flex flex-col gap-1.5">
            {data.bySector.slice(0, 8).map((s, i) => (
              <div key={s.sector} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-6">#{i + 1}</span>
                <span className="text-[11px] text-white flex-1 truncate">{s.sector}</span>
                <span className="text-[11px] text-muted-foreground">{s.count} rep.</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
