-- Migration 0027: Nota de voz opcional en reportes (≤20s).
-- URL de Cloudinary (resource_type video/audio). Pequeña por diseño.

ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "audio_url" text;
