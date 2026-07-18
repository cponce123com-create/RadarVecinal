import {
  pgTable,
  text,
  serial,
  boolean,
  real,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportCategoryEnum = pgEnum("report_category", [
  "robbery",
  "fight",
  "suspicious",
  "water_cut",
  "garbage",
  "informal_commerce",
  "noise",
  "missing_person",
  "fire",
  "medical_emergency",
  "prostitution",
  "drug_point",
  "bar_trouble",
  "other",
  "lost_pet",
  "power_outage",
  "street_damage",
  "stray_dogs",
  "flooding",
]);

export const urgencyEnum = pgEnum("urgency_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "active",
  "reviewing",
  "resolved",
  "archived",
]);

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "moderator",
  "user",
  "super_admin",
  "municipal",
  "viewer",
]);

export const panicAlertTypeEnum = pgEnum("panic_alert_type", [
  "robbery",
  "medical",
  "fight",
  "fire",
  "missing_person",
  "other",
]);

export const missingPersonStatusEnum = pgEnum("missing_person_status", [
  "active",
  "found",
  "archived",
]);

// Migración 0023: ciclo de vida de las alertas de pánico.
export const panicAlertStatusEnum = pgEnum("panic_alert_status", [
  "active",
  "attending",
  "resolved",
  "false_alarm",
  "expired",
]);

