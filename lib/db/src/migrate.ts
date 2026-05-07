/**
 * Drizzle migration runner.
 *
 * Usage:
 *   pnpm --filter @workspace/db run migrate
 *
 * Reads DATABASE_URL from the environment and applies pending migrations.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

async function runMigrations() {
  const migrationsFolder = new URL("../migrations", import.meta.url).pathname;

  console.log(`[migrate] Applying migrations from ${migrationsFolder} ...`);

  try {
    await migrate(db, { migrationsFolder });
    console.log("[migrate] ✅ Migrations applied successfully.");
  } catch (err) {
    console.error("[migrate] ❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
