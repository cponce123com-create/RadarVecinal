-- Migration 0018: Add boundary (GeoJSON) column to districts table for
-- exact point-in-polygon district detection (FASE 2).

ALTER TABLE districts ADD COLUMN IF NOT EXISTS boundary jsonb;

COMMENT ON COLUMN districts.boundary IS 'GeoJSON Polygon/MultiPolygon geometry of the district boundary. Used for point-in-polygon detection via /api/districts/locate.';
