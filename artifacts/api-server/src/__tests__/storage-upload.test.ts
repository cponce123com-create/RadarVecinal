/**
 * Subida de imágenes (Cloudinary):
 *  - /storage/uploads/request-url exige autenticación (401 sin token).
 *  - Con token válido pero SIN configurar Cloudinary, responde 503 con aviso
 *    claro (no un 500 opaco). Verifica el fix de auth + degradación elegante.
 * Requiere DATABASE_URL — se salta si no hay DB.
 */
import { describe, it, expect, beforeAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("Storage upload", () => {
  let app: any;
  let request: any;
  let db: any;
  let usersTable: any;
  let districtsTable: any;
  let jwt: any;
  let token: string;

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
    const dbMod = await import("@workspace/db");
    db = dbMod.db;
    const schema = await import("@workspace/db/schema");
    usersTable = schema.usersTable;
    districtsTable = schema.districtsTable;
    jwt = (await import("jsonwebtoken")).default;

    const [d] = await db
      .insert(districtsTable)
      .values({
        slug: `stor-${Date.now()}`,
        name: "S",
        province: "S",
        department: "S",
      })
      .returning();
    const [u] = await db
      .insert(usersTable)
      .values({
        name: "stor_user",
        email: `stor_${Date.now()}@t.pe`,
        role: "user",
        sector: "S",
        district: "S",
        districtId: d.id,
        isActive: true,
        reportsCount: 0,
      })
      .returning();
    token = jwt.sign(
      { sub: String(u.id), role: "user" },
      process.env.JWT_SECRET!,
      {
        expiresIn: "1h",
      },
    );
  });

  const body = { name: "foto.jpg", size: 1024, contentType: "image/jpeg" };

  it("rechaza sin autenticación (401)", async () => {
    const res = await request(app)
      .post("/api/storage/uploads/request-url")
      .send(body);
    expect(res.status).toBe(401);
  });

  it.skipIf(!!process.env.CLOUDINARY_CLOUD_NAME)(
    "con token pero sin Cloudinary configurado → 503 con aviso claro",
    async () => {
      const res = await request(app)
        .post("/api/storage/uploads/request-url")
        .set("Authorization", `Bearer ${token}`)
        .send(body);
      expect(res.status).toBe(503);
      expect(String(res.body.error)).toMatch(/almacenamiento|Cloudinary/i);
    },
  );

  it("rechaza tipos de archivo no permitidos (400)", async () => {
    const res = await request(app)
      .post("/api/storage/uploads/request-url")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "x.pdf", size: 1024, contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });
});
