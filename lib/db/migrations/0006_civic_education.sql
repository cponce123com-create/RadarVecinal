-- Civic Education + Email log + Analytics enhancement

CREATE TABLE IF NOT EXISTS "civic_education_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"content" text NOT NULL,
	"icon" text DEFAULT 'BookOpen' NOT NULL,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"questions" text DEFAULT '[]' NOT NULL,
	"xp_reward" integer DEFAULT 50 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "civic_education_topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_education_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"topic_id" integer NOT NULL REFERENCES "civic_education_topics"("id"),
	"completed" boolean DEFAULT false NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
