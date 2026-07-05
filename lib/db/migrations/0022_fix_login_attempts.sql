-- Migration 0022: Agregar columnas faltantes para bloqueo progresivo de login
-- (Item 4 — FASE 4 de seguridad)
-- Las columnas login_attempts y locked_until se agregaron al schema TypeScript
-- pero nunca se añadieron a la BD en el migration 0020.

ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamp;
