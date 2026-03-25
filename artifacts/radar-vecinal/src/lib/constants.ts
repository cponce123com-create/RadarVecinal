import { 
  AlertTriangle, 
  Users, 
  Eye, 
  Droplets, 
  Trash, 
  Store, 
  Volume2, 
  UserX, 
  Flame, 
  Heart, 
  Circle,
  LucideIcon
} from "lucide-react";
import { ReportCategory, ReportStatus, ReportUrgency, PanicAlertType, MissingPersonStatus } from "@workspace/api-client-react";

export const CATEGORY_CONFIG: Record<ReportCategory, { icon: LucideIcon, color: string, label: string }> = {
  [ReportCategory.robbery]: { icon: AlertTriangle, color: "text-destructive", label: "Robo / Asalto" },
  [ReportCategory.fight]: { icon: Users, color: "text-warning", label: "Pelea Callejera" },
  [ReportCategory.suspicious]: { icon: Eye, color: "text-warning", label: "Actitud Sospechosa" },
  [ReportCategory.water_cut]: { icon: Droplets, color: "text-primary", label: "Corte de Agua" },
  [ReportCategory.garbage]: { icon: Trash, color: "text-muted-foreground", label: "Acumulación de Basura" },
  [ReportCategory.informal_commerce]: { icon: Store, color: "text-accent", label: "Comercio Informal" },
  [ReportCategory.noise]: { icon: Volume2, color: "text-warning", label: "Ruidos Molestos" },
  [ReportCategory.missing_person]: { icon: UserX, color: "text-warning", label: "Persona Desaparecida" },
  [ReportCategory.fire]: { icon: Flame, color: "text-destructive", label: "Incendio" },
  [ReportCategory.medical_emergency]: { icon: Heart, color: "text-destructive", label: "Emergencia Médica" },
  [ReportCategory.other]: { icon: Circle, color: "text-muted-foreground", label: "Otro" },
};

export const STATUS_CONFIG: Record<ReportStatus, { color: string, label: string, bg: string }> = {
  [ReportStatus.active]: { color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", label: "Activo" },
  [ReportStatus.reviewing]: { color: "text-warning", bg: "bg-warning/10 border-warning/20", label: "En Revisión" },
  [ReportStatus.resolved]: { color: "text-success", bg: "bg-success/10 border-success/20", label: "Resuelto" },
  [ReportStatus.archived]: { color: "text-muted-foreground", bg: "bg-muted border-white/5", label: "Archivado" },
};

export const URGENCY_CONFIG: Record<ReportUrgency, { color: string, label: string }> = {
  [ReportUrgency.low]: { color: "text-success", label: "Baja" },
  [ReportUrgency.medium]: { color: "text-warning", label: "Media" },
  [ReportUrgency.high]: { color: "text-orange-500", label: "Alta" },
  [ReportUrgency.critical]: { color: "text-destructive animate-pulse", label: "Crítica" },
};

export const PANIC_TYPES: Record<PanicAlertType, { icon: LucideIcon, label: string, color: string }> = {
  [PanicAlertType.robbery]: { icon: AlertTriangle, label: "Asalto en Progreso", color: "bg-red-600" },
  [PanicAlertType.medical]: { icon: Heart, label: "Emergencia Médica", color: "bg-blue-600" },
  [PanicAlertType.fight]: { icon: Users, label: "Violencia Física", color: "bg-orange-600" },
  [PanicAlertType.fire]: { icon: Flame, label: "Incendio", color: "bg-red-500" },
  [PanicAlertType.missing_person]: { icon: UserX, label: "Extravío (Menor/Mayor)", color: "bg-amber-500" },
  [PanicAlertType.other]: { icon: Circle, label: "Otra Emergencia", color: "bg-neutral-600" },
};

export const SECTORS = [
  "San Miguel Centro",
  "Maranga",
  "Pando",
  "Pueblo Libre Límite",
  "Magdalena Límite",
  "Costanera"
];
