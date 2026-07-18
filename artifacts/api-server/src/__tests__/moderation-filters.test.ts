/**
 * Filtros de moderación (backend):
 *  - GET /users: status (active/suspended/banned), role, q, total.
 *  - GET /reports: q (búsqueda), from/to (rango de fechas).
 * Requiere DATABASE_URL — se salta si no hay DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("Filtros de moderación", () => {
  let app: any;
  let request: any;
  let db: any;
  let sql: any;
  let usersTable: any;
  let reportsTable: any;
  let districtsTable: any;
  let jwt: any;
  let districtId: number;
  let adminToken: string;
  const tag = `filt${Date.now()}`;

  beforeAll(async () => {
    app = (await import("../app")).default;
    request = (await import("supertest")).default;
    db = (await import("@workspace/db")).db;
    const schema = await import("@workspace/db/schema");
    usersTable = schema.usersTable;
    reportsTable = schema.reportsTable;
    districtsTable = schema.districtsTable;
    sql = (await import("drizzle-orm")).sql;
    jwt = (await import("jsonwebtoken")).default;

    const [d] = await db
      .insert(districtsTable)
      .values({ slug: `${tag}`, name: "FILT", province: "T", department: "T" })
      .returning();
    districtId = d.id;

    const [admin] = await db
      .insert(usersTable)
      .values({
        name: `${tag}_admin`,
        email: `${tag}_admin@t.pe`,
        role: "super_admin",
        sector: "T",
        district: "T",
        districtId,
        isActive: true,
      })
      .returning();
    adminToken = jwt.sign(
      { sub: String(admin.id), role: "super_admin" },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" },
    );

    // Usuarios con distintos estados/roles
    await db.insert(usersTable).values([
      {
        name: `${tag}_activo`,
        email: `${tag}_a@t.pe`,
        role: "user",
        sector: "T",
        district: "T",
        districtId,
        isActive: true,
      },
      {
        name: `${tag}_susp`,
        email: `${tag}_s@t.pe`,
        role: "user",
        sector: "T",
        district: "T",
        districtId,
        isActive: true,
        suspendedUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
      {
        name: `${tag}_ban`,
        email: `${tag}_b@t.pe`,
        role: "user",
        sector: "T",
        district: "T",
        districtId,
        isActive: false,
      },
      {
        name: `${tag}_mod`,
        email: `${tag}_m@t.pe`,
        role: "moderator",
        sector: "T",
        district: "T",
        districtId,
        isActive: true,
      },
    ]);

    // Reportes con títulos y fechas distintas
    await db.insert(reportsTable).values([
      {
        title: `${tag} incendio grande`,
        description: "d",
        category: "fire",
        urgency: "high",
        latitude: -12,
        longitude: -76,
        sector: "Centro",
        districtId,
        district: "FILT",
        authorName: "x",
        createdAt: new Date("2020-01-01"),
      },
      {
        title: `${tag} robo esquina`,
        description: "d",
        category: "robbery",
        urgency: "high",
        latitude: -12,
        longitude: -76,
        sector: "Centro",
        districtId,
        district: "FILT",
        authorName: "x",
        createdAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(
      sql`DELETE FROM "reports" WHERE "title" LIKE ${tag + "%"}`,
    );
    await db.execute(sql`DELETE FROM "users" WHERE "name" LIKE ${tag + "%"}`);
    await db.execute(sql`DELETE FROM "districts" WHERE "slug" = ${tag}`);
  });

  const get = (url: string) =>
    request(app).get(url).set("Authorization", `Bearer ${adminToken}`);

  it("GET /users?status=suspended devuelve solo suspendidos", async () => {
    const res = await get(`/api/users?status=suspended&q=${tag}`);
    expect(res.status).toBe(200);
    const names = res.body.users.map((u: any) => u.name);
    expect(names).toContain(`${tag}_susp`);
    expect(names).not.toContain(`${tag}_ban`);
    expect(names).not.toContain(`${tag}_activo`);
    expect(res.body.users.every((u: any) => u.status === "suspended")).toBe(
      true,
    );
  });

  it("GET /users?status=banned devuelve solo baneados", async () => {
    const res = await get(`/api/users?status=banned&q=${tag}`);
    const names = res.body.users.map((u: any) => u.name);
    expect(names).toContain(`${tag}_ban`);
    expect(names).not.toContain(`${tag}_susp`);
  });

  it("GET /users?role=moderator filtra por rol", async () => {
    const res = await get(`/api/users?role=moderator&q=${tag}`);
    const names = res.body.users.map((u: any) => u.name);
    expect(names).toContain(`${tag}_mod`);
    expect(res.body.users.every((u: any) => u.role === "moderator")).toBe(true);
  });

  it("GET /users?q busca por nombre y devuelve total", async () => {
    const res = await get(`/api/users?q=${tag}_activo`);
    expect(res.body.users.length).toBe(1);
    expect(typeof res.body.total).toBe("number");
  });

  it("GET /reports?q busca en título", async () => {
    const res = await get(`/api/reports?districtId=${districtId}&q=incendio`);
    expect(res.status).toBe(200);
    const titles = res.body.reports.map((r: any) => r.title);
    expect(titles.some((t: string) => t.includes("incendio"))).toBe(true);
    expect(titles.some((t: string) => t.includes("robo"))).toBe(false);
  });

  it("GET /reports?from filtra por fecha (excluye los antiguos)", async () => {
    const res = await get(
      `/api/reports?districtId=${districtId}&from=2021-01-01`,
    );
    const titles = res.body.reports.map((r: any) => r.title);
    expect(titles.some((t: string) => t.includes("robo"))).toBe(true);
    expect(titles.some((t: string) => t.includes("incendio grande"))).toBe(
      false,
    );
  });
});
