--> statement-breakpoint
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migración 0017: Alias editable del vecino + Verificación comunitaria de solución
-- ═══════════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
-- 1. Alias: nombre en clave editable por el vecino (reemplaza al "Vecino XXXXXX"
--    autogenerado cuando el usuario define uno propio).
ALTER TABLE "users" ADD COLUMN "alias" text;

--> statement-breakpoint
-- 2. Contador de vecinos que confirmaron que un reporte resuelto realmente se
--    solucionó. Al llegar a 10, el reporte pasa a "archived" y desaparece del
--    mapa y del radar.
ALTER TABLE "reports" ADD COLUMN "resolution_confirmed_count" integer DEFAULT 0 NOT NULL;

--> statement-breakpoint
-- 3. Tabla de confirmaciones de solución (1 por vecino o por IP anónima).
CREATE TABLE IF NOT EXISTS "resolution_confirmations" (
  "id" serial PRIMARY KEY NOT NULL,
  "report_id" integer NOT NULL REFERENCES "reports"("id"),
  "user_id" integer REFERENCES "users"("id"),
  "user_ip" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- 4. Índices únicos: un usuario autenticado solo confirma una vez por reporte;
--    una IP anónima solo confirma una vez por reporte.
CREATE UNIQUE INDEX IF NOT EXISTS "resolution_conf_report_user_idx"
  ON "resolution_confirmations" ("report_id", "user_id")
  WHERE "user_id" IS NOT NULL;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resolution_conf_report_ip_idx"
  ON "resolution_confirmations" ("report_id", "user_ip")
  WHERE "user_id" IS NULL AND "user_ip" IS NOT NULL;
