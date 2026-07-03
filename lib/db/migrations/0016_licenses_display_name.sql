--> statement-breakpoint
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migración 0016: Licencias, VecinoId, DisplayName, Nuevos Roles
-- ═══════════════════════════════════════════════════════════════════════════════

--> statement-breakpoint
-- 1. Agregar columna vecino_id a users (identificador publico de 6 digitos)
ALTER TABLE "users" ADD COLUMN "vecino_id" integer UNIQUE;

--> statement-breakpoint
-- 2. Agregar columna display_name a users (nombre real para visores/municipales)
ALTER TABLE "users" ADD COLUMN "display_name" text;

--> statement-breakpoint
-- 3. Crear tabla de licencias para municipalidades
CREATE TABLE IF NOT EXISTS "licenses" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "siglas" text NOT NULL,
  "district_name" text NOT NULL,
  "province" text NOT NULL,
  "department" text NOT NULL,
  "district_id" integer REFERENCES "districts"("id"),
  "municipal_user_id" integer REFERENCES "users"("id"),
  "created_by" integer REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "activated_at" timestamp,
  "expires_at" timestamp,
  "is_active" boolean DEFAULT false NOT NULL,
  "max_viewers" integer DEFAULT 10 NOT NULL
);

--> statement-breakpoint
-- 4. Actualizar el tipo enum user_role para incluir 'municipal' y 'viewer'
-- PostgreSQL no permite alterar enums directamente, se necesita recrear
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'municipal';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'viewer';
