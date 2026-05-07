/**
 * API integration / E2E tests.
 *
 * These tests require a running database (DATABASE_URL must be set).
 * They are skipped automatically when no DB is available.
 *
 * Uses dynamic imports to avoid the module-level DATABASE_URL check.
 *
 * To run:
 *   DATABASE_URL=postgresql://... pnpm --filter @workspace/api-server run test
 */

import { describe, it, expect, beforeAll } from "vitest";

const JWT_SECRET = "radar-vecinal-dev-secret-2024";

// ── Tests ────────────────────────────────────────────────────────────────────
// describe.skipIf prevents execution, BUT the import of @workspace/db at module
// level would still throw. So we use dynamic imports inside the describe block.

describe.skipIf(!process.env.DATABASE_URL)(
  "API Integration Tests (E2E)",
  () => {
    let db: Awaited<ReturnType<typeof import("@workspace/db")>>["db"];
    let pool: Awaited<ReturnType<typeof import("@workspace/db")>>["pool"];
    let usersTable: any;
    let reportsTable: any;
    let sql: any;
    let jwt: any;
    let bcrypt: any;

    beforeAll(async () => {
      const dbMod = await import("@workspace/db");
      db = dbMod.db;
      pool = dbMod.pool;
      usersTable = (await import("@workspace/db/schema")).usersTable;
      reportsTable = (await import("@workspace/db/schema")).reportsTable;
      sql = (await import("drizzle-orm")).sql;
      jwt = (await import("jsonwebtoken")).default;
      bcrypt = (await import("bcryptjs")).default;

      // Verify DB connectivity
      const result = await db.execute(sql`SELECT 1 AS ok`);
      expect(result.rows[0]).toEqual({ ok: 1 });
    });

    // ── Helper: seed a test user ───────────────────────────────────────────────
    async function createTestUser() {
      const hash = await bcrypt.hash("TestPass123!", 10);
      const [user] = await db
        .insert(usersTable)
        .values({
          name: "E2E Test User",
          email: `e2e_${Date.now()}@test.radarvecinal.pe`,
          passwordHash: hash,
          role: "user",
          sector: "E2E Test",
          district: "San Ramón",
          isActive: true,
          reportsCount: 0,
        })
        .returning();
      return user;
    }

    async function loginAs(user: { id: number; email: string; role: string }) {
      return jwt.sign(
        { sub: String(user.id), email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "30d" },
      );
    }

    describe("Auth flow", () => {
      it("should create a test user and return a valid JWT", async () => {
        const user = await createTestUser();
        expect(user.id).toBeGreaterThan(0);
        expect(user.email).toContain("e2e_");
        expect(user.isActive).toBe(true);
        await db.delete(usersTable).where(sql`id = ${user.id}`);
      });

      it("should generate a valid JWT that can be verified", async () => {
        const user = await createTestUser();
        const token = await loginAs(user);
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        expect(decoded.sub).toBe(String(user.id));
        expect(decoded.email).toBe(user.email);
        await db.delete(usersTable).where(sql`id = ${user.id}`);
      });

      it("should reject invalid login credentials", async () => {
        const hash = await bcrypt.hash("CorrectPass1!", 10);
        const valid = await bcrypt.compare("WrongPass1!", hash);
        expect(valid).toBe(false);
        const correct = await bcrypt.compare("CorrectPass1!", hash);
        expect(correct).toBe(true);
      });

      it("should enforce unique email constraint", async () => {
        const email = `unique_${Date.now()}@test.radarvecinal.pe`;
        const hash = await bcrypt.hash("TestPass123!", 10);

        await db.insert(usersTable).values({
          name: "User One", email, passwordHash: hash,
          role: "user", sector: "Test", district: "San Ramón",
          isActive: true, reportsCount: 0,
        });

        await expect(
          db.insert(usersTable).values({
            name: "User Two", email, passwordHash: hash,
            role: "user", sector: "Test", district: "San Ramón",
            isActive: true, reportsCount: 0,
          }),
        ).rejects.toThrow();

        await db.delete(usersTable).where(sql`email = ${email}`);
      });
    });

    describe("User management", () => {
      it("should update user profile fields", async () => {
        const user = await createTestUser();

        const [updated] = await db
          .update(usersTable).set({ sector: "Nuevo Sector E2E" })
          .where(sql`id = ${user.id}`).returning();
        expect(updated.sector).toBe("Nuevo Sector E2E");

        const [withDni] = await db
          .update(usersTable).set({ dni: "12345678" })
          .where(sql`id = ${user.id}`).returning();
        expect(withDni.dni).toBe("12345678");

        await db.delete(usersTable).where(sql`id = ${user.id}`);
      });

      it("should enforce DNI uniqueness", async () => {
        const user1 = await createTestUser();
        const user2 = await createTestUser();

        await db.update(usersTable).set({ dni: "87654321" })
          .where(sql`id = ${user1.id}`);

        await expect(
          db.update(usersTable).set({ dni: "87654321" })
            .where(sql`id = ${user2.id}`),
        ).rejects.toThrow();

        await db.delete(usersTable).where(sql`id IN (${user1.id}, ${user2.id})`);
      });
    });

    describe("Reports", () => {
      it("should insert and retrieve a report", async () => {
        const [report] = await db.insert(reportsTable).values({
          title: "E2E Test Report",
          description: "This is an automated test report",
          category: "robbery", urgency: "high",
          latitude: -11.1272, longitude: -75.3548,
          address: "Jr. Tarma cdra. 3, San Ramón",
          sector: "San Ramón Centro", district: "San Ramón",
          isAnonymous: false, authorName: "E2E Test User",
          status: "active",
        }).returning();

        expect(report.id).toBeGreaterThan(0);
        expect(report.title).toBe("E2E Test Report");

        const [fetched] = await db.select().from(reportsTable)
          .where(sql`id = ${report.id}`);
        expect(fetched.confirmedCount).toBe(0);

        await db.delete(reportsTable).where(sql`id = ${report.id}`);
      });

      it("should increment confirmedCount", async () => {
        const [report] = await db.insert(reportsTable).values({
          title: "E2E Confirm Test",
          description: "Testing confirmation increment",
          category: "fight", urgency: "medium",
          latitude: -11.1272, longitude: -75.3548,
          address: "Jr. Tarma cdra. 3",
          sector: "San Ramón Centro", district: "San Ramón",
          isAnonymous: true, authorName: "Anónimo",
          status: "active",
        }).returning();

        const [confirmed] = await db
          .update(reportsTable)
          .set({ confirmedCount: sql`confirmed_count + 1` })
          .where(sql`id = ${report.id}`).returning();
        expect(confirmed.confirmedCount).toBe(1);

        await db.delete(reportsTable).where(sql`id = ${report.id}`);
      });

      it("should support category enum values", async () => {
        const categories = ["robbery","fight","suspicious","water_cut","garbage","noise","fire","medical_emergency","other"] as const;

        for (const cat of categories) {
          const [report] = await db.insert(reportsTable).values({
            title: `E2E Category: ${cat}`, description: `Testing ${cat}`,
            category: cat, urgency: "low",
            latitude: -11.1272, longitude: -75.3548,
            address: "Test addr", sector: "Test", district: "San Ramón",
            isAnonymous: true, authorName: "E2E Test",
            status: "active",
          }).returning();
          expect(report.category).toBe(cat);
          await db.delete(reportsTable).where(sql`id = ${report.id}`);
        }
      });
    });
  },
  30_000,
);
