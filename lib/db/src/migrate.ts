/**
 * Drizzle migration runner.
 *
 * Usage:
 *   pnpm --filter @workspace/db run migrate
 *
 * Reads DATABASE_URL from the environment and applies pending migrations.
 *
 * IMPORTANTE: el despliegue de producción NO usa este script. Usa
 * `run_all_migrations.js` (raíz del repo), que aplica todos los `.sql` en orden
 * y es idempotente. Este runner depende del journal de Drizzle
 * (`migrations/meta/_journal.json`), y el journal de este repo solo conoce las
 * tres primeras migraciones: las otras 34 se añadieron a mano.
 *
 * Drizzle ignora en silencio los `.sql` que no están en el journal, así que
 * antes este comando podía terminar con "Migrations applied successfully"
 * habiendo aplicado 3 de 37. El preflight de abajo lo convierte en un error
 * explícito: si el journal vuelve a estar completo, el runner funciona solo.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool, assertDatabaseConfigured } from "./index";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

function assertJournalComplete(): void {
  const journalPath = `${migrationsFolder}/meta/_journal.json`;
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };

  const sqlFiles = readdirSync(migrationsFolder)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => file.replace(/\.sql$/, ""))
    .sort();

  const known = new Set(journal.entries.map((entry) => entry.tag));
  const missing = sqlFiles.filter((file) => !known.has(file));

  if (missing.length > 0) {
    console.error(
      `[migrate] El journal de Drizzle conoce ${known.size} de ${sqlFiles.length} migraciones.`,
    );
    console.error(
      "[migrate] Drizzle ignoraría las que faltan sin avisar, así que se aborta.",
    );
    console.error(
      "[migrate] Usa `node run_all_migrations.js` (idempotente, es lo que corre en producción).",
    );
    console.error("[migrate] Sin journal: " + missing.join(", "));
    process.exit(1);
  }
}

async function runMigrations() {
  console.log(`[migrate] Applying migrations from ${migrationsFolder} ...`);

  try {
    assertJournalComplete();
    assertDatabaseConfigured();
    await migrate(db, { migrationsFolder });
    console.log("[migrate] Migrations applied successfully.");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
