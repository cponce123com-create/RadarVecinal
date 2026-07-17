-- Migration 0031: Dispositivos oficiales de rastreo en vivo.
--
-- La municipalidad registra un camión/servicio desde el panel admin y obtiene
-- una `device_key` secreta. El celular montado (o un GPS vehicular) reporta su
-- ubicación con esa clave, sin login ni operador, y aparece como transmisión
-- "Oficial" con su ruta e historial.

CREATE TABLE IF NOT EXISTS "live_devices" (
  "id" serial PRIMARY KEY NOT NULL,
  "district_id" integer NOT NULL REFERENCES "districts"("id"),
  "type" "live_provider_type" NOT NULL DEFAULT 'recolector',
  "label" text NOT NULL DEFAULT '',
  "device_key" text NOT NULL UNIQUE,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_by_id" integer REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Enlace de la transmisión a su dispositivo oficial + distintivo verificado.
ALTER TABLE "live_providers"
  ADD COLUMN IF NOT EXISTS "device_id" integer REFERENCES "live_devices"("id");
--> statement-breakpoint
ALTER TABLE "live_providers"
  ADD COLUMN IF NOT EXISTS "verified" boolean NOT NULL DEFAULT false;
