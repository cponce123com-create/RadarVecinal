/**
 * db-timezone.test.ts — Invariante de zona horaria de la base de datos.
 *
 * El esquema usa `timestamp without time zone` en todas las tablas, y hay dos
 * formas de escribir un instante en esa columna:
 *
 *   · `defaultNow()` / `now()`  → hora local de la SESIÓN de Postgres.
 *   · Drizzle (`timestamp()`)   → `toISOString()`, es decir UTC.
 *
 * Si la sesión no está en UTC, las dos vías escriben instantes distintos y
 * cualquier comparación "columna > Date de la app" compara horas que no
 * corresponden al mismo momento. El síntoma real fue que `GET /api/live`
 * devolvía 0 emisores (aunque existieran filas válidas) y que cada ping de
 * un dispositivo oficial creaba una transmisión duplicada.
 *
 * Este test fija la invariante: la sesión DEBE estar en UTC.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
// Fija la zona horaria del proceso en UTC (mismo módulo que usa la app).
import "../lib/timezone";

describe.skipIf(!process.env.DATABASE_URL)("Zona horaria de la sesión", () => {
  let db: any;

  beforeAll(async () => {
    db = (await import("@workspace/db")).db;
  });

  afterAll(async () => {
    if (!db) return;
    await db.execute(sql`DROP TABLE IF EXISTS _tz_probe`);
  });

  it("la sesión de Postgres está en UTC", async () => {
    const rows = await db.execute(
      sql`SELECT current_setting('TimeZone') AS tz, now() AT TIME ZONE 'UTC' AS utc_now`,
    );
    expect(rows.rows[0].tz).toBe("UTC");
  });

  it("defaultNow() y un Date de la app son comparables", async () => {
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS _tz_probe (id serial primary key, created_at timestamp not null default now())`,
    );
    await db.execute(sql`DELETE FROM _tz_probe`);

    // Fila escrita por Postgres (defaultNow).
    await db.execute(sql`INSERT INTO _tz_probe DEFAULT VALUES`);
    // Fila escrita por la app con un Date (Drizzle → ISO UTC).
    await db.execute(
      sql`INSERT INTO _tz_probe (created_at) VALUES (${new Date()})`,
    );

    // La columna debe estar dentro de la ventana "últimos 5 minutos"
    // calculada en JS: si las dos vías usaran zonas distintas, la fila de
    // defaultNow() caería fuera de la ventana.
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const rows = await db.execute(
      sql`SELECT count(*)::int AS n FROM _tz_probe WHERE created_at > ${cutoff}`,
    );
    expect(Number(rows.rows[0].n)).toBe(2);

    // Y la fila de defaultNow() no puede estar "en el futuro" respecto a la app.
    const rowsFuture = await db.execute(
      sql`SELECT count(*)::int AS n FROM _tz_probe WHERE created_at > ${new Date(Date.now() + 60 * 1000)}`,
    );
    expect(Number(rowsFuture.rows[0].n)).toBe(0);
  });
});
