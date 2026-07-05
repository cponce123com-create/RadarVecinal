-- Migration 0021: Performance indexes (FASE 6 — Optimización)
-- Cada CREATE INDEX se envuelve en un bloque DO para evitar errores
-- si la tabla o columna no existe aún en ciertos entornos.

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_reports_district_status_created
    ON reports(district_id, status, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_reports_category
    ON reports(category);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_panic_alerts_district_active
    ON panic_alerts(district_id, is_active);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_missing_persons_active
    ON missing_persons(is_active);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_community_flags_report_id
    ON community_flags(report_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_user_strikes_user_active
    ON user_strikes(user_id, activo);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
