-- Agregar campos DNI, teléfono, nombres/apellidos y baneo a users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reported_by_id integer REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS helpful_reports integer NOT NULL DEFAULT 0;

-- Nueva tabla: puntos estáticos (acumulan reportes en una misma ubicación)
CREATE TABLE IF NOT EXISTS static_points (
  id SERIAL PRIMARY KEY,
  district_id integer NOT NULL REFERENCES districts(id),
  latitude real NOT NULL,
  longitude real NOT NULL,
  category report_category NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  address text DEFAULT '',
  sector text NOT NULL,
  report_count integer NOT NULL DEFAULT 0,
  first_reported_at timestamp NOT NULL DEFAULT NOW(),
  last_reported_at timestamp NOT NULL DEFAULT NOW(),
  resolution_reports integer NOT NULL DEFAULT 0,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- Índice para búsqueda por distrito
CREATE INDEX IF NOT EXISTS idx_static_points_district ON static_points(district_id);
