const { Pool } = require("pg");
const fs = require("fs");

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const sql = fs.readFileSync(process.argv[2] || "/home/user/almacen/lib/db/migrations/0003_multi_tenant_districts.sql", "utf-8");
    const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);
    console.log("Ejecutando " + statements.length + " sentencias SQL...");

    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await pool.query(statements[i]);
        console.log("  OK [" + (i + 1) + "/" + statements.length + "]");
        successCount++;
      } catch (err) {
        if (err.message && (
          err.message.includes("already exists") ||
          err.message.includes("duplicate key")
        )) {
          console.log("  -- [" + (i + 1) + "] ya existente");
          successCount++;
        } else {
          console.error("  ERROR [" + (i + 1) + "]: " + err.message.substring(0, 200));
        }
      }
    }

    console.log("\nCompletadas: " + successCount + "/" + statements.length);

    const { rows: tables } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
    console.log("\nTablas: " + tables.map(r => r.table_name).join(", "));

    const { rows: cols } = await pool.query("SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE column_name = 'district_id' AND table_schema = 'public' ORDER BY table_name");
    if (cols.length > 0) {
      console.log("district_id en: " + cols.map(r => r.table_name).join(", "));
    } else { console.log("No hay columnas district_id"); }

    const { rows: districts } = await pool.query("SELECT id, slug, name FROM districts");
    if (districts.length > 0) {
      console.log("Distritos: " + districts.map(r => "#" + r.id + " " + r.name).join(", "));
    } else { console.log("No hay distritos"); }

    await pool.end();
    console.log("\nListo!");
  } catch (err) {
    console.error("Fatal: " + err.message);
    await pool.end();
    process.exit(1);
  }
}

run();
