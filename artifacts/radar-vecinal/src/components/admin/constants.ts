// ── Admin: constantes y tipos compartidos ───────────────────────────────────

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Activo",      color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  reviewing: { label: "En Revisión", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  resolved:  { label: "Resuelto",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  archived:  { label: "Archivado",   color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

export const ROLE_META: Record<string, { label: string; color: string }> = {
  admin:     { label: "Admin",       color: "#a855f7" },
  moderator: { label: "Moderador",   color: "#3b82f6" },
  user:      { label: "Usuario",     color: "#6b7280" },
};

export type Tab = "reports" | "users" | "ads" | "analytics" | "alerts" | "devices" | "superadmin";
