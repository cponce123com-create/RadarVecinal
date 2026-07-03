-- Migration: 0012_fix_contact_channels
-- Bugfix 1: Agregar contact_email real a reports
-- Bugfix 4: Agregar author_user_id a reports
-- Bugfix 6: Agregar admin_name y report_title a notifications

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS author_user_id INTEGER REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_reports_author_user_id ON public.reports(author_user_id);
