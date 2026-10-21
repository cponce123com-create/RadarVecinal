/**
 * Recuperación de contraseña + "Mis reportes".
 * Requiere DATABASE_URL — se salta si no hay DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function pwBinding(passwordHash: string): string {
  return crypto
    .createHash("sha256")
    .update(passwordHash)
    .digest("hex")
    .slice(0, 16);
}

describe.skipIf(!process.env.DATABASE_URL)(
  "Recuperación de contraseña + mis reportes",
  () => {
    let app: any;
    let request: any;
    let db: any;
    let sql: any;
    let usersTable: any;
    let reportsTable: any;
    let districtsTable: any;
    let districtId: number;
    let userId: number;
    let email: string;
    let passwordHash: string;
    let token: string;

    beforeAll(async () => {
      app = (await import("../app")).default;
      request = (await import("supertest")).default;
      db = (await import("@workspace/db")).db;
      const schema = await import("@workspace/db/schema");
      usersTable = schema.usersTable;
      reportsTable = schema.reportsTable;
      districtsTable = schema.districtsTable;
      sql = (await import("drizzle-orm")).sql;

      const [d] = await db
        .insert(districtsTable)
        .values({
          slug: `rec-${Date.now()}`,
          name: "REC",
          province: "T",
          department: "T",
        })
        .returning();
      districtId = d.id;

      email = `rec-${Date.now()}@t.pe`;
      passwordHash = await bcrypt.hash("OldPass123", 10);
      const [u] = await db
        .insert(usersTable)
        .values({
          name: "Vecino Rec",
          email,
          passwordHash,
          role: "user",
          sector: "T",
          district: "T",
          districtId,
        })
        .returning();
      userId = u.id;
      token = jwt.sign(
        { sub: String(userId), role: "user", districtId, district: "T", email },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" },
      );
    });

    afterAll(async () => {
      if (!db) return;
      // Orden de borrado: primero las tablas que referencian a users (el login
      // del test crea un refresh_token) y luego el usuario y el distrito.
      await db.execute(
        sql`DELETE FROM "reports" WHERE "district_id" = ${districtId}`,
      );
      await db.execute(
        sql`DELETE FROM "refresh_tokens" WHERE "user_id" = ${userId}`,
      );
      await db.execute(
        sql`DELETE FROM "user_consents" WHERE "user_id" = ${userId}`,
      );
      await db.execute(
        sql`DELETE FROM "users" WHERE "district_id" = ${districtId}`,
      );
      await db.execute(sql`DELETE FROM "districts" WHERE "id" = ${districtId}`);
    });

    it("forgot-password responde genérico 200 (exista o no el correo)", async () => {
      const a = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email });
      expect(a.status).toBe(200);
      expect(a.body.ok).toBe(true);
      const b = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nadie@x.pe" });
      expect(b.status).toBe(200); // no revela si existe
    });

    it("reset-password con token válido cambia la contraseña (uso único)", async () => {
      const resetToken = jwt.sign(
        { sub: String(userId), purpose: "pwreset", v: pwBinding(passwordHash) },
        process.env.JWT_SECRET!,
        { expiresIn: "30m" },
      );
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: resetToken, password: "NewPass456" });
      expect(res.status).toBe(200);

      // La nueva contraseña permite login.
      const login = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "NewPass456" });
      expect(login.status).toBe(200);

      // Reusar el MISMO token ya no funciona (el hash cambió).
      const reuse = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: resetToken, password: "Another789" });
      expect(reuse.status).toBe(400);
    });

    it("reset-password con token inválido da 400", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "no.es.un.jwt", password: "Whatever123" });
      expect(res.status).toBe(400);
    });

    it("GET /reports/mine devuelve solo los reportes del vecino (401 sin token)", async () => {
      await db.insert(reportsTable).values([
        {
          title: "Mío 1",
          description: "d",
          category: "garbage",
          urgency: "low",
          latitude: -12,
          longitude: -76,
          sector: "T",
          districtId,
          district: "T",
          authorName: "Vecino Rec",
          authorUserId: userId,
        },
        {
          title: "Mío 2",
          description: "d",
          category: "noise",
          urgency: "low",
          latitude: -12,
          longitude: -76,
          sector: "T",
          districtId,
          district: "T",
          authorName: "Vecino Rec",
          authorUserId: userId,
        },
        {
          title: "De otro",
          description: "d",
          category: "noise",
          urgency: "low",
          latitude: -12,
          longitude: -76,
          sector: "T",
          districtId,
          district: "T",
          authorName: "Otro",
        },
      ]);

      const noAuth = await request(app).get("/api/reports/mine");
      expect(noAuth.status).toBe(401);

      const mine = await request(app)
        .get("/api/reports/mine")
        .set("Authorization", `Bearer ${token}`);
      expect(mine.status).toBe(200);
      expect(mine.body.total).toBe(2);
      expect(
        mine.body.reports.every((r: any) =>
          ["Mío 1", "Mío 2"].includes(r.title),
        ),
      ).toBe(true);
    });

    it("un token de recuperación NO sirve como token de sesión", async () => {
      // Ambos tokens se firman con el mismo JWT_SECRET. Si no se distinguiera
      // el propósito, el enlace del correo (que además se escribe en el log
      // cuando no hay SMTP) valdría como sesión durante 30 minutos.
      const resetToken = jwt.sign(
        { sub: String(userId), purpose: "pwreset", v: "cualquiera" },
        process.env.JWT_SECRET!,
        { expiresIn: "30m" },
      );

      const { verifyToken } = await import("../routes/auth");
      expect(verifyToken(resetToken)).toBeNull();

      const res = await request(app)
        .get("/api/reports/mine")
        .set("Authorization", `Bearer ${resetToken}`);
      expect(res.status).toBe(401);
    });

    it("limita las solicitudes de recuperación por IP (anti email bombing)", async () => {
      // El limitador de /api/auth usa email+IP como clave, así que rotar el
      // correo lo esquiva. El límite por IP debe cortar la enumeración.
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) {
        const res = await request(app)
          .post("/api/auth/forgot-password")
          .send({ email: `bomb-${i}-${Date.now()}@example.pe` });
        statuses.push(res.status);
      }
      expect(statuses).toContain(429);
      // Las primeras (incluidas las 2 del primer test) sí pasan.
      expect(statuses.filter((s) => s === 200).length).toBeGreaterThan(0);
    });
  },
);
