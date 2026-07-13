/**
 * Separación de confirmaciones (bug de auditoría):
 *  - /confirm ("el reporte es real", kind=validity) y
 *  - /confirm-resolution ("ya se resolvió", kind=resolution)
 * comparten tabla; antes el mismo vecino no podía hacer ambas (409).
 * Ahora son independientes.
 * Requiere DATABASE_URL — se salta si no hay DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("Confirmaciones validity/resolution", () => {
  let app: any;
  let request: any;
  let db: any;
  let sql: any;
  let reportsTable: any;
  let districtsTable: any;
  let districtId: number;
  let reportId: number;

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
    db = (await import("@workspace/db")).db;
    const schema = await import("@workspace/db/schema");
    reportsTable = schema.reportsTable;
    districtsTable = schema.districtsTable;
    sql = (await import("drizzle-orm")).sql;

    const [d] = await db
      .insert(districtsTable)
      .values({ slug: `ck-${Date.now()}`, name: "CK", province: "T", department: "T" })
      .returning();
    districtId = d.id;

    const [r] = await db
      .insert(reportsTable)
      .values({
        title: "CK report",
        description: "desc",
        category: "garbage",
        urgency: "low",
        latitude: -12,
        longitude: -76,
        sector: "Centro",
        districtId,
        district: "CK",
        authorName: "x",
        status: "resolved", // requerido por /confirm-resolution
      })
      .returning();
    reportId = r.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(sql`DELETE FROM "resolution_confirmations" WHERE "report_id" = ${reportId}`);
    await db.execute(sql`DELETE FROM "reports" WHERE "id" = ${reportId}`);
    await db.execute(sql`DELETE FROM "districts" WHERE "id" = ${districtId}`);
  });

  it("un mismo vecino puede confirmar VALIDEZ y RESOLUCIÓN (no chocan)", async () => {
    const v = await request(app).post(`/api/reports/${reportId}/confirm`).send({});
    expect(v.status).toBe(200);
    expect(v.body.confirmedCount).toBe(1);

    // Antes esto daba 409 por compartir tabla/unicidad. Ahora debe pasar.
    const r = await request(app).post(`/api/reports/${reportId}/confirm-resolution`).send({});
    expect(r.status).toBe(200);
    expect(r.body.resolutionConfirmedCount).toBe(1);
  });

  it("repetir la misma confirmación sí da 409", async () => {
    const dup = await request(app).post(`/api/reports/${reportId}/confirm`).send({});
    expect(dup.status).toBe(409);
    const dupR = await request(app).post(`/api/reports/${reportId}/confirm-resolution`).send({});
    expect(dupR.status).toBe(409);
  });
});
