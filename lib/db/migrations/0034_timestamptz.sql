-- 0034: timestamps con zona horaria
--
-- Motivo: el esquema usaba `timestamp without time zone` en las 51 columnas de
-- fecha. Con esa representación el mismo instante se escribe de tres formas
-- distintas (`now()` en hora de la sesión, Drizzle en UTC, `Date` de pg en hora
-- del proceso) y las comparaciones fallan si la sesión no está en UTC. Bug real
-- documentado en docs/audit/ITERATION-001.md: con la sesión en America/Bogota,
-- GET /api/live devolvía 0 emisores y cada ping del dispositivo duplicaba la
-- transmisión.
--
-- Idempotente: recorre information_schema y solo convierte lo que todavía es
-- `timestamp without time zone`. Ejecutarla dos veces no vuelve a desplazar los
-- valores, y eso importa porque render-build.sh aplica todas las migraciones en
-- cada despliegue.
--
-- Los valores existentes se interpretan como UTC: así se escribieron, porque la
-- conexión de la aplicación fija `-c timezone=UTC` (lib/db/src/index.ts) y el
-- servidor de Render corre en UTC.
DO $$
DECLARE
  r record;
  converted integer := 0;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'timestamp without time zone'
      AND is_generated = 'NEVER'
    ORDER BY table_name, column_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE %L',
      r.table_schema,
      r.table_name,
      r.column_name,
      r.column_name,
      'UTC'
    );
    converted := converted + 1;
  END LOOP;

  RAISE NOTICE '[0034] columnas convertidas a timestamptz: %', converted;
END
$$;
