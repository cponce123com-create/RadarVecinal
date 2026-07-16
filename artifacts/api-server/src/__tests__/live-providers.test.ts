/**
 * Servicios en vivo (rastreo GPS): start → ping → list → stop.
 * Verifica el ciclo completo y la autorización por broadcastKey.
 * Requiere DATABASE_URL — se salta si no hay DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("Servicios en vivo", () => {
  let app: any;
  let request: any;
  let db: any;
  let sql: any;
  let districtsTable: any;
  let districtId: number;

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
    db = (await import("@workspace/db")).db;
    const schema = await import("@workspace/db/schema");
    districtsTable = schema.districtsTable;
    sql = (await import("drizzle-orm")).sql;

    const [d] = await db
      .insert(districtsTable)
      .values({ slug: `lv-${Date.now()}`, name: "LV", province: "T", department: "T" })
      .returning();
    districtId = d.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(sql`DELETE FROM "live_providers" WHERE "district_id" = ${districtId}`);
    await db.execute(sql`DELETE FROM "districts" WHERE "id" = ${districtId}`);
  });

  it("start → ping → list → stop funciona de extremo a extremo", async () => {
    // start
    const start = await request(app)
      .post("/api/live/start")
      .send({
        type: "recolector",
        latitude: -12.04,
        longitude: -76.97,
        districtId,
      });
    expect(start.status).toBe(201);
    expect(start.body.id).toBeTruthy();
    expect(typeof start.body.broadcastKey).toBe("string");
    const { id, broadcastKey } = start.body;

    // ping (mueve la ubicación)
    const ping = await request(app)
      .post(`/api/live/${id}/ping`)
      .send({ broadcastKey, latitude: -12.05, longitude: -76.98 });
    expect(ping.status).toBe(200);

    // list — aparece activo y fresco
    const list = await request(app).get(`/api/live?districtId=${districtId}`);
    expect(list.status).toBe(200);
    const mine = list.body.providers.find((p: any) => p.id === id);
    expect(mine).toBeTruthy();
    expect(mine.type).toBe("recolector");
    expect(mine.latitude).toBeCloseTo(-12.05, 3);

    // stop
    const stop = await request(app)
      .post(`/api/live/${id}/stop`)
      .send({ broadcastKey });
    expect(stop.status).toBe(200);

    // ya no aparece en la lista
    const list2 = await request(app).get(`/api/live?districtId=${districtId}`);
    expect(list2.body.providers.find((p: any) => p.id === id)).toBeUndefined();
  });

  it("ping con clave equivocada da 403", async () => {
    const start = await request(app)
      .post("/api/live/start")
      .send({ type: "panadero", latitude: -12.04, longitude: -76.97, districtId });
    const { id, broadcastKey } = start.body;

    const bad = await request(app)
      .post(`/api/live/${id}/ping`)
      .send({ broadcastKey: broadcastKey + "x", latitude: -12.04, longitude: -76.97 });
    expect(bad.status).toBe(403);

    await request(app).post(`/api/live/${id}/stop`).send({ broadcastKey });
  });

  it("vendedor con etiqueta libre se guarda y se lista", async () => {
    const start = await request(app)
      .post("/api/live/start")
      .send({
        type: "vendedor",
        label: "Vendo patasca y pollada",
        displayName: "Doña Rosa",
        latitude: -12.04,
        longitude: -76.97,
        districtId,
      });
    expect(start.status).toBe(201);
    const { id, broadcastKey } = start.body;

    const list = await request(app).get(`/api/live?districtId=${districtId}`);
    const mine = list.body.providers.find((p: any) => p.id === id);
    expect(mine.label).toBe("Vendo patasca y pollada");
    expect(mine.displayName).toBe("Doña Rosa");

    await request(app).post(`/api/live/${id}/stop`).send({ broadcastKey });
  });
});
