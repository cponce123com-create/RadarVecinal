-- Migration 0020: Strike system and trust score (FASE 5)

ALTER TABLE users ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until timestamp;

CREATE TABLE IF NOT EXISTS user_strikes (
  id SERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  report_id integer NOT NULL REFERENCES reports(id),
  motivo text NOT NULL,
  admin_id integer NOT NULL REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  activo boolean DEFAULT true,
  expires_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_user_strikes_user_id ON user_strikes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_strikes_activo ON user_strikes(activo);

CREATE TABLE IF NOT EXISTS community_flags (
  id SERIAL PRIMARY KEY,
  report_id integer NOT NULL REFERENCES reports(id),
  user_id integer NOT NULL REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  UNIQUE(report_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_flags_report_id ON community_flags(report_id);
