-- Migration 0021: Performance indexes (FASE 6 — Optimización)
-- Índices compuestos para las consultas más frecuentes

-- Reports: filtro por distrito + estado + orden por fecha (usado en Home.tsx, MapPage, API)
CREATE INDEX IF NOT EXISTS idx_reports_district_status_created
  ON reports(district_id, status, created_at DESC);

-- Reports: filtro por categoría (usado en estadísticas y filtros del mapa)
CREATE INDEX IF NOT EXISTS idx_reports_category
  ON reports(category);

-- Panic alerts: filtro por distrito + activas (usado en alertas y Home)
CREATE INDEX IF NOT EXISTS idx_panic_alerts_district_active
  ON panic_alerts(district_id, is_active);

-- Missing persons: filtro por activas
CREATE INDEX IF NOT EXISTS idx_missing_persons_active
  ON missing_persons(is_active);

-- Community flags: buscar flags por reporte
CREATE INDEX IF NOT EXISTS idx_community_flags_report_id
  ON community_flags(report_id);

-- User strikes: buscar strikes activos por usuario
CREATE INDEX IF NOT EXISTS idx_user_strikes_user_active
  ON user_strikes(user_id, activo);
