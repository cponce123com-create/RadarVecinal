-- 0035_user_consents.sql
--
-- La tabla `user_consents` y su enum existían SOLO en el esquema Drizzle: ninguna
-- migración las creaba. El despliegue aplica `run_all_migrations.js` (no
-- `drizzle-kit push`), así que una base nueva —primer despliegue, restauración de
-- un backup, staging— quedaba sin la tabla y `POST /api/auth/register` fallaba al
-- insertar el consentimiento informado.
--
-- Evidencia que lo destapó: base vacía + cadena completa de migraciones = 28
-- tablas y 50 columnas con zona horaria; el esquema Drizzle = 29 y 51. La
-- diferencia era exactamente esta tabla (y su `accepted_at`).
--
-- Idempotente: se ejecuta en cada despliegue sin romper nada.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_type') THEN
    CREATE TYPE public.consent_type AS ENUM ('privacy_policy', 'terms_of_use');
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_consents" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "type" "consent_type" NOT NULL,
  "version" text NOT NULL,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text
);
--> statement-breakpoint

DO $$
BEGIN
  -- Se comprueba que exista CUALQUIER FK sobre user_id, no una con un nombre
  -- concreto: si la tabla ya existía en producción (creada por push o a mano),
  -- el constraint puede llamarse distinto y añadir otro sería redundante.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'user_id'
    WHERE n.nspname = 'public'
      AND t.relname = 'user_consents'
      AND c.contype = 'f'
      AND a.attnum = ANY (c.conkey)
  ) THEN
    ALTER TABLE "user_consents"
      ADD CONSTRAINT "user_consents_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id");
  END IF;
END $$;
