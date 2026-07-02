-- RLS: políticas de bypass para super_admin
-- super_admin puede ver TODOS los distritos, a diferencia de los usuarios
-- municipales (admin/moderator/user) que solo ven su propio distrito.
-- Las políticas usan current_setting(name, true) para no fallar si la
-- variable no fue seteada (ej. requests sin auth).

-- Reportes
CREATE POLICY super_admin_all_reports ON "reports"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
--> statement-breakpoint

-- Usuarios
CREATE POLICY super_admin_all_users ON "users"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
--> statement-breakpoint

-- Alertas de pánico
CREATE POLICY super_admin_all_panic_alerts ON "panic_alerts"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
--> statement-breakpoint

-- Personas desaparecidas
CREATE POLICY super_admin_all_missing_persons ON "missing_persons"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
--> statement-breakpoint

-- Notificaciones
CREATE POLICY super_admin_all_notifications ON "notifications"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
--> statement-breakpoint

-- Anuncios
CREATE POLICY super_admin_all_ad_slots ON "ad_slots"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
--> statement-breakpoint

-- Departamentos
CREATE POLICY super_admin_all_departments ON "departments"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
--> statement-breakpoint

-- Auditoría
CREATE POLICY super_admin_all_audit_log ON "audit_log"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
--> statement-breakpoint

-- Suscripciones
CREATE POLICY super_admin_all_subscriptions ON "subscriptions"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
--> statement-breakpoint

-- Recursos comunitarios
CREATE POLICY super_admin_all_district_resources ON "district_resources"
  FOR ALL
  USING (current_setting('app.role', true) = 'super_admin');
