import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MapPin, Clock, CheckSquare } from "lucide-react";
import { Report } from "@workspace/api-client-react";
import { CATEGORY_CONFIG } from "@/lib/constants";

interface ReportCardProps {
  report: Report;
  compact?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  robbery: "#ef4444", fight: "#f97316", suspicious: "#eab308",
  water_cut: "#3b82f6", garbage: "#6b7280", informal_commerce: "#a855f7",
  noise: "#f59e0b", missing_person: "#f59e0b", fire: "#ef4444",
  medical_emergency: "#ef4444", other: "#6b7280",
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Activo",      color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  reviewing: { label: "En Revisión", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  resolved:  { label: "Resuelto",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  archived:  { label: "Archivado",   color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const URGENCY_META: Record<string, { label: string; color: string }> = {
  low:      { label: "Baja",    color: "#22c55e" },
  medium:   { label: "Media",   color: "#f59e0b" },
  high:     { label: "Alta",    color: "#f97316" },
  critical: { label: "Crítica", color: "#ef4444" },
};

export function ReportCard({ report, compact = false }: ReportCardProps) {
  const config = CATEGORY_CONFIG[report.category as keyof typeof CATEGORY_CONFIG] ?? CATEGORY_CONFIG.other;
  const color = CATEGORY_COLORS[report.category] ?? "#6b7280";
  const status = STATUS_META[report.status] ?? STATUS_META.active;
  const urgency = URGENCY_META[report.urgency] ?? URGENCY_META.medium;
  const Icon = config.icon;

  if (compact) {
    return (
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-white/5 hover:border-white/10 hover:bg-white/[0.015] transition-all cursor-pointer">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${color}18` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{report.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{report.sector}</span>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(report.createdAt), { locale: es })}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl bg-card border border-white/5 hover:border-white/10 overflow-hidden transition-all group">
      {/* Accent top line */}
      <div className="h-0.5 w-full" style={{ background: color }} />

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${color}18` }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-snug">{report.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ color: status.color, background: status.bg }}
              >
                {status.label}
              </span>
              <span className="text-[10px] font-medium" style={{ color: urgency.color }}>
                {urgency.label}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {report.description ? (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {report.description}
          </p>
        ) : null}

        {/* Image */}
        {report.imageUrl && (
          <div className="h-28 rounded-lg overflow-hidden bg-neutral-900 border border-white/5">
            <img src={report.imageUrl} alt="Evidencia" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[100px]">{report.sector}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(report.createdAt), { locale: es })}
            </span>
          </div>
          {report.confirmedCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-primary/70">
              <CheckSquare className="w-3 h-3" />
              {report.confirmedCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
