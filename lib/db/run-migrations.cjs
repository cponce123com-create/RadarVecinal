// run-migrations.js — Aplica migraciones SQL pendientes contra PostgreSQL
const { readdirSync, readFileSync } = require("fs");
const { resolve } = require("path");
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Create drizzle migrations table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _drizzle_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Get already applied
  const { rows: existing } = await pool.query("SELECT name FROM _drizzle_migrations ORDER BY id");
  const applied = new Set(existing.map((r) => r.name));

  const dir = resolve(__dirname, "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log("  Already applied:", file);
      continue;
    }
    const sql = readFileSync(resolve(dir, file), "utf-8");
    const statements = sql.split("--> statement-breakpoint");
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        try {
          await pool.query(trimmed);
        } catch (err) {
          // Ignore "already exists" for idempotent runs
          if (!err.message.includes("already exists") && !err.message.includes("duplicate")) {
            throw err;
          }
        }
      }
    }
    await pool.query("INSERT INTO _drizzle_migrations (name) VALUES ($1)", [file]);
    console.log("  Applied:", file);
    count++;
  }

  await pool.end();
  console.log(`Done. ${count} migration(s) applied.`);
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
