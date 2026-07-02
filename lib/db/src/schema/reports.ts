import { pgTable, text, serial, boolean, real, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
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
]);

export const urgencyEnum = pgEnum("urgency_level", ["low", "medium", "high", "critical"]);

export const reportStatusEnum = pgEnum("report_status", ["active", "reviewing", "resolved", "archived"]);

export const userRoleEnum = pgEnum("user_role", ["admin", "moderator", "user", "super_admin"]);

export const panicAlertTypeEnum = pgEnum("panic_alert_type", [
  "robbery",
  "medical",
  "fight",
  "fire",
  "missing_person",
  "other",
]);

export const missingPersonStatusEnum = pgEnum("missing_person_status", ["active", "found", "archived"]);

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
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── M-03/M-05: M-13: Todos los usuarios ahora referencian districts ──────────
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  dni: text("dni").unique(),
  role: userRoleEnum("role").notNull().default("user"),
  sector: text("sector").notNull().default(""),
  // M-05: districtId es la fuente de verdad; district/province/department se
  // mantienen como campos derivados de solo lectura para el frontend legacy.
  districtId: integer("district_id").notNull().references(() => districtsTable.id),
  district: text("district").notNull().default("San Ramón"),
  province: text("province").notNull().default("Chanchamayo"),
  department: text("department").notNull().default("Junín"),
  isActive: boolean("is_active").notNull().default(true),
  reportsCount: integer("reports_count").notNull().default(0),
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
  districtId: integer("district_id").notNull().references(() => districtsTable.id),
  district: text("district").notNull().default("San Ramón"),
  province: text("province").notNull().default("Chanchamayo"),
  department: text("department").notNull().default("Junín"),
  imageUrl: text("image_url"),
  authorName: text("author_name").notNull(),
  contactPhone: text("contact_phone"),
  confirmedCount: integer("confirmed_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── M-03: panic_alerts ahora tiene districtId ───────────────────────────────
export const panicAlertsTable = pgTable("panic_alerts", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id").notNull().references(() => districtsTable.id),
  type: panicAlertTypeEnum("type").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address").notNull().default(""),
  authorName: text("author_name").notNull(),
  sector: text("sector").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── M-03: missing_persons ahora tiene districtId ────────────────────────────
export const missingPersonsTable = pgTable("missing_persons", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id").notNull().references(() => districtsTable.id),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── M-03: ad_slots ahora tiene districtId ───────────────────────────────────
export const adSlotsTable = pgTable("ad_slots", {
  id: serial("id").primaryKey(),
  districtId: integer("district_id").notNull().references(() => districtsTable.id),
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
  districtId: integer("district_id").notNull().references(() => districtsTable.id),
  userId: integer("user_id"),
  type: notificationTypeEnum("type").notNull().default("system"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPanicAlertSchema = createInsertSchema(panicAlertsTable).omit({ id: true, createdAt: true });
export const insertMissingPersonSchema = createInsertSchema(missingPersonsTable).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertAdSlotSchema = createInsertSchema(adSlotsTable).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
export type InsertPanicAlert = z.infer<typeof insertPanicAlertSchema>;
export type PanicAlert = typeof panicAlertsTable.$inferSelect;
export type InsertMissingPerson = z.infer<typeof insertMissingPersonSchema>;
export type MissingPerson = typeof missingPersonsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type AdSlot = typeof adSlotsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type District = typeof districtsTable.$inferSelect;
