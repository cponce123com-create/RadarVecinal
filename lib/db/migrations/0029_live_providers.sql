-- Migration 0029: Servicios en vivo (rastreo GPS en tiempo real).
--
-- Un transmisor comparte su ubicación en vivo y los vecinos lo ven moverse por
-- el mapa: el camión recolector, el panadero, el lechero, el tamalero, el
-- gasero, el aguatero, o un vendedor de comida dominical (pollada, patasca,
-- tamales). La autorización de ping/stop usa una clave secreta (broadcast_key)
-- porque muchos transmisores son ambulantes sin cuenta.

DO $$ BEGIN
  CREATE TYPE "live_provider_type" AS ENUM (
    'recolector', 'panadero', 'lechero', 'tamalero',
    'gasero', 'agua', 'vendedor', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_providers" (
  "id" serial PRIMARY KEY NOT NULL,
  "district_id" integer NOT NULL REFERENCES "districts"("id"),
  "user_id" integer REFERENCES "users"("id"),
  "type" "live_provider_type" NOT NULL,
  "label" text NOT NULL DEFAULT '',
  "display_name" text NOT NULL DEFAULT '',
  "latitude" real NOT NULL,
  "longitude" real NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "broadcast_key" text NOT NULL,
  "started_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Consulta caliente: activos de un distrito ordenados por frescura.
CREATE INDEX IF NOT EXISTS "idx_live_providers_district_active"
  ON "live_providers" ("district_id", "is_active", "updated_at");
