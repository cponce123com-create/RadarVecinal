import {
  AlertTriangle, Users, Eye, Droplets, Trash, Store,
  Volume2, UserX, Flame, Heart, Circle,
  Building2, Pill, GlassWater,
  LucideIcon
} from "lucide-react";
import { ReportCategory, ReportStatus, ReportUrgency, PanicAlertType } from "@workspace/api-client-react";

// ── Pilot district: San Ramón, Chanchamayo, Junín ──
export const DISTRICT = {
  name: "San Ramón",
  province: "Chanchamayo",
  region: "Junín",
  country: "Perú",
  displayName: "San Ramón, Chanchamayo",
  center: { lat: -11.1282, lng: -75.3554 },
  zoom: 15,
  bounds: {
    latMin: -11.165,
    latMax: -11.095,
    lngMin: -75.395,
    lngMax: -75.315,
  },
};

// Categories always reported anonymously
export const SENSITIVE_CATEGORIES = new Set<ReportCategory>([
  ReportCategory.informal_commerce,
  ReportCategory.prostitution,
  ReportCategory.drug_point,
  ReportCategory.bar_trouble,
]);

export const CATEGORY_CONFIG: Record<ReportCategory, {
  icon: LucideIcon;
  color: string;
  label: string;
  sensitive?: boolean;
}> = {
  [ReportCategory.robbery]:            { icon: AlertTriangle, color: "text-destructive",      label: "Robo / Asalto" },
  [ReportCategory.fight]:              { icon: Users,         color: "text-warning",           label: "Pelea Callejera" },
  [ReportCategory.suspicious]:         { icon: Eye,           color: "text-warning",           label: "Actitud Sospechosa" },
  [ReportCategory.water_cut]:          { icon: Droplets,      color: "text-primary",           label: "Corte de Agua" },
  [ReportCategory.garbage]:            { icon: Trash,         color: "text-muted-foreground",  label: "Basura Acumulada" },
  [ReportCategory.informal_commerce]:  { icon: Store,         color: "text-accent",            label: "Comercio Ilícito",        sensitive: true },
  [ReportCategory.noise]:              { icon: Volume2,       color: "text-warning",           label: "Ruidos Molestos" },
  [ReportCategory.missing_person]:     { icon: UserX,         color: "text-warning",           label: "Persona Desaparecida" },
  [ReportCategory.fire]:               { icon: Flame,         color: "text-destructive",       label: "Incendio" },
  [ReportCategory.medical_emergency]:  { icon: Heart,         color: "text-destructive",       label: "Emergencia Médica" },
  [ReportCategory.prostitution]:       { icon: Building2,     color: "text-pink-400",          label: "Prostíbulo / Local",      sensitive: true },
  [ReportCategory.drug_point]:         { icon: Pill,          color: "text-lime-400",          label: "Punto de Drogas",         sensitive: true },
  [ReportCategory.bar_trouble]:        { icon: GlassWater,    color: "text-amber-400",         label: "Bar / Cantina Problemática", sensitive: true },
  [ReportCategory.other]:              { icon: Circle,        color: "text-muted-foreground",  label: "Otro" },
};

export const STATUS_CONFIG: Record<ReportStatus, { color: string; label: string; bg: string }> = {
  [ReportStatus.active]:    { color: "text-destructive",      bg: "bg-destructive/10 border-destructive/20",  label: "Activo" },
  [ReportStatus.reviewing]: { color: "text-warning",          bg: "bg-warning/10 border-warning/20",          label: "En Revisión" },
  [ReportStatus.resolved]:  { color: "text-success",          bg: "bg-success/10 border-success/20",          label: "Resuelto" },
  [ReportStatus.archived]:  { color: "text-muted-foreground", bg: "bg-muted border-white/5",                  label: "Archivado" },
};

export const URGENCY_CONFIG: Record<ReportUrgency, { color: string; label: string; radius: number }> = {
  [ReportUrgency.low]:      { color: "text-success",                   label: "Baja",    radius: 500  },
  [ReportUrgency.medium]:   { color: "text-warning",                   label: "Media",   radius: 1000 },
  [ReportUrgency.high]:     { color: "text-orange-500",                label: "Alta",    radius: 2000 },
  [ReportUrgency.critical]: { color: "text-destructive animate-pulse", label: "Crítica", radius: 3000 },
};

export const PANIC_TYPES: Record<PanicAlertType, { icon: LucideIcon; label: string; color: string }> = {
  [PanicAlertType.robbery]:        { icon: AlertTriangle, label: "Asalto en Progreso",    color: "bg-red-600" },
  [PanicAlertType.medical]:        { icon: Heart,         label: "Emergencia Médica",      color: "bg-blue-600" },
  [PanicAlertType.fight]:          { icon: Users,         label: "Violencia Física",       color: "bg-orange-600" },
  [PanicAlertType.fire]:           { icon: Flame,         label: "Incendio",               color: "bg-red-500" },
  [PanicAlertType.missing_person]: { icon: UserX,         label: "Extravío (Menor/Mayor)", color: "bg-amber-500" },
  [PanicAlertType.other]:          { icon: Circle,        label: "Otra Emergencia",        color: "bg-neutral-600" },
};

// Panic alert types in Spanish — for inline display
export const PANIC_TYPE_LABELS: Record<string, string> = {
  robbery:        "Asalto en Progreso",
  medical:        "Emergencia Médica",
  fight:          "Violencia Física",
  fire:           "Incendio",
  missing_person: "Persona Extraviada",
  other:          "Otra Emergencia",
};

// Sectors for San Ramón, Chanchamayo
export const SECTORS = [
  "San Ramón Centro",
  "La Merced",
  "Pampa del Carmen",
  "San Luis",
  "Los Ángeles",
  "Río Tarma",
  "El Milagro",
];

// Category hex colors for inline use
export const CAT_HEX: Record<string, string> = {
  robbery: "#ef4444", fight: "#f97316", suspicious: "#eab308",
  water_cut: "#3b82f6", garbage: "#6b7280", informal_commerce: "#a855f7",
  noise: "#f59e0b", missing_person: "#f59e0b", fire: "#ef4444",
  medical_emergency: "#ef4444",
  prostitution: "#ec4899", drug_point: "#84cc16", bar_trouble: "#f59e0b",
  other: "#6b7280",
};

// Alert radius by urgency (meters)
export const ALERT_RADIUS: Record<ReportUrgency, number> = {
  [ReportUrgency.low]:      500,
  [ReportUrgency.medium]:   1000,
  [ReportUrgency.high]:     2000,
  [ReportUrgency.critical]: 3000,
};
