import { motion } from "framer-motion";
import { FileText, AlertTriangle, CheckCircle, Users, type LucideIcon } from "lucide-react";

interface KpiCard {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
}

const KPI_CARDS: KpiCard[] = [
  { icon: FileText,      label: "Reportes Totales", value: "—", color: "#3b82f6" },
  { icon: AlertTriangle, label: "Alertas Activas",  value: "—", color: "#ef4444" },
  { icon: CheckCircle,   label: "Resueltos Hoy",    value: "—", color: "#22c55e" },
  { icon: Users,         label: "Usuarios",          value: "—", color: "#a855f7" },
];

interface Props {
  stats?: { totalReports?: number; activeAlerts?: number; resolvedToday?: number } | null;
  usersCount?: number;
}

export default function KpiCards({ stats, usersCount }: Props) {
  const cards = KPI_CARDS.map(kpi => {
    if (kpi.label === "Reportes Totales") return { ...kpi, value: stats?.totalReports ?? "—" };
    if (kpi.label === "Alertas Activas")  return { ...kpi, value: stats?.activeAlerts ?? "—" };
    if (kpi.label === "Resueltos Hoy")    return { ...kpi, value: stats?.resolvedToday ?? "—" };
    if (kpi.label === "Usuarios")         return { ...kpi, value: usersCount ?? "—" };
    return kpi;
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="p-4 rounded-xl bg-card border border-white/5 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}18` }}>
              <Icon className="w-5 h-5" style={{ color: kpi.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-white">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
