/**
 * Tests de Row Level Security (RLS) para aislamiento multi-tenant.
 *
 * Verifica que:
 *   1. Un usuario normal solo ve datos del distrito cuyo ID está en app.district_id
 *   2. Un super_admin puede ver datos de CUALQUIER distrito (bypass de RLS)
 *   3. current_setting con missing_ok=true no falla cuando no hay variable seteada
 *
 * Requiere DATABASE_URL — se salta automáticamente si no está configurada.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)(
  "RLS Tenant Isolation (0007, 0009)",
  () => {
    let db: any;
    let sql: any;
    let reportsTable: any;
    let districtsTable: any;
    let testDistrict1Id: number;
    let testDistrict2Id: number;

    beforeAll(async () => {
      const drizzle = await import("@workspace/db");
      db = drizzle.db;
      const orm = await import("drizzle-orm");
      sql = orm.sql;
      const schema = await import("@workspace/db/schema");
      reportsTable = schema.reportsTable;
      districtsTable = schema.districtsTable;

      // Crear distritos de prueba
      const [d1] = await db.insert(districtsTable).values({
        slug: "test-rls-district-a",
        name: "Test RLS District A",
        province: "Test",
        department: "Test",
        isActive: true,
      }).returning();
      testDistrict1Id = d1.id;

      const [d2] = await db.insert(districtsTable).values({
        slug: "test-rls-district-b",
        name: "Test RLS District B",
        province: "Test",
        department: "Test",
        isActive: true,
      }).returning();
      testDistrict2Id = d2.id;

      // Insertar un reporte en cada distrito
      await db.execute(sql`
        INSERT INTO "reports" ("title", "category", "urgency", "description", "sector", "author_name", "district", "district_id", "latitude", "longitude", "is_anonymous", "department", "confirmed_count")
        VALUES ('RLS Test Report A', 'other', 'normal', 'test', 'test', 'test', 'Test', ${testDistrict1Id}, -11.1, -75.3, false, 'Test', 0)
      `);
      await db.execute(sql`
        INSERT INTO "reports" ("title", "category", "urgency", "description", "sector", "author_name", "district", "district_id", "latitude", "longitude", "is_anonymous", "department", "confirmed_count")
        VALUES ('RLS Test Report B', 'other', 'normal', 'test', 'test', 'test', 'Test', ${testDistrict2Id}, -11.2, -75.4, false, 'Test', 0)
      `);
    });

    afterAll(async () => {
      if (!db) return;
      await db.execute(sql`DELETE FROM "reports" WHERE "title" LIKE 'RLS Test Report%'`);
      await db.execute(sql`DELETE FROM "districts" WHERE "slug" LIKE 'test-rls-district-%'`);
    });

    it("debe filtrar reportes por app.district_id cuando role=admin", async () => {
      await db.execute(sql`SELECT set_config('app.role', 'admin', true)`);
      await db.execute(sql`SELECT set_config('app.district_id', ${String(testDistrict1Id)}, true)`);

      const { rows } = await db.execute(sql`
        SELECT "title" FROM "reports" WHERE "title" LIKE 'RLS Test Report%'
      `);

      // Con RLS activo, solo debería ver el reporte del distrito A
      expect(rows.length).toBe(1);
      expect(rows[0].title).toBe("RLS Test Report A");
    });

    it("super_admin debe poder ver reportes de ambos distritos (bypass RLS)", async () => {
      await db.execute(sql`SELECT set_config('app.role', 'super_admin', true)`);
      await db.execute(sql`SELECT set_config('app.district_id', ${String(testDistrict1Id)}, true)`);

      const { rows } = await db.execute(sql`
        SELECT "title" FROM "reports" WHERE "title" LIKE 'RLS Test Report%'
      `);

      // super_admin ve ambos por la política super_admin_all_reports
      expect(rows.length).toBe(2);
      expect(rows.map((r: any) => r.title).sort()).toEqual(["RLS Test Report A", "RLS Test Report B"]);
    });

    it("current_setting con missing_ok=true no debe fallar sin variable seteada", async () => {
      const { rows } = await db.execute(sql`SELECT current_setting('app.role', true) AS role`);
      expect(rows).toBeDefined();
      // Si nunca se seteó, el valor es NULL
      expect(rows[0]?.role).toBeNull();
    });
  },
);
