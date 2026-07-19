/**
 * Servicios en vivo (rastreo GPS): start → ping → list → stop.
 * Verifica el ciclo completo y la autorización por broadcastKey.
 * Requiere DATABASE_URL — se salta si no hay DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";

describe.skipIf(!process.env.DATABASE_URL)("Servicios en vivo", () => {
  let app: any;
  let request: any;
  let db: any;
  let sql: any;
  let districtsTable: any;
  let usersTable: any;
  let districtId: number;
  let adminToken: string;

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
    db = (await import("@workspace/db")).db;
    const schema = await import("@workspace/db/schema");
    districtsTable = schema.districtsTable;
    usersTable = schema.usersTable;
    sql = (await import("drizzle-orm")).sql;

    const [d] = await db
      .insert(districtsTable)
      .values({
        slug: `lv-${Date.now()}`,
        name: "LV",
        province: "T",
        department: "T",
      })
      .returning();
    districtId = d.id;

    const [admin] = await db
      .insert(usersTable)
      .values({
        name: "Admin LV",
        email: `admin-lv-${Date.now()}@t.pe`,
        role: "admin",
        sector: "T",
        district: "T",
        districtId,
      })
      .returning();
    adminToken = jwt.sign(
      {
        sub: String(admin.id),
        role: "admin",
        districtId,
        district: "T",
        email: admin.email,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" },
    );
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(
      sql`DELETE FROM "live_tracks" WHERE "district_id" = ${districtId}`,
    );
    await db.execute(
      sql`DELETE FROM "live_providers" WHERE "district_id" = ${districtId}`,
    );
    await db.execute(
      sql`DELETE FROM "proximity_subscriptions" WHERE "district_id" = ${districtId}`,
    );
    await db.execute(
      sql`DELETE FROM "live_voice_clips" WHERE "district_id" = ${districtId}`,
    );
    await db.execute(
      sql`DELETE FROM "live_devices" WHERE "district_id" = ${districtId}`,
    );
    await db.execute(
      sql`DELETE FROM "users" WHERE "district_id" = ${districtId}`,
    );
    await db.execute(sql`DELETE FROM "districts" WHERE "id" = ${districtId}`);
  });

  it("start → ping → list → stop funciona de extremo a extremo", async () => {
    // start
    const start = await request(app).post("/api/live/start").send({
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
    const start = await request(app).post("/api/live/start").send({
      type: "panadero",
      latitude: -12.04,
      longitude: -76.97,
      districtId,
    });
    const { id, broadcastKey } = start.body;

    const bad = await request(app)
      .post(`/api/live/${id}/ping`)
      .send({
        broadcastKey: broadcastKey + "x",
        latitude: -12.04,
        longitude: -76.97,
      });
    expect(bad.status).toBe(403);

    await request(app).post(`/api/live/${id}/stop`).send({ broadcastKey });
  });

  it("GET /live/all exige super_admin (401 sin token)", async () => {
    const res = await request(app).get("/api/live/all");
    expect(res.status).toBe(401);
  });

  it("guarda la ruta (track) al moverse y aparece en el historial", async () => {
    const start = await request(app).post("/api/live/start").send({
      type: "recolector",
      latitude: -12.04,
      longitude: -76.97,
      districtId,
    });
    expect(start.status).toBe(201);
    const { id, broadcastKey } = start.body;

    // Pings que avanzan claramente (~111 m cada 0.001° de latitud) → nuevos puntos.
    for (const lat of [-12.041, -12.042, -12.043]) {
      const p = await request(app)
        .post(`/api/live/${id}/ping`)
        .send({ broadcastKey, latitude: lat, longitude: -76.97 });
      expect(p.status).toBe(200);
    }

    // La ruta debe tener el punto inicial + los 3 movimientos = 4.
    const track = await request(app).get(`/api/live/${id}/track`);
    expect(track.status).toBe(200);
    expect(track.body.points.length).toBe(4);
    expect(track.body.points[0]).toHaveProperty("lat");

    // Un ping que NO avanza (misma posición) no agrega punto.
    await request(app)
      .post(`/api/live/${id}/ping`)
      .send({ broadcastKey, latitude: -12.043, longitude: -76.97 });
    const track2 = await request(app).get(`/api/live/${id}/track`);
    expect(track2.body.points.length).toBe(4);

    // Historial del día: aparece la ruta con su conteo de puntos.
    const from = new Date(Date.now() - 3600_000).toISOString();
    const to = new Date(Date.now() + 3600_000).toISOString();
    const hist = await request(app).get(
      `/api/live/history?districtId=${districtId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=recolector`,
    );
    expect(hist.status).toBe(200);
    const mine = hist.body.routes.find((r: any) => r.id === id);
    expect(mine).toBeTruthy();
    expect(mine.points).toBe(4);

    await request(app).post(`/api/live/${id}/stop`).send({ broadcastKey });
  });

  it("'¿pasó por mi casa?' encuentra el punto más cercano y la hora", async () => {
    const start = await request(app).post("/api/live/start").send({
      type: "recolector",
      latitude: -12.05,
      longitude: -76.95,
      districtId,
    });
    const { id, broadcastKey } = start.body;
    // Recorre pasando MUY cerca de la "casa" (-12.052, -76.95).
    for (const lat of [-12.051, -12.052, -12.053]) {
      await request(app)
        .post(`/api/live/${id}/ping`)
        .send({ broadcastKey, latitude: lat, longitude: -76.95 });
    }

    const from = new Date(Date.now() - 3600_000).toISOString();
    const to = new Date(Date.now() + 3600_000).toISOString();

    // Casa exactamente sobre un punto de ruta → distancia ~0, passedNear true.
    const near = await request(app).get(
      `/api/live/passed?districtId=${districtId}&lat=-12.052&lng=-76.95&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    expect(near.status).toBe(200);
    expect(near.body.nearest).toBeTruthy();
    expect(near.body.nearest.distanceMeters).toBeLessThanOrEqual(60);
    expect(near.body.passedNear).toBe(true);
    expect(near.body.nearest.at).toBeTruthy();

    // Casa lejos (>2 km) → sin candidatos en la caja → nearest null.
    const far = await request(app).get(
      `/api/live/passed?districtId=${districtId}&lat=-12.20&lng=-77.20&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    expect(far.status).toBe(200);
    expect(far.body.nearest).toBeNull();
    expect(far.body.passedNear).toBe(false);

    await request(app).post(`/api/live/${id}/stop`).send({ broadcastKey });
  });

  it("dispositivo oficial: admin crea → ingesta crea transmisión verificada", async () => {
    // Sin token no se pueden gestionar dispositivos.
    const noAuth = await request(app).get("/api/live/devices");
    expect(noAuth.status).toBe(401);

    // Admin crea un dispositivo (recolector).
    const created = await request(app)
      .post("/api/live/devices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ label: "Camión Recolector 1", type: "recolector" });
    expect(created.status).toBe(201);
    const deviceKey = created.body.deviceKey;
    expect(typeof deviceKey).toBe("string");
    const deviceId = created.body.id;

    // Aparece en el listado del admin.
    const list = await request(app)
      .get("/api/live/devices")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.devices.some((d: any) => d.id === deviceId)).toBe(true);

    // Info pública por clave (modo dispositivo del app).
    const info = await request(app).get(`/api/live/device/${deviceKey}`);
    expect(info.status).toBe(200);
    expect(info.body.type).toBe("recolector");

    // Ingesta: primer ping crea la transmisión verificada.
    const p1 = await request(app)
      .post(`/api/live/device/${deviceKey}/ping`)
      .send({ latitude: -12.06, longitude: -76.96 });
    expect(p1.status).toBe(200);
    const providerId = p1.body.providerId;

    // Aparece en /live como verificada (Oficial).
    const live = await request(app).get(`/api/live?districtId=${districtId}`);
    const mine = live.body.providers.find((x: any) => x.id === providerId);
    expect(mine).toBeTruthy();
    expect(mine.verified).toBe(true);

    // Un segundo ping (moviéndose) usa la MISMA transmisión y suma ruta.
    const p2 = await request(app)
      .post(`/api/live/device/${deviceKey}/ping`)
      .send({ latitude: -12.061, longitude: -76.96 });
    expect(p2.body.providerId).toBe(providerId);
    const track = await request(app).get(`/api/live/${providerId}/track`);
    expect(track.body.points.length).toBe(2);

    // Deshabilitar corta la transmisión y bloquea nuevos pings.
    const patch = await request(app)
      .patch(`/api/live/devices/${deviceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ enabled: false });
    expect(patch.status).toBe(200);
    const blocked = await request(app)
      .post(`/api/live/device/${deviceKey}/ping`)
      .send({ latitude: -12.062, longitude: -76.96 });
    expect(blocked.status).toBe(403);

    // Clave inválida → 404.
    const bad = await request(app)
      .post(`/api/live/device/claveinventada/ping`)
      .send({ latitude: -12, longitude: -76 });
    expect(bad.status).toBe(404);
  });

  it("clips de voz: admin sube/actualiza y el vecino los lista; borrar funciona", async () => {
    // Sin token no se puede escribir.
    const noAuth = await request(app).put("/api/live/voice-clips").send({
      type: "tamalero",
      audioUrl: "https://cdn.test/a.mp3",
      districtId,
    });
    expect(noAuth.status).toBe(401);

    // Admin crea el clip.
    const created = await request(app)
      .put("/api/live/voice-clips")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        type: "tamalero",
        audioUrl: "https://cdn.test/tamalera.mp3",
        phrase: "Vecino, la tamalera está cerca.",
        districtId,
      });
    expect(created.status).toBe(200);
    expect(created.body.audioUrl).toBe("https://cdn.test/tamalera.mp3");
    const clipId = created.body.id;

    // El vecino (sin login) los lista para reproducir.
    const list = await request(app).get(
      `/api/live/voice-clips?districtId=${districtId}`,
    );
    expect(list.status).toBe(200);
    const mine = list.body.clips.find((c: any) => c.type === "tamalero");
    expect(mine.audioUrl).toBe("https://cdn.test/tamalera.mp3");
    expect(mine.phrase).toContain("tamalera");

    // Segundo PUT del mismo tipo actualiza (no duplica).
    const upd = await request(app)
      .put("/api/live/voice-clips")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        type: "tamalero",
        audioUrl: "https://cdn.test/tamalera2.mp3",
        phrase: "Vecino, llegó la tamalera.",
        districtId,
      });
    expect(upd.body.id).toBe(clipId);
    const list2 = await request(app).get(
      `/api/live/voice-clips?districtId=${districtId}`,
    );
    expect(
      list2.body.clips.filter((c: any) => c.type === "tamalero").length,
    ).toBe(1);
    expect(
      list2.body.clips.find((c: any) => c.type === "tamalero").audioUrl,
    ).toBe("https://cdn.test/tamalera2.mp3");

    // Eliminar.
    const del = await request(app)
      .delete(`/api/live/voice-clips/${clipId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(del.status).toBe(200);
    const list3 = await request(app).get(
      `/api/live/voice-clips?districtId=${districtId}`,
    );
    expect(
      list3.body.clips.find((c: any) => c.type === "tamalero"),
    ).toBeUndefined();
  });

  it("suscripción de proximidad: upsert por token, valida y da de baja", async () => {
    const token = `tok-${Date.now()}`;

    // Falta pushToken → 400.
    const bad = await request(app)
      .put("/api/live/proximity-subscription")
      .send({ districtId, homeLat: -12.04, homeLng: -76.97 });
    expect(bad.status).toBe(400);

    // Alta.
    const put1 = await request(app)
      .put("/api/live/proximity-subscription")
      .send({
        pushToken: token,
        districtId,
        homeLat: -12.04,
        homeLng: -76.97,
        radiusM: 300,
        types: ["recolector"],
      });
    expect(put1.status).toBe(200);

    // Segundo PUT del mismo token actualiza (no duplica) — token es único.
    const put2 = await request(app)
      .put("/api/live/proximity-subscription")
      .send({
        pushToken: token,
        districtId,
        homeLat: -12.05,
        homeLng: -76.98,
        radiusM: 500,
        types: ["recolector", "tamalero"],
      });
    expect(put2.status).toBe(200);

    const [{ count }] = await db
      .execute(
        sql`SELECT count(*)::int AS count FROM "proximity_subscriptions" WHERE "push_token" = ${token}`,
      )
      .then((r: any) => r.rows ?? r);
    expect(Number(count)).toBe(1);

    // Un ping de proveedor cercano NO rompe (aunque FCM no esté configurado).
    const start = await request(app).post("/api/live/start").send({
      type: "recolector",
      latitude: -12.05,
      longitude: -76.98,
      districtId,
    });
    const ping = await request(app)
      .post(`/api/live/${start.body.id}/ping`)
      .send({
        broadcastKey: start.body.broadcastKey,
        latitude: -12.0505,
        longitude: -76.98,
      });
    expect(ping.status).toBe(200);
    await request(app)
      .post(`/api/live/${start.body.id}/stop`)
      .send({ broadcastKey: start.body.broadcastKey });

    // Baja.
    const del = await request(app)
      .delete("/api/live/proximity-subscription")
      .send({ pushToken: token });
    expect(del.status).toBe(200);
    const [{ count: c2 }] = await db
      .execute(
        sql`SELECT count(*)::int AS count FROM "proximity_subscriptions" WHERE "push_token" = ${token}`,
      )
      .then((r: any) => r.rows ?? r);
    expect(Number(c2)).toBe(0);
  });

  it("vendedor con etiqueta libre se guarda y se lista", async () => {
    const start = await request(app).post("/api/live/start").send({
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
