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
  verified?: boolean;
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

// ── Rutas (breadcrumbs) e historial ─────────────────────────────────────────

export interface TrackPoint {
  lat: number;
  lng: number;
  at: string;
}

export interface LiveRoute {
  id: string;
  type: LiveProviderType;
  label: string;
  displayName: string;
  isActive: boolean;
  startedAt: string;
  endedAt: string;
  points: number;
}

/** Puntos de la ruta de una transmisión (para la línea en vivo o el historial). */
export async function getProviderTrack(id: string): Promise<TrackPoint[]> {
  const data = await customFetch<{ points: TrackPoint[] }>(`/api/live/${id}/track`);
  return data.points ?? [];
}

export interface PassedResult {
  nearest: { distanceMeters: number; at: string; providerId: string } | null;
  passedNear: boolean;
  thresholdMeters: number;
}

/** "¿Pasó el recolector por mi casa?" — punto de ruta más cercano a lat/lng. */
export async function findWhenPassed(params: {
  districtId: number;
  lat: number;
  lng: number;
  from: string;
  to: string;
  type?: LiveProviderType;
}): Promise<PassedResult> {
  const q = new URLSearchParams({
    districtId: String(params.districtId),
    lat: String(params.lat),
    lng: String(params.lng),
    from: params.from,
    to: params.to,
    type: params.type ?? "recolector",
  });
  return customFetch<PassedResult>(`/api/live/passed?${q.toString()}`);
}

/** Historial de rutas de un distrito en un rango de fechas (día local). */
export async function listLiveHistory(params: {
  districtId: number;
  from: string;
  to: string;
  type?: LiveProviderType | "";
}): Promise<LiveRoute[]> {
  const q = new URLSearchParams({
    districtId: String(params.districtId),
    from: params.from,
    to: params.to,
  });
  if (params.type) q.set("type", params.type);
  const data = await customFetch<{ routes: LiveRoute[] }>(`/api/live/history?${q.toString()}`);
  return data.routes ?? [];
}

// ── Dispositivos oficiales (registro admin + modo dispositivo) ──────────────

export interface LiveDevice {
  id: string;
  type: LiveProviderType;
  label: string;
  deviceKey: string;
  enabled: boolean;
  liveNow?: boolean;
  createdAt: string;
}

export interface DeviceInfo {
  id: string;
  type: LiveProviderType;
  label: string;
  districtId: number;
  districtName: string | null;
  enabled: boolean;
}

export async function listDevices(districtId?: number): Promise<LiveDevice[]> {
  const q = districtId ? `?districtId=${districtId}` : "";
  const data = await customFetch<{ devices: LiveDevice[] }>(`/api/live/devices${q}`);
  return data.devices ?? [];
}

export async function createDevice(body: {
  label: string;
  type?: LiveProviderType;
  districtId?: number;
}): Promise<LiveDevice> {
  return customFetch<LiveDevice>(`/api/live/devices`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateDevice(
  id: string,
  patch: { label?: string; enabled?: boolean },
): Promise<LiveDevice> {
  return customFetch<LiveDevice>(`/api/live/devices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteDevice(id: string): Promise<void> {
  await customFetch(`/api/live/devices/${id}`, { method: "DELETE" });
}

/** Modo dispositivo (celular montado): info pública por deviceKey. */
export async function getDeviceInfo(deviceKey: string): Promise<DeviceInfo> {
  return customFetch<DeviceInfo>(`/api/live/device/${deviceKey}`);
}

export async function devicePing(deviceKey: string, latitude: number, longitude: number): Promise<void> {
  await customFetch(`/api/live/device/${deviceKey}/ping`, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  });
}

export async function deviceStop(deviceKey: string): Promise<void> {
  await customFetch(`/api/live/device/${deviceKey}/stop`, { method: "POST" });
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
