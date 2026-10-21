-- Reversión de 0034_timestamptz.sql
--
-- NO se aplica automáticamente: `run_all_migrations.js` solo lee los `*.sql`
-- que están directamente en `lib/db/migrations/`, no las subcarpetas.
--
-- Ejecutar a mano si hay que volver al esquema anterior:
--   psql "$DATABASE_URL" -f lib/db/migrations/revert/0034_timestamptz_down.sql
--
-- Convierte de vuelta a `timestamp without time zone` conservando el reloj UTC
-- (es decir, sin cambiar los valores absolutos). Al revertir se pierde la zona:
-- vuelve a ser imprescindible que la sesión de Postgres esté en UTC.
DO $$
DECLARE
  r record;
  converted integer := 0;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'timestamp with time zone'
      AND is_generated = 'NEVER'
    ORDER BY table_name, column_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamp USING (%I AT TIME ZONE %L)',
      r.table_schema,
      r.table_name,
      r.column_name,
      r.column_name,
      'UTC'
    );
    converted := converted + 1;
  END LOOP;

  RAISE NOTICE '[0034-down] columnas convertidas a timestamp sin zona: %', converted;
END
$$;
