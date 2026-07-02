-- Cobranding: logo, color y nombre de marca por distrito
-- Inspirado en FixMyStreet (cobrand system)

ALTER TABLE "districts" ADD COLUMN "brand_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "districts" ADD COLUMN "logo_url" text;
--> statement-breakpoint
ALTER TABLE "districts" ADD COLUMN "primary_color" text DEFAULT '#3b82f6' NOT NULL;
