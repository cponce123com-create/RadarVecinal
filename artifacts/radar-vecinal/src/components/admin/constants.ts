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

export type Tab = "reports" | "users" | "ads" | "analytics" | "superadmin";

export interface AdSlot {
  id: string;
  label: string;
  position: string;
  client: string;
  url: string;
  active: boolean;
  impressions: number;
  clicks: number;
}

export const DEMO_AD_SLOTS: AdSlot[] = [
  { id: "ad1", label: "Banner Superior", position: "home_top",      client: "Ferretería San Ramón",  url: "https://example.com/fsr",   active: true,  impressions: 4820, clicks: 93 },
  { id: "ad2", label: "Tarjeta Mapa",    position: "map_card",      client: "Farmacia Cruz Verde",   url: "https://example.com/cv",    active: true,  impressions: 2115, clicks: 41 },
  { id: "ad3", label: "Banner Historial",position: "history_mid",   client: "Banco de Crédito BCP",  url: "https://example.com/bcp",   active: false, impressions: 0,    clicks: 0  },
  { id: "ad4", label: "Notificaciones",  position: "notif_footer",  client: "Disponible",            url: "",                          active: false, impressions: 0,    clicks: 0  },
];

export const seedDemoData = async (): Promise<{ seeded: boolean; message: string }> => {
  const res = await fetch("/api/seed", { method: "POST" });
  if (!res.ok) throw new Error("seed failed");
  return res.json();
};
