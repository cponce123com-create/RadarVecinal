import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { db } from "@workspace/db";
import { reportsTable, panicAlertsTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "../lib/logger";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  logger.warn("REDIS_URL not set — reportWorker will not start");
}

let connection: IORedis | null = null;
let worker: Worker | null = null;

/**
 * Inicializa el worker de escalado de incidencias.
 * Se ejecuta en segundo plano y no bloquea el servidor HTTP.
 */
export function startReportWorker(): void {
  if (!REDIS_URL) return;
  if (worker) return; // Already started

  connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  // Creamos una cola para programar el job cada hora
  const queue = new Queue("report-escalation", { connection });

  worker = new Worker(
    "report-escalation",
    async () => {
      try {
        // 1. Escalar reportes pendientes > 48h a estado urgente
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const staleReports = await db
          .select({ id: reportsTable.id })
          .from(reportsTable)
          .where(
            and(
              eq(reportsTable.status, "active"),
              lt(reportsTable.createdAt, fortyEightHoursAgo),
            ),
          );

        for (const report of staleReports) {
          await db
            .update(reportsTable)
            .set({ status: "reviewing" })
            .where(eq(reportsTable.id, report.id));
        }

        if (staleReports.length > 0) {
          logger.info(
            { count: staleReports.length },
            "ReportWorker: escalados a reviewing por SLA",
          );
        }

        // 2. Desactivar alertas de pánico > 1h
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const staleAlerts = await db
          .select({ id: panicAlertsTable.id })
          .from(panicAlertsTable)
          .where(
            and(
              eq(panicAlertsTable.isActive, true),
              lt(panicAlertsTable.createdAt, oneHourAgo),
            ),
          );

        for (const alert of staleAlerts) {
          await db
            .update(panicAlertsTable)
            .set({ isActive: false })
            .where(eq(panicAlertsTable.id, alert.id));
        }

        if (staleAlerts.length > 0) {
          logger.info(
            { count: staleAlerts.length },
            "ReportWorker: alertas de pánico desactivadas por expiración",
          );
        }
      } catch (err) {
        logger.error({ err }, "ReportWorker job failed");
      }
    },
    { connection },
  );

  // Programar ejecución cada hora
  queue.add(
    "escalate-stale-reports",
    {},
    { repeat: { pattern: "0 * * * *" } },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "ReportWorker job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "ReportWorker job failed");
  });

  logger.info("ReportWorker started — will run every hour");
}

/**
 * Detiene el worker de manera graceful.
 */
export async function stopReportWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
