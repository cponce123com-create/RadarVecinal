import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { db } from "@workspace/db";
import { reportsTable, usersTable, districtsTable } from "@workspace/db/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendStatusChangeEmail } from "../lib/email";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  logger.warn("REDIS_URL not set — emailWorker will not start");
}

/** Crea conexión Redis detectando automáticamente si necesita TLS (Upstash) */
function createRedisConnection(url: string): IORedis {
  const needsTls = url.includes("upstash.io") || url.startsWith("rediss://");
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    ...(needsTls ? { tls: {} } : {}),
  });
}

let connection: IORedis | null = null;
let worker: Worker | null = null;

/**
 * Inicializa el worker de correos de recordatorio.
 * Envía un correo al admin del distrito cuando hay más de 5 reportes pendientes.
 */
export function startEmailWorker(): void {
  if (!REDIS_URL) return;
  if (worker) return;

  connection = createRedisConnection(REDIS_URL);

  const queue = new Queue("email-notifications", { connection });

  worker = new Worker(
    "email-notifications",
    async () => {
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const districtsWithBacklog = await db
          .select({
            districtId: reportsTable.districtId,
            count: sql<number>`count(*)`,
          })
          .from(reportsTable)
          .where(
            and(
              eq(reportsTable.status, "active"),
              gte(reportsTable.createdAt, twentyFourHoursAgo),
            ),
          )
          .groupBy(reportsTable.districtId)
          .having(sql`count(*) > 5`);

        for (const row of districtsWithBacklog) {
          const admins = await db
            .select({
              id: usersTable.id,
              email: usersTable.email,
              name: usersTable.name,
            })
            .from(usersTable)
            .where(
              and(
                eq(usersTable.districtId, row.districtId),
                sql`${usersTable.role} IN ('admin', 'moderator', 'super_admin')`,
              ),
            )
            .limit(5);

          const [district] = await db
            .select({ name: districtsTable.name })
            .from(districtsTable)
            .where(eq(districtsTable.id, row.districtId))
            .limit(1);

          for (const admin of admins) {
            if (admin.email) {
              sendStatusChangeEmail({
                to: admin.email,
                reportTitle: `Alerta: ${row.count} reportes pendientes en ${district?.name ?? "tu distrito"}`,
                reportId: 0,
                newStatus: "active",
                districtName: district?.name ?? "",
              }).catch(() => {});
            }
          }
        }

        if (districtsWithBacklog.length > 0) {
          logger.info(
            { districts: districtsWithBacklog.length },
            "EmailWorker: recordatorios enviados a admins",
          );
        }
      } catch (err) {
        logger.error({ err }, "EmailWorker job failed");
      }
    },
    { connection },
  );

  queue.add(
    "pending-reports-reminder",
    {},
    { repeat: { pattern: "0 */4 * * *" } },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "EmailWorker job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "EmailWorker job failed");
  });

  logger.info("EmailWorker started — will run every 4 hours");
}

export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
