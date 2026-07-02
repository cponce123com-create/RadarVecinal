-- Soft Delete: añadir columnas deleted_at y deleted_by a reports
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "deleted_by" text;
--> statement-breakpoint

-- Soft Delete: añadir columnas deleted_at y deleted_by a missing_persons
ALTER TABLE "missing_persons" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "missing_persons" ADD COLUMN IF NOT EXISTS "deleted_by" text;
--> statement-breakpoint

-- Auditoría: crear tabla audit_logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"action" varchar(50) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" uuid NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
