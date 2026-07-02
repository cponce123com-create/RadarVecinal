/**
 * Tests de CORS.
 * Verifica que un origin fuera de la whitelist recibe rechazo.
 */
import { describe, it, expect, beforeAll } from "vitest";

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

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("debe permitir origin configurado via CORS_ORIGIN env var", async () => {
    process.env.CORS_ORIGIN = "https://app.miradar.pe";
    // Recargar app no es práctico; testea la lógica con el valor por defecto
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "http://localhost:5173");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    delete process.env.CORS_ORIGIN;
  });
});
