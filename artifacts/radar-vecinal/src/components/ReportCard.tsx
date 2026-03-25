import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MapPin, Clock, MessageSquare, ArrowUpRight } from "lucide-react";
import { Report } from "@workspace/api-client-react";
import { CATEGORY_CONFIG, STATUS_CONFIG, URGENCY_CONFIG } from "@/lib/constants";

interface ReportCardProps {
  report: Report;
  compact?: boolean;
}

export function ReportCard({ report, compact = false }: ReportCardProps) {
  const category = CATEGORY_CONFIG[report.category] || CATEGORY_CONFIG.other;
  const status = STATUS_CONFIG[report.status];
  const urgency = URGENCY_CONFIG[report.urgency];
  const Icon = category.icon;

  if (compact) {
    return (
      <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 hover:bg-card border border-white/5 transition-colors cursor-pointer group">
        <div className={`mt-1 p-2 rounded-lg bg-card border border-white/5 ${category.color} shadow-lg`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-semibold text-white truncate pr-4">{report.title}</h4>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true, locale: es })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{report.sector}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-5 rounded-2xl bg-card border border-white/5 hover:border-white/10 transition-all shadow-lg hover:shadow-xl group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-background border border-white/5 ${category.color} shadow-inner`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white leading-tight">{report.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${status.bg} ${status.color}`}>
                {status.label}
              </span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className={`text-xs font-medium ${urgency.color}`}>
                {urgency.label}
              </span>
            </div>
          </div>
        </div>
        <button className="p-2 text-muted-foreground hover:text-white rounded-full hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all">
          <ArrowUpRight className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
        {report.description}
      </p>

      {report.imageUrl && (
        <div className="w-full h-32 rounded-lg bg-muted mb-4 overflow-hidden border border-white/5 relative">
          <img src={report.imageUrl} alt="Evidencia" className="w-full h-full object-cover opacity-80" />
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            <span className="truncate max-w-[120px]">{report.sector}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{formatDistanceToNow(new Date(report.createdAt), { locale: es })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-white/70">
          <MessageSquare className="w-4 h-4" />
          <span>{report.confirmedCount}</span>
        </div>
      </div>
    </div>
  );
}
