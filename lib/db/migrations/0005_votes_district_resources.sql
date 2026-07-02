-- Votos de usuarios en reportes + recursos comunitarios por distrito

CREATE TABLE IF NOT EXISTS "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL REFERENCES "reports"("id"),
	"user_id" integer,
	"user_ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "district_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"district_id" integer NOT NULL REFERENCES "districts"("id"),
	"type" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"url" text,
	"description" text DEFAULT '',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
