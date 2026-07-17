-- Migration 0033: Suscripción de proximidad (avisos push con la app cerrada).
--
-- Guarda en el servidor la casa del vecino + su token de notificaciones, para
-- que el aviso "el recolector está cerca de tu casa" llegue aunque la app esté
-- cerrada. El servidor detecta la cercanía cuando un proveedor se mueve.

CREATE TABLE IF NOT EXISTS "proximity_subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "district_id" integer NOT NULL REFERENCES "districts"("id"),
  "push_token" text NOT NULL UNIQUE,
  "home_lat" real NOT NULL,
  "home_lng" real NOT NULL,
  "radius_m" integer NOT NULL DEFAULT 300,
  "types" jsonb NOT NULL DEFAULT '["recolector"]'::jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "cooldowns" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Consulta caliente: suscripciones activas de un distrito.
CREATE INDEX IF NOT EXISTS "idx_proximity_subs_district"
  ON "proximity_subscriptions" ("district_id", "enabled");
