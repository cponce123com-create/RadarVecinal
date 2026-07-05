DO $$ BEGIN
  CREATE TYPE panic_alert_status AS ENUM ('active', 'attending', 'resolved', 'false_alarm', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE panic_alerts ADD COLUMN IF NOT EXISTS status panic_alert_status DEFAULT 'active';
ALTER TABLE panic_alerts ADD COLUMN IF NOT EXISTS resolved_at timestamp;
ALTER TABLE panic_alerts ADD COLUMN IF NOT EXISTS resolved_by_id integer REFERENCES users(id);
ALTER TABLE panic_alerts ADD COLUMN IF NOT EXISTS resolution_note text;
ALTER TABLE panic_alerts ADD COLUMN IF NOT EXISTS expires_at timestamp;
ALTER TABLE panic_alerts ADD COLUMN IF NOT EXISTS linked_report_id integer REFERENCES reports(id);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS panic_alert_id integer REFERENCES panic_alerts(id);

CREATE INDEX IF NOT EXISTS idx_panic_alerts_district_status_created ON panic_alerts(district_id, status, created_at DESC);
