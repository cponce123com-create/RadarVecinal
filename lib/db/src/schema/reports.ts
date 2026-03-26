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

export const userRoleEnum = pgEnum("user_role", ["admin", "moderator", "user"]);

export const panicAlertTypeEnum = pgEnum("panic_alert_type", [
  "robbery",
  "medical",
  "fight",
  "fire",
  "missing_person",
  "other",
]);

export const missingPersonStatusEnum = pgEnum("missing_person_status", ["active", "found", "archived"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  dni: text("dni").unique(),
  role: userRoleEnum("role").notNull().default("user"),
  sector: text("sector").notNull().default(""),
  district: text("district").notNull().default("San Miguel"),
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
  imageUrl: text("image_url"),
  authorName: text("author_name").notNull(),
  contactPhone: text("contact_phone"),
  confirmedCount: integer("confirmed_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const panicAlertsTable = pgTable("panic_alerts", {
  id: serial("id").primaryKey(),
  type: panicAlertTypeEnum("type").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address").notNull().default(""),
  authorName: text("author_name").notNull(),
  sector: text("sector").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const missingPersonsTable = pgTable("missing_persons", {
  id: serial("id").primaryKey(),
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

export const adSlotsTable = pgTable("ad_slots", {
  id: serial("id").primaryKey(),
  businessName: text("business_name").notNull(),
  tagline: text("tagline").notNull(),
  imageUrl: text("image_url"),
  targetUrl: text("target_url").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sector: text("sector"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPanicAlertSchema = createInsertSchema(panicAlertsTable).omit({ id: true, createdAt: true });
export const insertMissingPersonSchema = createInsertSchema(missingPersonsTable).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertAdSlotSchema = createInsertSchema(adSlotsTable).omit({ id: true, createdAt: true });

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
export type InsertPanicAlert = z.infer<typeof insertPanicAlertSchema>;
export type PanicAlert = typeof panicAlertsTable.$inferSelect;
export type InsertMissingPerson = z.infer<typeof insertMissingPersonSchema>;
export type MissingPerson = typeof missingPersonsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type AdSlot = typeof adSlotsTable.$inferSelect;
