/**
 * apiConfig.ts — Configuración de URL base de la API
 *
 * - En web (PWA servida por Express): misma origen → ruta relativa /api
 * - En Capacitor (APK nativo): necesita URL absoluta porque
 *   el webview carga desde https://localhost
 * - Se detecta automáticamente en runtime via window.Capacitor
 */

import { setBaseUrl } from "@workspace/api-client-react";

const RENDER_URL = "https://radarvecinal.onrender.com";

/**
 * Detecta si la app está corriendo dentro del contenedor nativo de Capacitor.
 * Compatible con Capacitor 3+ (window.Capacitor es undefined en web normal).
 */
function isCapacitorNative(): boolean {
  return typeof window !== "undefined" && typeof (window as any).Capacitor !== "undefined";
}

/**
 * Inicializa la URL base de la API según el entorno.
 * Debe llamarse una vez al arrancar la app, antes de cualquier fetch.
 */
export function initApiBaseUrl(): void {
  if (isCapacitorNative()) {
    // Modo APK nativo: la web vive en https://localhost,
    // necesita URL absoluta del backend en Render
    setBaseUrl(RENDER_URL);
    if (import.meta.env.DEV) console.log("[API] Modo Capacitor nativo → base URL:", RENDER_URL);
  } else {
    // Modo web: mismo origen (Express sirve frontend + API)
    setBaseUrl(null);
    if (import.meta.env.DEV) console.log("[API] Modo web → ruta relativa /api");
  }
}
