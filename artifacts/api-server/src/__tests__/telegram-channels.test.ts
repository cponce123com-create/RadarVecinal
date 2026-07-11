/**
 * Canales de Telegram por distrito:
 *  - Webhook /vincular <código> asocia el chat al distrito correcto.
 *  - PUT /districts/:id/telegram (superadmin) fija/limpia el canal manualmente.
 *  - GET /districts/:id/telegram devuelve estado + código.
 * Requiere DATABASE_URL — se salta si no hay DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("Canales de Telegram por distrito", () => {
  let app: any;
  let request: any;
  let db: any;
  let sql: any;
  let usersTable: any;
  let districtsTable: any;
  let jwt: any;
  let eq: any;
  let districtId: number;
  let superToken: string;
  const code = `TESTCODE${Math.floor(Math.random() * 1000)}`;

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
    db = (await import("@workspace/db")).db;
    const schema = await import("@workspace/db/schema");
    usersTable = schema.usersTable;
    districtsTable = schema.districtsTable;
    const orm = await import("drizzle-orm");
    sql = orm.sql;
    eq = orm.eq;
    jwt = (await import("jsonwebtoken")).default;

    const [d] = await db
      .insert(districtsTable)
      .values({
        slug: `tg-${Date.now()}`,
        name: "TG District",
        province: "T",
        department: "T",
        telegramLinkCode: code,
      })
      .returning();
    districtId = d.id;

    const [admin] = await db
      .insert(usersTable)
      .values({ name: `tg_admin_${Date.now()}`, email: `tg_admin_${Date.now()}@t.pe`, role: "super_admin", sector: "T", district: "T", districtId, isActive: true })
      .returning();
    superToken = jwt.sign({ sub: String(admin.id), role: "super_admin" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(sql`DELETE FROM "users" WHERE "name" LIKE 'tg_admin_%'`);
    await db.execute(sql`DELETE FROM "districts" WHERE "name" = 'TG District'`);
  });

  it("webhook /vincular asocia el chat al distrito del código", async () => {
    const res = await request(app)
      .post("/api/telegram/webhook")
      .send({ channel_post: { chat: { id: -1009988776655 }, text: `/vincular ${code}` } });
    expect(res.status).toBe(200);

    const [d] = await db
      .select({ chatId: districtsTable.telegramChatId })
      .from(districtsTable)
      .where(eq(districtsTable.id, districtId))
      .limit(1);
    expect(d.chatId).toBe("-1009988776655");
  });

  it("webhook ignora códigos inválidos (no cambia nada)", async () => {
    const res = await request(app)
      .post("/api/telegram/webhook")
      .send({ channel_post: { chat: { id: -1 }, text: "/vincular NOEXISTE99" } });
    expect(res.status).toBe(200);
    const [d] = await db
      .select({ chatId: districtsTable.telegramChatId })
      .from(districtsTable)
      .where(eq(districtsTable.id, districtId))
      .limit(1);
    expect(d.chatId).toBe("-1009988776655"); // sigue el válido anterior
  });

  it("PUT /districts/:id/telegram fija el canal manualmente (superadmin)", async () => {
    const res = await request(app)
      .put(`/api/districts/${districtId}/telegram`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ chatId: "-100111222333" });
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(true);
    expect(res.body.chatId).toBe("-100111222333");
  });

  it("PUT rechaza formato de canal inválido", async () => {
    const res = await request(app)
      .put(`/api/districts/${districtId}/telegram`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ chatId: "no válido!!" });
    expect(res.status).toBe(400);
  });

  it("GET /districts/:id/telegram devuelve estado y código", async () => {
    const res = await request(app)
      .get(`/api/districts/${districtId}/telegram`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(true);
    expect(res.body.linkCode).toBe(code);
  });

  it("webhook exige el secret cuando está configurado", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "s3cr3t";
    const res = await request(app)
      .post("/api/telegram/webhook")
      .send({ channel_post: { chat: { id: -5 }, text: `/vincular ${code}` } });
    expect(res.status).toBe(403);
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });
});
