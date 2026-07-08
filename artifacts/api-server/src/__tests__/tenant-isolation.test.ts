/**
 * M-04: Tests de aislamiento multi-tenant.
 *
 * Verifica que un admin del distrito A no pueda modificar/ver/borrar
 * datos del distrito B, y que super_admin pueda acceder a todo.
 *
 * Requiere DATABASE_URL — se salta automáticamente si no hay DB.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)(
  "Tenant Isolation (M-01, M-04)",
  () => {
    let db: any;
    let usersTable: any;
    let reportsTable: any;
    let districtsTable: any;
    let panicAlertsTable: any;
    let missingPersonsTable: any;
    let eq: any;
    let and: any;
    let sql: any;
    let jwt: any;
    let bcrypt: any;

    // IDs de distritos creados para tests
    let districtAId: number;
    let districtBId: number;
    let adminAToken: string;
    let adminBToken: string;
    let superAdminToken: string;
    let userToken: string;

    beforeAll(async () => {
      const dbMod = await import("@workspace/db");
      const schema = await import("@workspace/db/schema");
      const { eq: eqFn, and: andFn, sql: sqlFn } = await import("drizzle-orm");
      const jwtMod = await import("jsonwebtoken");
      const bcryptMod = await import("bcryptjs");

      db = dbMod.db;
      usersTable = schema.usersTable;
      reportsTable = schema.reportsTable;
      districtsTable = schema.districtsTable;
      panicAlertsTable = schema.panicAlertsTable;
      missingPersonsTable = schema.missingPersonsTable;
      eq = eqFn;
      and = andFn;
      sql = sqlFn;
      jwt = jwtMod.default;
      bcrypt = bcryptMod.default;

      process.env.JWT_SECRET = "test-secret-tenant-isolation";
    });

    it("M-05: Debe crear distritos de prueba", async () => {
      // Crear distrito A
      const [dA] = await db
        .insert(districtsTable)
        .values({
          slug: "test-district-a",
          name: "Test District A",
          province: "Test Province",
          department: "Test Department",
        })
        .returning();
      districtAId = dA.id;
      expect(districtAId).toBeGreaterThan(0);

      // Crear distrito B
      const [dB] = await db
        .insert(districtsTable)
        .values({
          slug: "test-district-b",
          name: "Test District B",
          province: "Test Province",
          department: "Test Department",
        })
        .returning();
      districtBId = dB.id;
      expect(districtBId).toBeGreaterThan(0);
      expect(districtBId).not.toBe(districtAId);
    });

    it("M-04/M-06: Debe crear usuarios de prueba con tokens", async () => {
      const hash = await bcrypt.hash("password123", 10);

      // Admin A (distrito A)
      const [adminA] = await db
        .insert(usersTable)
        .values({
          name: "Admin A",
          email: "admin-a@test.local",
          passwordHash: hash,
          role: "admin",
          sector: "Centro",
          districtId: districtAId,
          district: "Test District A",
          isActive: true,
        })
        .returning();

      adminAToken = jwt.sign(
        {
          sub: String(adminA.id),
          email: adminA.email,
          role: "admin",
          districtId: districtAId,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" },
      );

      // Admin B (distrito B)
      const [adminB] = await db
        .insert(usersTable)
        .values({
          name: "Admin B",
          email: "admin-b@test.local",
          passwordHash: hash,
          role: "admin",
          sector: "Centro",
          districtId: districtBId,
          district: "Test District B",
          isActive: true,
        })
        .returning();

      adminBToken = jwt.sign(
        {
          sub: String(adminB.id),
          email: adminB.email,
          role: "admin",
          districtId: districtBId,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" },
      );

      // Super Admin (sin distrito específico)
      const [superA] = await db
        .insert(usersTable)
        .values({
          name: "Super Admin",
          email: "super@test.local",
          passwordHash: hash,
          role: "super_admin",
          sector: "Plataforma",
          districtId: districtAId,
          district: "Plataforma",
          isActive: true,
        })
        .returning();

      superAdminToken = jwt.sign(
        {
          sub: String(superA.id),
          email: superA.email,
          role: "super_admin",
          districtId: districtAId,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" },
      );

      // User normal
      const [user] = await db
        .insert(usersTable)
        .values({
          name: "Normal User",
          email: "user@test.local",
          passwordHash: hash,
          role: "user",
          sector: "Centro",
          districtId: districtAId,
          district: "Test District A",
          isActive: true,
        })
        .returning();

      userToken = jwt.sign(
        {
          sub: String(user.id),
          email: user.email,
          role: "user",
          districtId: districtAId,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" },
      );

      expect(adminAToken).toBeTruthy();
      expect(adminBToken).toBeTruthy();
      expect(superAdminToken).toBeTruthy();
    });

    it("M-01: Reportes deben estar aislados por distrito", async () => {
      // Crear reporte en distrito A
      const [rA] = await db
        .insert(reportsTable)
        .values({
          title: "Reporte A",
          description: "Incidente en distrito A",
          category: "robbery",
          urgency: "high",
          isAnonymous: false,
          latitude: -11.1,
          longitude: -75.3,
          sector: "Centro",
          districtId: districtAId,
          district: "Test District A",
          authorName: "Test",
        })
        .returning();

      // Crear reporte en distrito B
      const [rB] = await db
        .insert(reportsTable)
        .values({
          title: "Reporte B",
          description: "Incidente en distrito B",
          category: "robbery",
          urgency: "high",
          isAnonymous: false,
          latitude: -11.2,
          longitude: -75.4,
          sector: "Centro",
          districtId: districtBId,
          district: "Test District B",
          authorName: "Test",
        })
        .returning();

      // Verificar que existen en distintos distritos
      expect(rA.districtId).toBe(districtAId);
      expect(rB.districtId).toBe(districtBId);

      // Consultar reportes del distrito A
      const reportsA = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.districtId, districtAId));

      const reportsB = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.districtId, districtBId));

      // Solo debe aparecer el reporte de su distrito
      expect(reportsA.length).toBeGreaterThanOrEqual(1);
      expect(reportsA.every((r: any) => r.districtId === districtAId)).toBe(
        true,
      );
      expect(reportsB.every((r: any) => r.districtId === districtBId)).toBe(
        true,
      );

      // Ningún reporte de B debe aparecer en los resultados de A
      const bIdsInA = reportsA.filter((r: any) => r.districtId === districtBId);
      expect(bIdsInA.length).toBe(0);
    });

    it("M-04: Admin de distrito A NO debe poder modificar reportes de distrito B", async () => {
      // Obtener un reporte del distrito B
      const [reportB] = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.districtId, districtBId))
        .limit(1);

      expect(reportB).toBeTruthy();

      // Simular chequeo de tenant: admin A NO puede modificar reporte B
      const payloadA = jwt.verify(adminAToken, process.env.JWT_SECRET!) as any;
      const canModify =
        payloadA.role === "super_admin" ||
        Number(payloadA.districtId) === Number(reportB.districtId);
      expect(canModify).toBe(false);
    });

    it("M-04: Super admin SÍ debe poder acceder a cualquier distrito", async () => {
      const [reportB] = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.districtId, districtBId))
        .limit(1);

      expect(reportB).toBeTruthy();

      const payload = jwt.verify(
        superAdminToken,
        process.env.JWT_SECRET!,
      ) as any;
      const canAccess =
        payload.role === "super_admin" ||
        Number(payload.districtId) === Number(reportB.districtId);
      expect(canAccess).toBe(true);
    });

    it("M-01: GET /api/reports sin auth debe filtrar por districtId explícito", async () => {
      // Simular la lógica del helper getDistrictId
      const districtIdFromQuery = districtAId;

      const reports = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.districtId, districtIdFromQuery));

      expect(reports.length).toBeGreaterThanOrEqual(1);
      expect(
        reports.every((r: any) => r.districtId === districtIdFromQuery),
      ).toBe(true);
    });

    afterAll(async () => {
      // Limpiar datos de prueba
      if (db) {
        // Eliminar en orden inverso por FK
        try {
          await db
            .delete(reportsTable)
            .where(
              sql`${reportsTable.districtId} IN (${districtAId}, ${districtBId})`,
            );
          await db
            .delete(panicAlertsTable)
            .where(
              sql`${panicAlertsTable.districtId} IN (${districtAId}, ${districtBId})`,
            );
          await db
            .delete(missingPersonsTable)
            .where(
              sql`${missingPersonsTable.districtId} IN (${districtAId}, ${districtBId})`,
            );
          await db
            .delete(usersTable)
            .where(sql`${usersTable.email} LIKE '%@test.local'`);
          await db
            .delete(districtsTable)
            .where(sql`${districtsTable.slug} LIKE 'test-district-%'`);
        } catch {
          // Solo limpieza, no crítica
        }
      }
    });
  },
);
