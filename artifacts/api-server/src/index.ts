import app from "./app";
import { logger } from "./lib/logger";
import { autoSeedIfEmpty } from "./lib/autoSeed";
import { startReportWorker } from "./workers/reportWorker";
import { startEmailWorker } from "./workers/emailWorker";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Start background workers (non-blocking)
  startReportWorker();
  startEmailWorker();
});
=> logger.error({ e }, "autoSeed failed"));
  } else {
    logger.info("Production mode — auto-seed skipped. Use POST /api/seed with x-seed-key to seed manually.");
  }

  // Start background workers (non-blocking)
  startReportWorker();
  startEmailWorker();
});
