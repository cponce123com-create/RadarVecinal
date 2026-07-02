import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(), // 'UPDATE_STATUS', 'DELETE', 'CREATE'
  targetType: varchar("target_type", { length: 50 }).notNull(), // 'REPORT', 'MISSING_PERSON'
  targetId: uuid("target_id").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  ip: varchar("ip", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
