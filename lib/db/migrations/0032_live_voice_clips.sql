-- Migration 0032: Clips de voz para los avisos de servicios en vivo.
--
-- El superadmin/municipalidad graba o sube un audio por tipo de servicio y
-- distrito ("Vecino, la tamalera está cerca") para que el aviso suene con la voz
-- y el acento locales en vez del TTS robótico. Si no hay clip, se usa el TTS.

CREATE TABLE IF NOT EXISTS "live_voice_clips" (
  "id" serial PRIMARY KEY NOT NULL,
  "district_id" integer NOT NULL REFERENCES "districts"("id"),
  "type" "live_provider_type" NOT NULL,
  "audio_url" text,
  "phrase" text NOT NULL DEFAULT '',
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_by_id" integer REFERENCES "users"("id"),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Un solo clip por (distrito, tipo): el upsert se apoya en esta unicidad.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_live_voice_clips_district_type"
  ON "live_voice_clips" ("district_id", "type");
