-- Migration 0026: Canal de Telegram por distrito (1 bot, N canales).
--
-- Cada distrito puede tener su propio canal. El token del bot es global
-- (variable de entorno); aquí solo guardamos el destino por distrito y un
-- código corto para la auto-vinculación con el comando /vincular <código>.

ALTER TABLE "districts" ADD COLUMN IF NOT EXISTS "telegram_chat_id" text;
--> statement-breakpoint
ALTER TABLE "districts" ADD COLUMN IF NOT EXISTS "telegram_link_code" text;
--> statement-breakpoint

-- Código de vinculación único por distrito (8 hex). Se genera para los que aún
-- no lo tengan; es idempotente en despliegues sucesivos.
UPDATE "districts"
SET "telegram_link_code" = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE "telegram_link_code" IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_districts_telegram_link_code"
  ON "districts" ("telegram_link_code");