// ── M-05: Catálogo oficial de distritos (multi-tenant) ───────────────────────
export const districtsTable = pgTable("districts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  province: text("province").notNull(),
  department: text("department").notNull(),
  centerLat: real("center_lat"),
  centerLng: real("center_lng"),
  defaultZoom: integer("default_zoom").default(15),
  // FASE-2: Polígono del distrito en formato GeoJSON (Polygon o MultiPolygon)
  boundary: jsonb("boundary"),
  isActive: boolean("is_active").notNull().default(true),
  // Telegram: canal destino de los reportes de ESTE distrito (1 bot, N canales).
  // Se fija desde el panel (pegar id) o por el comando /vincular <código>.
  telegramChatId: text("telegram_chat_id"),
  telegramLinkCode: text("telegram_link_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── M-03/M-05: M-13: Todos los usuarios ahora referencian districts ──────────
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  dni: text("dni").unique(),
  phone: text("phone"),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  bannedAt: timestamp("banned_at", { mode: "string" }),
  banReason: text("ban_reason"),
  // Auto-referencia: se anota el tipo de retorno (AnyPgColumn) para romper la
  // inferencia circular y satisfacer noImplicitAny (patrón oficial de Drizzle).
  banReportedById: integer("ban_reported_by_id").references(
    (): AnyPgColumn => usersTable.id,
  ),
  helpfulReports: integer("helpful_reports").notNull().default(0),
  role: userRoleEnum("role").notNull().default("user"),
  sector: text("sector").notNull().default(""),
  // M-05: districtId es la fuente de verdad; district/province/department se
  // mantienen como campos derivados de solo lectura para el frontend legacy.
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  district: text("district").notNull().default("San Ramón"),
  province: text("province").notNull().default("Chanchamayo"),
  department: text("department").notNull().default("Junín"),
  isActive: boolean("is_active").notNull().default(true),
  reportsCount: integer("reports_count").notNull().default(0),
  // FASE 5: Sistema de strikes y reputación
  trustScore: integer("trust_score").notNull().default(50),
  suspendedUntil: timestamp("suspended_until"),
  // VecinoId: identificador publico de 6 digitos para anonimizar vecinos
  vecinoId: integer("vecino_id").unique(),
  // displayName: nombre real que se muestra en respuestas a reportes (visores/municipales)
  displayName: text("display_name"),
  // alias: nombre en clave editable por el vecino (reemplaza a "Vecino XXXXXX")
  alias: text("alias"),
  // Item 4: Progressive login blocking
  loginAttempts: integer("login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: reportCategoryEnum("category").notNull(),
  urgency: urgencyEnum("urgency").notNull(),
  status: reportStatusEnum("status").notNull().default("active"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address").notNull().default(""),
  sector: text("sector").notNull(),
  // M-05: districtId es la fuente de verdad
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  district: text("district").notNull().default("San Ramón"),
  province: text("province").notNull().default("Chanchamayo"),
  department: text("department").notNull().default("Junín"),
  imageUrl: text("image_url"),
  // Nota de voz opcional (≤20s), URL de Cloudinary (resource_type video/audio).
  audioUrl: text("audio_url"),
  authorName: text("author_name").notNull(),
  contactPhone: text("contact_phone"),
  // Bugfix 1: Email real del vecino (no inferido de contactPhone)
  contactEmail: text("contact_email"),
  // Bugfix 4: Referencia directa al usuario autor
  authorUserId: integer("author_user_id").references(() => usersTable.id),
  confirmedCount: integer("confirmed_count").notNull().default(0),
  // Verificación comunitaria: vecinos que confirman que la solución es real.
  // Al llegar a 10 el reporte pasa a "archived" y desaparece del mapa/radar.
  resolutionConfirmedCount: integer("resolution_confirmed_count")
    .notNull()
    .default(0),
  assignedTo: integer("assigned_to").references(() => departmentsTable.id),
  // Migración 0023: reporte generado a partir de una alerta de pánico.
  panicAlertId: integer("panic_alert_id").references(
    (): AnyPgColumn => panicAlertsTable.id,
  ),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedBy: text("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── M-03: panic_alerts ahora tiene districtId ───────────────────────────────
export const panicAlertsTable = pgTable("panic_alerts", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  type: panicAlertTypeEnum("type").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address").notNull().default(""),
  authorName: text("author_name").notNull(),
  sector: text("sector").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Migración 0023: ciclo de vida (estado, resolución, expiración, reporte enlazado).
  status: panicAlertStatusEnum("status").default("active"),
  resolvedAt: timestamp("resolved_at"),
  resolvedById: integer("resolved_by_id").references(
    (): AnyPgColumn => usersTable.id,
  ),
  resolutionNote: text("resolution_note"),
  expiresAt: timestamp("expires_at"),
  linkedReportId: integer("linked_report_id").references(
    (): AnyPgColumn => reportsTable.id,
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── M-03: missing_persons ahora tiene districtId ────────────────────────────
export const missingPersonsTable = pgTable("missing_persons", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  name: text("name").notNull(),
  age: integer("age"),
  clothing: text("clothing").notNull(),
  photoUrl: text("photo_url"),
  lastSeenLatitude: real("last_seen_latitude").notNull(),
  lastSeenLongitude: real("last_seen_longitude").notNull(),
  lastSeenAddress: text("last_seen_address").notNull(),
  lastSeenAt: timestamp("last_seen_at").notNull(),
  contactInfo: text("contact_info").notNull(),
  status: missingPersonStatusEnum("status").notNull().default("active"),
  reportedBy: text("reported_by").notNull(),
  // Migración 0024: user id del reportante (para identificar al autor de forma
  // fiable; `reportedBy` solo guarda el nombre). Nullable: filas previas sin dato.
  reportedById: integer("reported_by_id").references(
    (): AnyPgColumn => usersTable.id,
  ),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedBy: text("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Servicios en vivo: rastreo GPS de camión recolector y vendedores ────────
// Un "transmisor" (camión recolector, panadero, lechero, tamalero, gasero,
// aguatero o un vendedor de comida dominical) comparte su ubicación en vivo;
// los vecinos lo ven moverse por el mapa del distrito. Puede transmitir sin
// sesión (muchos son ambulantes), por eso la autorización de ping/stop usa
// una `broadcastKey` secreta devuelta al iniciar la transmisión.
export const liveProviderTypeEnum = pgEnum("live_provider_type", [
  "recolector", // camión de basura
  "panadero",
  "lechero",
  "tamalero",
  "gasero",
  "agua", // reparto de agua
  "vendedor", // vendedor de comida (pollada, patasca, tamales…) con etiqueta libre
  "otro",
]);

export const liveProvidersTable = pgTable("live_providers", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  // Opcional: si el transmisor tiene cuenta, se enlaza (para límites/moderación).
  userId: integer("user_id").references((): AnyPgColumn => usersTable.id),
  type: liveProviderTypeEnum("type").notNull(),
  // Etiqueta libre para "vendedor"/"otro" (ej: "Vendo patasca y pollada hoy").
  label: text("label").notNull().default(""),
  // Nombre visible de quien transmite (ej: "Panadería San José").
  displayName: text("display_name").notNull().default(""),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Clave secreta para autorizar ping/stop sin sesión iniciada.
  broadcastKey: text("broadcast_key").notNull(),
  // Si la transmisión proviene de un dispositivo oficial registrado (camión
  // recolector con celular montado o GPS vehicular), se enlaza aquí y se marca
  // como verificada (distintivo "Oficial" en el mapa).
  deviceId: integer("device_id").references(
    (): AnyPgColumn => liveDevicesTable.id,
  ),
  verified: boolean("verified").notNull().default(false),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  // Cada ping actualiza `updatedAt`; sirve de "última vez visto" (lastSeen).
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Dispositivos oficiales de rastreo (registrados desde el panel admin) ─────
// La municipalidad da de alta un camión/servicio y obtiene una `deviceKey`
// secreta. El celular montado (o un GPS vehicular) reporta su ubicación con esa
// clave, sin login ni operador: aparece como transmisión "Oficial" con su ruta
// e historial. La misma clave sirve para el modo dispositivo del app y para un
// endpoint de ingesta HTTP (GPS vehicular vía Traccar/HTTP).
export const liveDevicesTable = pgTable("live_devices", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  type: liveProviderTypeEnum("type").notNull().default("recolector"),
  label: text("label").notNull().default(""),
  deviceKey: text("device_key").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  createdById: integer("created_by_id").references(
    (): AnyPgColumn => usersTable.id,
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Ruta recorrida por una transmisión (breadcrumbs) ────────────────────────
// Cada punto es una posición por la que pasó el transmisor. Se guardan
// submuestreados (solo si avanzó ≥ ~12 m) para dibujar la línea de la ruta en
// vivo y conservarla en el historial sin inflar la base de datos.
export const liveTracksTable = pgTable("live_tracks", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => liveProvidersTable.id),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

// ── Clips de voz para los avisos ("Vecino, la tamalera está cerca") ─────────
// El superadmin/municipalidad graba o sube un audio por tipo de servicio y
// distrito, para que el aviso suene con la voz y el acento locales en vez del
// TTS robótico. Si no hay clip, la app usa el TTS como respaldo.
export const liveVoiceClipsTable = pgTable("live_voice_clips", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  type: liveProviderTypeEnum("type").notNull(),
  audioUrl: text("audio_url"), // URL de Cloudinary (null = solo frase para TTS)
  phrase: text("phrase").notNull().default(""), // texto del aviso (respaldo TTS)
  enabled: boolean("enabled").notNull().default(true),
  updatedById: integer("updated_by_id").references(
    (): AnyPgColumn => usersTable.id,
  ),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Suscripción de proximidad: aviso push cuando un servicio se acerca a casa ─
// Guarda (en el servidor) la casa del vecino + su token push, para que el aviso
// llegue AUNQUE la app esté cerrada. La detección de cercanía la hace el
// servidor cuando un proveedor se mueve.
export const proximitySubscriptionsTable = pgTable("proximity_subscriptions", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  pushToken: text("push_token").notNull().unique(),
  homeLat: real("home_lat").notNull(),
  homeLng: real("home_lng").notNull(),
  radiusM: integer("radius_m").notNull().default(300),
  types: jsonb("types").notNull().default(["recolector"]), // qué servicios avisar
  enabled: boolean("enabled").notNull().default(true),
  // Último aviso por tipo (epoch ms) para no repetir: { recolector: 172... }.
  cooldowns: jsonb("cooldowns").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── M-03: ad_slots ahora tiene districtId ───────────────────────────────────
export const adSlotsTable = pgTable("ad_slots", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  businessName: text("business_name").notNull(),
  tagline: text("tagline").notNull(),
  imageUrl: text("image_url"),
  targetUrl: text("target_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sector: text("sector"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationTypeEnum = pgEnum("notification_type", [
  "system",
  "panic_alert",
  "missing_person",
  "report_update",
  "report_nearby",
]);

// ── M-03: notifications ahora tiene districtId ──────────────────────────────
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  userId: integer("user_id"),
  type: notificationTypeEnum("type").notNull().default("system"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Report Messages (hilo de comunicación vecino ↔ admin) ────────────────────
export const messageSenderEnum = pgEnum("message_sender", ["admin", "vecino"]);
export const messageChannelEnum = pgEnum("message_channel", [
  "whatsapp",
  "app",
  "email",
]);

export const reportMessagesTable = pgTable("report_messages", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => reportsTable.id),
  sender: messageSenderEnum("sender").notNull(),
  channel: messageChannelEnum("channel").notNull(),
  content: text("content").notNull(),
  adminName: text("admin_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Licencias para municipalidades (solo super_admin crea) ───────────────────
export const licensesTable = pgTable("licenses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  siglas: text("siglas").notNull(),
  districtName: text("district_name").notNull(),
  province: text("province").notNull(),
  department: text("department").notNull(),
  districtId: integer("district_id").references(() => districtsTable.id),
  municipalUserId: integer("municipal_user_id").references(() => usersTable.id),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(false),
  maxViewers: integer("max_viewers").notNull().default(10),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPanicAlertSchema = createInsertSchema(panicAlertsTable).omit(
  { id: true, createdAt: true },
);
export const insertMissingPersonSchema = createInsertSchema(
  missingPersonsTable,
).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export const insertAdSlotSchema = createInsertSchema(adSlotsTable).omit({
  id: true,
  createdAt: true,
});
export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true, createdAt: true });

// ── Nuevas: Categorías dinámicas (reemplazan pgEnum) ────────────────────────
export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  icon: text("icon").notNull().default("AlertTriangle"),
  color: text("color").notNull().default("#6b7280"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Nuevas: Departamentos municipales (asignación de reportes) ──────────────
export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Nuevas: Auditoría de cambios (timeline público + accountability) ────────
export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  entityType: text("entity_type").notNull(), // "report" | "panic_alert" | "missing_person"
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(), // "created" | "status_changed" | "assigned" | "updated" | "deleted"
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  changedBy: text("changed_by"), // email o nombre de quien hizo el cambio
  changedById: integer("changed_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Nuevas: Suscripciones a categorías/sectores (push FCM selectivo) ────────
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  fcmToken: text("fcm_token"),
  email: text("email"),
  categories: text("categories").notNull().default("[]"), // JSON array of slugs
  sectors: text("sectors").notNull().default("[]"), // JSON array of sector names
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Mantener compatibilidad con insertSchemas existentes más los nuevos
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  id: true,
  createdAt: true,
});
export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit(
  { id: true, createdAt: true },
);
export const insertAuditLogSchema = createInsertSchema(auditLogTable).omit({
  id: true,
  createdAt: true,
});
export const insertSubscriptionSchema = createInsertSchema(
  subscriptionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type Category = typeof categoriesTable.$inferSelect;
export type Department = typeof departmentsTable.$inferSelect;
export type AuditLog = typeof auditLogTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;

// ── Votos de usuarios en reportes (upvote system) ───────────────────────────
export const votesTable = pgTable("votes", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => reportsTable.id),
  userId: integer("user_id"),
  userIp: text("user_ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Recursos comunitarios por distrito ──────────────────────────────────────
export const districtResourcesTable = pgTable("district_resources", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  type: text("type").notNull(), // "police" | "fire" | "hospital" | "helpline" | "other"
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  url: text("url"),
  description: text("description").default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVoteSchema = createInsertSchema(votesTable).omit({
  id: true,
  createdAt: true,
});
export const insertDistrictResourceSchema = createInsertSchema(
  districtResourcesTable,
).omit({ id: true, createdAt: true });

// FASE 5 — Schemas eliminados temporalmente por compatibilidad drizzle-zod
// Los endpoints usan validación manual con zod directo en vez de createInsertSchema
export type InsertUserStrike = typeof userStrikesTable.$inferInsert;
export type InsertCommunityFlag = typeof communityFlagsTable.$inferInsert;

// ── Confirmaciones de solución (verificación comunitaria) ────────────────────
// Cuando la municipalidad marca un reporte como "resolved", los vecinos pueden
// confirmar que la solución es real. Al llegar a 10 confirmaciones, el reporte
// pasa a "archived" y desaparece del mapa y del radar.
export const resolutionConfirmationsTable = pgTable(
  "resolution_confirmations",
  {
    id: serial("id").primaryKey(),
    reportId: integer("report_id")
      .notNull()
      .references(() => reportsTable.id),
    userId: integer("user_id").references(() => usersTable.id),
    userIp: text("user_ip"),
    // "validity" = el reporte es real · "resolution" = la solución es real
    kind: text("kind").notNull().default("validity"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
);

export const insertResolutionConfirmationSchema = createInsertSchema(
  resolutionConfirmationsTable,
).omit({ id: true, createdAt: true });
export type ResolutionConfirmation =
  typeof resolutionConfirmationsTable.$inferSelect;

// FASE 5
export type UserStrike = typeof userStrikesTable.$inferSelect;
export type CommunityFlag = typeof communityFlagsTable.$inferSelect;

// ── Civic Education (quizzes, lecciones gamificadas) ────────────────────────
export const civicEducationTopicsTable = pgTable("civic_education_topics", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(), // Markdown/HTML content
  icon: text("icon").notNull().default("BookOpen"),
  difficulty: integer("difficulty").notNull().default(1), // 1-5
  questions: text("questions").notNull().default("[]"), // JSON array of {question, options[], correctIndex}
  xpReward: integer("xp_reward").notNull().default(50),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userEducationProgressTable = pgTable("user_education_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  topicId: integer("topic_id")
    .notNull()
    .references(() => civicEducationTopicsTable.id),
  completed: boolean("completed").notNull().default(false),
  score: integer("score").notNull().default(0),
  xpEarned: integer("xp_earned").notNull().default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCivicTopicSchema = createInsertSchema(
  civicEducationTopicsTable,
).omit({ id: true, createdAt: true });

// ── Refresh tokens para renovación de sesión (BUG-4) ─────────────────────────
export const refreshTokensTable = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── FASE 5: Strikes por reportes falsos ─────────────────────────────────────
export const userStrikesTable = pgTable("user_strikes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  reportId: integer("report_id")
    .notNull()
    .references(() => reportsTable.id),
  motivo: text("motivo").notNull(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  activo: boolean("activo").notNull().default(true),
  expiresAt: timestamp("expires_at"),
});

// ── FASE 5: Community flags (vecinos reportan reportes falsos) ───────────────
export const communityFlagsTable = pgTable("community_flags", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => reportsTable.id),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Puntos estáticos (acumulan reportes en una misma ubicación) ──────────────
export const staticPointsTable = pgTable("static_points", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id")
    .notNull()
    .references(() => districtsTable.id),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  category: reportCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  address: text("address").default(""),
  sector: text("sector").notNull(),
  reportCount: integer("report_count").notNull().default(0),
  firstReportedAt: timestamp("first_reported_at").notNull().defaultNow(),
  lastReportedAt: timestamp("last_reported_at").notNull().defaultNow(),
  resolutionReports: integer("resolution_reports").notNull().default(0),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { mode: "string" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── CONSENTIMIENTO DE DATOS (Ley N° 29733 — Protección de Datos Personales) ──
// Registro append-only: nunca se actualiza ni borra. Cada aceptación del
// usuario queda como evidencia con versión de la política, fecha, IP y agente.
export const consentTypeEnum = pgEnum("consent_type", [
  "privacy_policy", // Política de privacidad / tratamiento de datos
  "terms_of_use", // Términos y condiciones de uso
]);

export const userConsentsTable = pgTable("user_consents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  type: consentTypeEnum("type").notNull(),
  version: text("version").notNull(), // ej. "2026-07-v1"
  acceptedAt: timestamp("accepted_at").notNull().defaultNow(),
  ipAddress: text("ip_address"), // evidencia; se conserva por interés legítimo
  userAgent: text("user_agent"),
});
