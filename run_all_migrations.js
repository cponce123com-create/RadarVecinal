const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const migrationsDir = "/home/user/almacen/lib/db/migrations";
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith(".sql"))
  .sort();

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);
    console.log("\n" + file + " (" + statements.length + " sentencias):");

    for (let i = 0; i < statements.length; i++) {
      try {
        await pool.query(statements[i]);
        console.log("  OK [" + (i + 1) + "/" + statements.length + "]");
      } catch (err) {
        if (err.message && (
          err.message.includes("already exists") ||
          err.message.includes("duplicate key")
        )) {
          console.log("  -- [" + (i + 1) + "] ya existe");
        } else {
          console.log("  ERR [" + (i + 1) + "]: " + err.message.substring(0, 150));
        }
      }
    }
  }

  // Verify
  const { rows: tables } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  console.log("\n=== TABLAS ===");
  tables.forEach(r => console.log("  " + r.table_name));

  const { rows: cols } = await pool.query("SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'district_id' AND table_schema = 'public' ORDER BY table_name");
  console.log("\n=== district_id EN ===");
  cols.forEach(r => console.log("  " + r.table_name + "." + r.column_name));

  await pool.end();
  console.log("\nListo!");
}

run().catch(e => { console.error(e.message); process.exit(1); });
