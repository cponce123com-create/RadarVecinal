-- 0036_not_null_alignment.sql
--
-- Cinco columnas que el esquema Drizzle declara `NOT NULL` fueron creadas por
-- migraciones anteriores como nulables. En una base construida solo con
-- migraciones, `drizzle-kit push` seguía detectando diferencias y las convertía
-- sobre la marcha; en producción (que usa `run_all_migrations.js`, no push) el
-- hueco persistía.
--
-- Por qué importa: el tipo generado dice `number`/`Date` no nulos, pero la
-- columna aceptaba NULL. Cualquier fila insertada por SQL crudo, por una
-- migración de datos o por una versión anterior del código podía dejar NULL y
-- la aplicación lo leería como si fuera un valor.
--
-- Orden seguro: primero se rellena lo que falte con el valor por defecto que ya
-- declara la columna, después se fija la restricción. Idempotente: el UPDATE no
-- toca nada si no hay NULL y `SET NOT NULL` sobre una columna ya NOT NULL es un
-- no-op.

UPDATE "community_flags" SET "created_at" = now() WHERE "created_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "community_flags" ALTER COLUMN "created_at" SET NOT NULL;
--> statement-breakpoint

UPDATE "user_strikes" SET "activo" = true WHERE "activo" IS NULL;
--> statement-breakpoint
ALTER TABLE "user_strikes" ALTER COLUMN "activo" SET NOT NULL;
--> statement-breakpoint

UPDATE "user_strikes" SET "created_at" = now() WHERE "created_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "user_strikes" ALTER COLUMN "created_at" SET NOT NULL;
--> statement-breakpoint

UPDATE "users" SET "login_attempts" = 0 WHERE "login_attempts" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "login_attempts" SET NOT NULL;
--> statement-breakpoint

UPDATE "users" SET "trust_score" = 50 WHERE "trust_score" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "trust_score" SET NOT NULL;
