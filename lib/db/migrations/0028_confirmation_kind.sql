-- Migration 0028: separar las confirmaciones de VALIDEZ y de RESOLUCIÓN.
--
-- Antes /confirm ("el reporte es real") y /confirm-resolution ("ya se
-- resolvió") escribían en la misma tabla con la misma unicidad (report_id,
-- user_id) → un vecino que confirmaba la validez NO podía confirmar la
-- resolución (409) y ambos contadores salían de las mismas filas.
--
-- Añadimos `kind` para distinguirlas y reconstruimos los índices únicos
-- incluyéndolo. Las filas existentes son confirmaciones de validez.

ALTER TABLE "resolution_confirmations"
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'validity';
--> statement-breakpoint

DROP INDEX IF EXISTS "resolution_conf_report_user_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "resolution_conf_report_ip_idx";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "resolution_conf_report_user_kind_idx"
  ON "resolution_confirmations" ("report_id", "user_id", "kind")
  WHERE "user_id" IS NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "resolution_conf_report_ip_kind_idx"
  ON "resolution_confirmations" ("report_id", "user_ip", "kind")
  WHERE "user_id" IS NULL AND "user_ip" IS NOT NULL;
