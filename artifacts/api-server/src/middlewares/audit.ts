import type { Request } from "express";
import { db } from "@workspace/db";
import { auditLogs } from "@workspace/db/schema/auditLogs";

interface AuditEntry {
  userId: string;
  action: "UPDATE_STATUS" | "DELETE" | "CREATE";
  targetType: "REPORT" | "MISSING_PERSON";
  targetId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

/**
 * Registra un evento de auditoría en la tabla audit_logs.
 * Se usa para rastrear cambios de estado, eliminaciones y creación de reportes/personas desaparecidas.
 */
export async function createAuditLog(
  req: Request,
  entry: AuditEntry,
): Promise<void> {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
      req.ip ??
      req.socket.remoteAddress ??
      "unknown";

    await db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      ip,
    });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to write audit log");
  }
}
