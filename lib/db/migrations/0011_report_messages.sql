-- Migration: 0011_report_messages
-- Tabla de mensajes entre administración municipal y vecinos

CREATE TYPE public.message_sender AS ENUM ('admin', 'vecino');
CREATE TYPE public.message_channel AS ENUM ('whatsapp', 'app', 'email');

CREATE TABLE IF NOT EXISTS public.report_messages (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  sender public.message_sender NOT NULL,
  channel public.message_channel NOT NULL,
  content TEXT NOT NULL,
  admin_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_messages_report_id ON public.report_messages(report_id);
CREATE INDEX IF NOT EXISTS idx_report_messages_created_at ON public.report_messages(created_at DESC);
