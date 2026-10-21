const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname, "lib", "db", "migrations");
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function run() {
  // SSL condicional: los Postgres locales/CI no soportan SSL; los gestionados
  // (Neon, RDS…) sí. Se desactiva para localhost/127.0.0.1 o sslmode=disable.
  const url = process.env.DATABASE_URL || "";
  const disableSsl =
    /localhost|127\.0\.0\.1/.test(url) || /sslmode=disable/.test(url);
  const pool = new Pool({
    connectionString: url,
    ssl: disableSsl ? false : { rejectUnauthorized: false },
  });

  const failures = [];
  // Errores benignos al reaplicar migraciones idempotentes. Se comparan por
  // SQLSTATE, no por el texto: el mensaje llega traducido según el locale del
  // servidor ("already exists" en inglés, "ya existe" en español) y la versión
  // anterior solo entendía inglés. En un Postgres en español marcaba como error
  // cada sentencia ya aplicada.
  const BENIGN_CODES = new Set([
    "42P07", // duplicate_table
    "42P06", // duplicate_schema
    "42701", // duplicate_column
    "42710", // duplicate_object: tipo, constraint, índice, política
    "23505", // unique_violation
  ]);

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    console.log("\n" + file + " (" + statements.length + " sentencias):");

    for (let i = 0; i < statements.length; i++) {
      try {
        await pool.query(statements[i]);
        console.log("  OK [" + (i + 1) + "/" + statements.length + "]");
      } catch (err) {
        const message = err.message || String(err);
        if (BENIGN_CODES.has(err.code)) {
          console.log("  -- [" + (i + 1) + "] ya existe");
        } else {
          console.log("  ERR [" + (i + 1) + "]: " + message.substring(0, 150));
          failures.push(
            file +
              " [" +
              (i + 1) +
              "/" +
              statements.length +
              "] (" +
              (err.code || "sin código") +
              "): " +
              message,
          );
        }
      }
    }
  }

  // Verify
  const { rows: tables } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
  );
  console.log("\n=== TABLAS ===");
  tables.forEach((r) => console.log("  " + r.table_name));

  const { rows: cols } = await pool.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'district_id' AND table_schema = 'public' ORDER BY table_name",
  );
  console.log("\n=== district_id EN ===");
  cols.forEach((r) => console.log("  " + r.table_name + "." + r.column_name));

  if (failures.length > 0) {
    console.error("\n=== " + failures.length + " SENTENCIA(S) FALLIDA(S) ===");
    failures.forEach((f) => console.error("  - " + f));
    console.error(
      "\nLa base de datos quedó en un estado intermedio. Se aborta el despliegue\n" +
        "para no servir tráfico con un esquema a medias. Corrige la migración y\n" +
        "vuelve a desplegar: todas son idempotentes y se reaplican enteras.",
    );
    await pool.end();
    process.exit(1);
  }

  await pool.end();
  console.log(
    "\nListo! (" + migrationFiles.length + " migraciones, 0 errores)",
  );
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
