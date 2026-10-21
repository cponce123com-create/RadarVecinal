/**
 * URL base de la API en el APK nativo.
 *
 * Dentro del contenedor de Capacitor la webview carga desde
 * `https://localhost`, así que una ruta relativa `/api/...` apunta al propio
 * dispositivo y falla con "Failed to fetch". `apiConfig` detecta
 * `window.Capacitor` y fija la URL absoluta del backend; `customFetch` la
 * aplica. Este test cubre la cadena completa sin necesidad de un dispositivo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  customFetch,
  setAuthTokenGetter,
  setBaseUrl,
} from "@workspace/api-client-react";
import { initApiBaseUrl } from "@/lib/apiConfig";

const RENDER_URL = "https://radarvecinal.onrender.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("URL base de la API: web vs APK de Capacitor", () => {
  beforeEach(() => {
    setBaseUrl(null);
    setAuthTokenGetter(null);
    delete (window as unknown as Record<string, unknown>).Capacitor;
  });

  afterEach(() => {
    setBaseUrl(null);
    setAuthTokenGetter(null);
    delete (window as unknown as Record<string, unknown>).Capacitor;
    vi.unstubAllGlobals();
  });

  it("en web mantiene la ruta relativa (mismo origen)", async () => {
    initApiBaseUrl();

    const fetchMock = vi.fn(async () =>
      jsonResponse({ total: 0, reports: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/reports/mine?limit=20");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/reports/mine?limit=20");
  });

  it("con window.Capacitor definido usa la URL absoluta del backend", async () => {
    (window as unknown as Record<string, unknown>).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
    };
    initApiBaseUrl();

    const fetchMock = vi.fn(async () =>
      jsonResponse({ total: 0, reports: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/reports/mine?limit=20");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${RENDER_URL}/api/reports/mine?limit=20`,
    );
  });

  it("en el APK adjunta el token de sesión que registra AuthContext", async () => {
    (window as unknown as Record<string, unknown>).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
    };
    initApiBaseUrl();
    setAuthTokenGetter(() => "token-de-sesion");

    let authHeader: string | null = null;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        authHeader = new Headers(init?.headers).get("authorization");
        return jsonResponse({ total: 0, reports: [] });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/reports/mine?limit=20");

    expect(authHeader).toBe("Bearer token-de-sesion");
  });

  it("no reescribe las URLs absolutas que ya vienen de un enlace externo", async () => {
    (window as unknown as Record<string, unknown>).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
    };
    initApiBaseUrl();

    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("https://otro-dominio.example/api/x");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://otro-dominio.example/api/x",
    );
  });
});
