// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  customFetch,
  setAuthTokenGetter,
  setAuthTokenRefresher,
  setBaseUrl,
} from "@workspace/api-client-react";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("customFetch - renovacion de sesion ante 401", () => {
  beforeEach(() => {
    setBaseUrl(null);
    setAuthTokenGetter(null);
    setAuthTokenRefresher(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renueva una vez y reintenta la peticion con el nuevo token", async () => {
    const authHeaders: (string | null)[] = [];
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const auth = new Headers(init?.headers).get("authorization");
        authHeaders.push(auth);
        if (auth === "Bearer fresh-token") return jsonResponse({ ok: true });
        return jsonResponse({ error: "expirado" }, 401);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    setAuthTokenGetter(() => "old-token");
    const refresher = vi.fn(async () => "fresh-token");
    setAuthTokenRefresher(refresher);

    const result = await customFetch<{ ok: boolean }>("/reports");

    expect(result).toEqual({ ok: true });
    expect(refresher).toHaveBeenCalledTimes(1);
    expect(authHeaders).toEqual(["Bearer old-token", "Bearer fresh-token"]);
  });

  it("comparte una sola renovacion entre varios 401 simultaneos", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const auth = new Headers(init?.headers).get("authorization");
        if (auth === "Bearer fresh-token") return jsonResponse({ ok: true });
        return jsonResponse({ error: "expirado" }, 401);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    setAuthTokenGetter(() => "old-token");
    const refresher = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "fresh-token";
    });
    setAuthTokenRefresher(refresher);

    await Promise.all([
      customFetch("/a"),
      customFetch("/b"),
      customFetch("/c"),
    ]);

    expect(refresher).toHaveBeenCalledTimes(1);
  });

  it("no intenta renovar en el endpoint de login", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "no" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const refresher = vi.fn(async () => "fresh-token");
    setAuthTokenRefresher(refresher);

    await expect(
      customFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "x" }),
      }),
    ).rejects.toBeTruthy();

    expect(refresher).not.toHaveBeenCalled();
  });
});
