ALTER TABLE "reports" ADD COLUMN "province" text DEFAULT 'Chanchamayo' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "department" text DEFAULT 'Junín' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "province" text DEFAULT 'Chanchamayo' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department" text DEFAULT 'Junín' NOT NULL;