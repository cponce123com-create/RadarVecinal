-- Migration 0019: Add new report categories (FASE 3)
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot be run inside a transaction
-- in older Postgres versions. We run each as a standalone statement.
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'lost_pet';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'power_outage';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'street_damage';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'stray_dogs';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'flooding';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
