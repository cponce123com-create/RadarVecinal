/**
 * RBAC de personas extraviadas (4 niveles):
 *  - moderador (viewer) puede EDITAR (PATCH) su distrito, pero NO eliminar.
 *  - municipalidad (municipal/admin) y super_admin pueden ELIMINAR (DELETE).
 * Requiere DATABASE_URL — se salta si no hay DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("Missing Persons RBAC", () => {
  let app: any;
  let request: any;
  let db: any;
  let sql: any;
  let usersTable: any;
  let missingPersonsTable: any;
  let districtsTable: any;
  let jwt: any;

  let districtId: number;
  let superToken: string;
  let viewerToken: string;
  let personId: number;

  async function makeUser(role: string, dId: number) {
    const [u] = await db
      .insert(usersTable)
      .values({
        name: `rbac_${role}`,
        email: `rbac_${role}_${Date.now()}@t.pe`,
        role,
        sector: "T",
        district: "T",
        districtId: dId,
        isActive: true,
        reportsCount: 0,
      })
      .returning();
    return jwt.sign({ sub: String(u.id), role }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });
  }

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
    const dbMod = await import("@workspace/db");
    db = dbMod.db;
    const schema = await import("@workspace/db/schema");
    usersTable = schema.usersTable;
    missingPersonsTable = schema.missingPersonsTable;
    districtsTable = schema.districtsTable;
    sql = (await import("drizzle-orm")).sql;
    jwt = (await import("jsonwebtoken")).default;

    const [d] = await db
      .insert(districtsTable)
      .values({
        slug: `rbac-${Date.now()}`,
        name: "RBAC",
        province: "T",
        department: "T",
      })
      .returning();
    districtId = d.id;

    superToken = await makeUser("super_admin", districtId);
    viewerToken = await makeUser("viewer", districtId);

    const [p] = await db
      .insert(missingPersonsTable)
      .values({
        districtId,
        name: "RBAC Person",
        clothing: "test",
        lastSeenLatitude: -11.1,
        lastSeenLongitude: -75.3,
        lastSeenAddress: "test",
        lastSeenAt: new Date(),
        contactInfo: "999",
        reportedBy: "tester",
      })
      .returning();
    personId = p.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(
      sql`DELETE FROM "missing_persons" WHERE "name" = 'RBAC Person'`,
    );
    // El DELETE de persona extraviada inserta en audit_log; hay que limpiarlo
    // antes que el distrito (FK audit_log.district_id → districts.id).
    await db.execute(
      sql`DELETE FROM "audit_log" WHERE "district_id" = ${districtId}`,
    );
    await db.execute(sql`DELETE FROM "users" WHERE "name" LIKE 'rbac_%'`);
    await db.execute(sql`DELETE FROM "districts" WHERE "slug" LIKE 'rbac-%'`);
  });

  it("F2: el público ve el teléfono de contacto pero NO el nombre del reportante", async () => {
    // Sin token (público): contactInfo visible, reportedBy oculto.
    const res = await request(app).get(
      `/api/missing-persons?districtId=${districtId}`,
    );
    expect(res.status).toBe(200);
    const person = (res.body.alerts ?? []).find(
      (a: any) => String(a.id) === String(personId),
    );
    expect(person).toBeTruthy();
    expect(person.contactInfo).toBe("999");
    expect(person.reportedBy).toBeUndefined();
  });

  it("viewer (moderador) NO puede eliminar", async () => {
    const res = await request(app)
      .delete(`/api/missing-persons/${personId}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });

  it("viewer (moderador) SÍ puede editar (PATCH)", async () => {
    const res = await request(app)
      .patch(`/api/missing-persons/${personId}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ clothing: "editado por moderador" });
    expect(res.status).toBe(200);
    expect(res.body.clothing).toBe("editado por moderador");
  });

  it("super_admin SÍ puede eliminar (borrado suave)", async () => {
    const res = await request(app)
      .delete(`/api/missing-persons/${personId}`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Ya no aparece en el listado (deletedAt filtrado)
    const list = await request(app)
      .get(`/api/missing-persons?districtId=${districtId}`)
      .set("Authorization", `Bearer ${superToken}`);
    const ids = (list.body.alerts ?? []).map((a: any) => String(a.id));
    expect(ids).not.toContain(String(personId));
  });
});
