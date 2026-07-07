import app from "./app";
import { logger } from "./lib/logger";
import { startReportWorker } from "./workers/reportWorker";
import { startEmailWorker } from "./workers/emailWorker";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Manejadores de errores no capturados ───────────────────────────────────
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ err: reason, promise }, "Unhandled Rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught Exception");
  // En uncaughtException es seguro salir después de loguear
  process.exit(1);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
let shuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Shutdown signal received — starting graceful shutdown");

  try {
    // 1. Dejar de aceptar nuevas conexiones
    server.close(() => {
      logger.info("HTTP server closed — no longer accepting connections");
    });

    // 2. Cerrar conexiones SSE activas
    try {
      const { sseClients } = await import("./routes/alerts");
      const sseCount = sseClients?.length ?? 0;
      if (sseCount > 0) {
        logger.info({ count: sseCount }, "Closing SSE connections");
        for (const client of sseClients ?? []) {
          try {
            client.res.end();
          } catch { /* ignore */ }
        }
      }
    } catch { /* alerts module may not have SSE clients */ }

    // 3. Cerrar el pool de base de datos
    await pool.end();
    logger.info("Database pool closed");
  } catch (err) {
    logger.error({ err }, "Error during graceful shutdown");
  }

  // Dar tiempo para que terminen las requests en curso (máx 10s)
  setTimeout(() => {
    logger.info("Shutdown complete — exiting");
    process.exit(0);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ── Iniciar servidor ───────────────────────────────────────────────────────
const server = app.listen(port, () => {

  logger.info({ port }, "Server listening");

  // Start background workers (non-blocking)
  startReportWorker();
  startEmailWorker();
});
