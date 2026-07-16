/**
 * liveProviders.ts — Servicios en vivo (rastreo GPS en tiempo real).
 *
 * Catálogo de tipos de transmisor y helpers de API. Un transmisor comparte su
 * ubicación en vivo (camión recolector, panadero, lechero, tamalero, gasero,
 * aguatero o un vendedor de comida dominical) y los vecinos lo ven moverse por
 * el mapa del distrito.
 */
import { customFetch } from "@workspace/api-client-react";

export type LiveProviderType =
  | "recolector"
  | "panadero"
  | "lechero"
  | "tamalero"
  | "gasero"
  | "agua"
  | "vendedor"
  | "otro";

export interface LiveProvider {
  id: string;
  type: LiveProviderType;
  label: string;
  displayName: string;
  latitude: number;
  longitude: number;
  startedAt: string;
  updatedAt: string;
}

export interface ProviderMeta {
  type: LiveProviderType;
  emoji: string;
  label: string;
  /** Texto de ejemplo para la etiqueta libre (solo vendedor/otro). */
  hint?: string;
  color: string;
  /** Si true, pide una etiqueta libre ("¿Qué vendes hoy?"). */
  freeLabel?: boolean;
}

// El orden define cómo aparecen en el selector de transmisión.
export const PROVIDER_META: ProviderMeta[] = [
  { type: "recolector", emoji: "🚛", label: "Camión recolector", color: "#22c55e" },
  { type: "panadero", emoji: "🍞", label: "Panadero", color: "#d97706" },
  { type: "lechero", emoji: "🥛", label: "Lechero", color: "#38bdf8" },
  { type: "tamalero", emoji: "🫔", label: "Tamalero", color: "#eab308" },
  { type: "gasero", emoji: "🔥", label: "Gasero", color: "#f97316" },
  { type: "agua", emoji: "💧", label: "Reparto de agua", color: "#0ea5e9" },
  {
    type: "vendedor",
    emoji: "🍲",
    label: "Vendo comida hoy",
    hint: "Ej: Pollada, patasca, tamales…",
    color: "#ef4444",
    freeLabel: true,
  },
  {
    type: "otro",
    emoji: "📍",
    label: "Otro servicio",
    hint: "¿Qué ofreces? (ej: afilador, gasfitero…)",
    color: "#a78bfa",
    freeLabel: true,
  },
];

const META_BY_TYPE: Record<LiveProviderType, ProviderMeta> = Object.fromEntries(
  PROVIDER_META.map((m) => [m.type, m]),
) as Record<LiveProviderType, ProviderMeta>;

export function providerMeta(type: LiveProviderType): ProviderMeta {
  return META_BY_TYPE[type] ?? META_BY_TYPE.otro;
}

/** Nombre para mostrar de una transmisión: etiqueta libre > nombre > tipo. */
export function providerTitle(p: LiveProvider): string {
  const meta = providerMeta(p.type);
  return p.label?.trim() || p.displayName?.trim() || meta.label;
}

// ── API ─────────────────────────────────────────────────────────────────────

export async function listLiveProviders(
  districtId: number,
): Promise<LiveProvider[]> {
  const data = await customFetch<{ providers: LiveProvider[] }>(
    `/api/live?districtId=${districtId}`,
  );
  return data.providers ?? [];
}

export interface LiveProviderAdmin extends LiveProvider {
  districtId: number;
  districtName: string | null;
}

/** Solo super_admin: todas las transmisiones activas de todos los distritos. */
export async function listAllLiveProviders(): Promise<LiveProviderAdmin[]> {
  const data = await customFetch<{ providers: LiveProviderAdmin[] }>(
    `/api/live/all`,
  );
  return data.providers ?? [];
}

export async function startBroadcast(payload: {
  type: LiveProviderType;
  label?: string;
  displayName?: string;
  latitude: number;
  longitude: number;
  districtId: number;
}): Promise<{ id: string; broadcastKey: string }> {
  return customFetch<{ id: string; broadcastKey: string }>("/api/live/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function pingBroadcast(
  id: string,
  broadcastKey: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await customFetch(`/api/live/${id}/ping`, {
    method: "POST",
    body: JSON.stringify({ broadcastKey, latitude, longitude }),
  });
}

export async function stopBroadcast(
  id: string,
  broadcastKey: string,
): Promise<void> {
  await customFetch(`/api/live/${id}/stop`, {
    method: "POST",
    body: JSON.stringify({ broadcastKey }),
  });
}

// ── Persistencia local de la sesión de transmisión ──────────────────────────
// Guardamos id+clave para poder reanudar o detener aunque se recargue la app.
const LS_KEY = "rvs_live_session";

export interface LiveSession {
  id: string;
  broadcastKey: string;
  type: LiveProviderType;
  label: string;
  displayName: string;
  districtId: number;
  startedAt: number;
  /** Transmisión de prueba (superadmin): recorrido simulado, no GPS real. */
  simulate?: boolean;
}

export function saveLiveSession(s: LiveSession): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function loadLiveSession(): LiveSession | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as LiveSession) : null;
  } catch {
    return null;
  }
}

export function clearLiveSession(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}
