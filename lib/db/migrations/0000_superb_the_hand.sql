CREATE TYPE "public"."missing_person_status" AS ENUM('active', 'found', 'archived');--> statement-breakpoint
CREATE TYPE "public"."panic_alert_type" AS ENUM('robbery', 'medical', 'fight', 'fire', 'missing_person', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_category" AS ENUM('robbery', 'fight', 'suspicious', 'water_cut', 'garbage', 'informal_commerce', 'noise', 'missing_person', 'fire', 'medical_emergency', 'prostitution', 'drug_point', 'bar_trouble', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('active', 'reviewing', 'resolved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."urgency_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'moderator', 'user');--> statement-breakpoint
CREATE TABLE "ad_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"tagline" text NOT NULL,
	"image_url" text,
	"target_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sector" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missing_persons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"age" integer,
	"clothing" text NOT NULL,
	"photo_url" text,
	"last_seen_latitude" real NOT NULL,
	"last_seen_longitude" real NOT NULL,
	"last_seen_address" text NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"contact_info" text NOT NULL,
	"status" "missing_person_status" DEFAULT 'active' NOT NULL,
	"reported_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panic_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "panic_alert_type" NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"author_name" text NOT NULL,
	"sector" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" "report_category" NOT NULL,
	"urgency" "urgency_level" NOT NULL,
	"status" "report_status" DEFAULT 'active' NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"sector" text NOT NULL,
	"district" text DEFAULT 'San Ramón' NOT NULL,
	"image_url" text,
	"author_name" text NOT NULL,
	"contact_phone" text,
	"confirmed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"dni" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"sector" text DEFAULT '' NOT NULL,
	"district" text DEFAULT 'San Ramón' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"reports_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_dni_unique" UNIQUE("dni")
);
