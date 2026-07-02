-- M-05: Crear catálogo de distritos (multi-tenant)
CREATE TABLE IF NOT EXISTS "districts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"province" text NOT NULL,
	"department" text NOT NULL,
	"center_lat" real,
	"center_lng" real,
	"default_zoom" integer DEFAULT 15,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "districts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
-- Insertar el distrito actual (San Ramón, Chanchamayo, Junín) como primer registro
INSERT INTO "districts" ("slug", "name", "province", "department", "center_lat", "center_lng", "default_zoom")
VALUES ('san-ramon', 'San Ramón', 'Chanchamayo', 'Junín', -11.1223, -75.3560, 15)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
-- M-04: Agregar super_admin al enum user_role
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'super_admin';
--> statement-breakpoint
-- M-03/M-05: Agregar district_id a panic_alerts
ALTER TABLE "panic_alerts" ADD COLUMN "district_id" integer;
--> statement-breakpoint
ALTER TABLE "panic_alerts" ADD CONSTRAINT "panic_alerts_district_id_districts_id_fk"
  FOREIGN KEY ("district_id") REFERENCES "districts"("id");
--> statement-breakpoint
-- M-03/M-05: Agregar district_id a missing_persons
ALTER TABLE "missing_persons" ADD COLUMN "district_id" integer;
--> statement-breakpoint
ALTER TABLE "missing_persons" ADD CONSTRAINT "missing_persons_district_id_districts_id_fk"
  FOREIGN KEY ("district_id") REFERENCES "districts"("id");
--> statement-breakpoint
-- M-03/M-05: Agregar district_id a ad_slots
ALTER TABLE "ad_slots" ADD COLUMN "district_id" integer;
--> statement-breakpoint
ALTER TABLE "ad_slots" ADD CONSTRAINT "ad_slots_district_id_districts_id_fk"
  FOREIGN KEY ("district_id") REFERENCES "districts"("id");
--> statement-breakpoint
-- M-03/M-05: Agregar district_id a notifications
ALTER TABLE "notifications" ADD COLUMN "district_id" integer;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_district_id_districts_id_fk"
  FOREIGN KEY ("district_id") REFERENCES "districts"("id");
--> statement-breakpoint
-- M-03/M-05: Agregar district_id a users
ALTER TABLE "users" ADD COLUMN "district_id" integer;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_district_id_districts_id_fk"
  FOREIGN KEY ("district_id") REFERENCES "districts"("id");
--> statement-breakpoint
-- M-03/M-05: Agregar district_id a reports
ALTER TABLE "reports" ADD COLUMN "district_id" integer;
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_district_id_districts_id_fk"
  FOREIGN KEY ("district_id") REFERENCES "districts"("id");
--> statement-breakpoint
-- Backfill: asignar todos los registros existentes al distrito San Ramón (id=1)
UPDATE "panic_alerts" SET "district_id" = (SELECT id FROM "districts" WHERE "slug" = 'san-ramon');
--> statement-breakpoint
UPDATE "missing_persons" SET "district_id" = (SELECT id FROM "districts" WHERE "slug" = 'san-ramon');
--> statement-breakpoint
UPDATE "ad_slots" SET "district_id" = (SELECT id FROM "districts" WHERE "slug" = 'san-ramon');
--> statement-breakpoint
UPDATE "notifications" SET "district_id" = (SELECT id FROM "districts" WHERE "slug" = 'san-ramon');
--> statement-breakpoint
UPDATE "users" SET "district_id" = (SELECT id FROM "districts" WHERE "slug" = 'san-ramon');
--> statement-breakpoint
UPDATE "reports" SET "district_id" = (SELECT id FROM "districts" WHERE "slug" = 'san-ramon');
--> statement-breakpoint
-- Hacer NOT NULL después del backfill
ALTER TABLE "panic_alerts" ALTER COLUMN "district_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "missing_persons" ALTER COLUMN "district_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ad_slots" ALTER COLUMN "district_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "district_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "district_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "district_id" SET NOT NULL;
--> statement-breakpoint
-- M-09: Índices críticos para performance multi-tenant
CREATE INDEX IF NOT EXISTS "idx_reports_district_id_created_at"
  ON "reports" ("district_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reports_district_id_category"
  ON "reports" ("district_id", "category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reports_district_id_status"
  ON "reports" ("district_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_panic_alerts_district_id"
  ON "panic_alerts" ("district_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_missing_persons_district_id"
  ON "missing_persons" ("district_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ad_slots_district_id"
  ON "ad_slots" ("district_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_district_id"
  ON "notifications" ("district_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_district_id"
  ON "users" ("district_id");
--> statement-breakpoint
-- Índice adicional para búsquedas por slug
CREATE INDEX IF NOT EXISTS "idx_districts_slug"
  ON "districts" ("slug");
