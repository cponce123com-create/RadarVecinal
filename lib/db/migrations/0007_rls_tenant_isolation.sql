-- RLS: Row Level Security para aislamiento multi-tenant a nivel DB
-- Inspirado en FixNet (Supabase RLS)
-- Cada política usa current_setting('app.district_id') seteado por el middleware

-- Reportes
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_reports ON "reports"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Usuarios
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON "users"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Alertas de pánico
ALTER TABLE "panic_alerts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_panic_alerts ON "panic_alerts"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Personas desaparecidas
ALTER TABLE "missing_persons" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_missing_persons ON "missing_persons"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Notificaciones
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notifications ON "notifications"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Anuncios
ALTER TABLE "ad_slots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ad_slots ON "ad_slots"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Departamentos
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_departments ON "departments"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Auditoría
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_log ON "audit_log"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Suscripciones
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subscriptions ON "subscriptions"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Recursos comunitarios
ALTER TABLE "district_resources" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_district_resources ON "district_resources"
  USING ("district_id" = current_setting('app.district_id')::int);
--> statement-breakpoint

-- Nota: super_admin puede ver todos los distritos porque no pasa por el middleware
-- que setea app.district_id, o se le setea NULL y la política falla → no filtra.
-- Para que super_admin vea todo, se necesita una política adicional:
-- CREATE POLICY super_admin_all ON "reports" FOR ALL USING (current_setting('app.role') = 'super_admin');
-- Esto se implementa cuando se tenga el middleware de RLS.
