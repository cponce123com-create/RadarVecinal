/**
 * Las sanciones deben HACERSE CUMPLIR, no solo registrarse:
 *  - Usuario suspendido (suspendedUntil futuro): 403 al crear reporte.
 *  - Usuario baneado (isActive=false) con token vigente: 403 al crear reporte
 *    (POST /reports usa optionalAuth y antes no revalidaba → bypass).
 *  - Usuario normal: 201.
 * Requiere DATABASE_URL — se salta si no hay DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("Sanciones aplicadas", () => {
  let app: any;
  let request: any;
  let db: any;
  let sql: any;
  let usersTable: any;
  let districtsTable: any;
  let jwt: any;
  let districtId: number;

  async function makeUser(
    tag: string,
    opts: { isActive?: boolean; suspendedUntil?: Date | null } = {},
  ) {
    const [u] = await db
      .insert(usersTable)
      .values({
        name: `sanc_${tag}`,
        email: `sanc_${tag}_${Date.now()}@t.pe`,
        role: "user",
        sector: "T",
        district: "T",
        districtId,
        isActive: opts.isActive ?? true,
        suspendedUntil: opts.suspendedUntil ?? null,
        reportsCount: 0,
      })
      .returning();
    const token = jwt.sign({ sub: String(u.id), role: "user" }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });
    return { id: u.id, token };
  }

  function reportBody() {
    return {
      title: "Prueba sanción",
      description: "descripción de prueba suficientemente larga",
      category: "robbery",
      urgency: "high",
      isAnonymous: false,
      latitude: -12.04,
      longitude: -76.97,
      sector: "Centro",
      districtId,
    };
  }

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
    db = (await import("@workspace/db")).db;
    const schema = await import("@workspace/db/schema");
    usersTable = schema.usersTable;
    districtsTable = schema.districtsTable;
    sql = (await import("drizzle-orm")).sql;
    jwt = (await import("jsonwebtoken")).default;

    const [d] = await db
      .insert(districtsTable)
      .values({ slug: `sanc-${Date.now()}`, name: "SANC", province: "T", department: "T" })
      .returning();
    districtId = d.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(sql`DELETE FROM "reports" WHERE "title" = 'Prueba sanción'`);
    await db.execute(sql`DELETE FROM "users" WHERE "name" LIKE 'sanc_%'`);
    await db.execute(sql`DELETE FROM "districts" WHERE "slug" LIKE 'sanc-%'`);
  });

  it("usuario normal puede crear reporte (201)", async () => {
    const { token } = await makeUser("ok");
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(reportBody());
    expect(res.status).toBe(201);
  });

  it("usuario SUSPENDIDO no puede crear reporte (403)", async () => {
    const { token } = await makeUser("susp", {
      suspendedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(reportBody());
    expect(res.status).toBe(403);
  });

  it("usuario BANEADO (token vigente) no puede crear reporte (403)", async () => {
    const { token } = await makeUser("ban", { isActive: false });
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(reportBody());
    expect(res.status).toBe(403);
  });
});
