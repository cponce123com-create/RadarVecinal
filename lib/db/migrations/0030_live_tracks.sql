-- Migration 0030: Ruta recorrida por cada transmisión en vivo (breadcrumbs).
--
-- Cada punto es una posición por la que pasó el transmisor (p. ej. el camión
-- recolector). Se guardan submuestreados (solo si avanzó ≥ ~12 m) para dibujar
-- la línea verde de la ruta en vivo y conservarla en el historial por fecha,
-- sin inflar la base de datos.

CREATE TABLE IF NOT EXISTS "live_tracks" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider_id" integer NOT NULL REFERENCES "live_providers"("id"),
  "district_id" integer NOT NULL REFERENCES "districts"("id"),
  "latitude" real NOT NULL,
  "longitude" real NOT NULL,
  "recorded_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Traer la ruta de una transmisión en orden cronológico.
CREATE INDEX IF NOT EXISTS "idx_live_tracks_provider"
  ON "live_tracks" ("provider_id", "recorded_at");
--> statement-breakpoint

-- Historial por distrito y fecha.
CREATE INDEX IF NOT EXISTS "idx_live_tracks_district_time"
  ON "live_tracks" ("district_id", "recorded_at");
