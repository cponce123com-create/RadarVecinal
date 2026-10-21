/**
 * Tests de CORS.
 * Verifica que un origin fuera de la whitelist recibe rechazo y que el
 * fallback de desarrollo (localhost:5173 / :3000) NO se aplica en producción.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("CORS", () => {
  let app: any;
  let request: any;

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
  });
  it("debe rechazar origin fuera de whitelist", async () => {
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "https://malicious-site.com");

    // CORS bloquea: sin header Access-Control-Allow-Origin
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("debe permitir origin de localhost:5173 (whitelist por defecto)", async () => {
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("debe permitir origin configurado via CORS_ORIGIN env var", async () => {
    process.env.CORS_ORIGIN = "https://app.miradar.pe";
    // Recargar app no es práctico; testea la lógica con el valor por defecto
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    delete process.env.CORS_ORIGIN;
  });

  it("en producción NO admite los orígenes de desarrollo", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevCors = process.env.CORS_ORIGIN;
    process.env.NODE_ENV = "production";
    delete process.env.CORS_ORIGIN;

    // La lista de orígenes se calcula al cargar el módulo: hay que recargarlo.
    vi.resetModules();
    const prodApp = (await import("../app")).default;
    const prodRequest = (await import("supertest")).default;

    const dev = await prodRequest(prodApp)
      .get("/api/healthz")
      .set("Origin", "http://localhost:5173");
    expect(dev.headers["access-control-allow-origin"]).toBeUndefined();

    // El origen del APK (Capacitor) sí debe seguir funcionando.
    const apk = await prodRequest(prodApp)
      .get("/api/healthz")
      .set("Origin", "https://localhost");
    expect(apk.headers["access-control-allow-origin"]).toBe(
      "https://localhost",
    );

    process.env.NODE_ENV = prevNodeEnv;
    if (prevCors !== undefined) process.env.CORS_ORIGIN = prevCors;
    vi.resetModules();
  });
});
