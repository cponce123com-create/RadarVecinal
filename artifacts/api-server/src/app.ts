import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { optionalAuth } from "./routes/auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const app: Express = express();

// Swagger UI en /api-docs (antes de las rutas API)
import swaggerRouter from "./lib/swagger";
app.use(swaggerRouter);

// Trust proxy headers so rate-limit works correctly behind reverse proxy
app.set("trust proxy", 1);

// B-19: Security headers (helmet) — disable CSP/COEP to keep API accessible from frontend
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

// Disable ETag so API responses are never cached as stale empty data
app.set("etag", false);

// RLS: setear variables de sesión PostgreSQL para Row Level Security (migración 0007)
// Inspirado en FixNet (Supabase RLS). Cada request setea app.district_id y app.role.
// app.role se setea SIEMPRE (incluso sin auth) para que las políticas RLS puedan
// diferenciar entre super_admin (bypass) y usuarios normales (filtrados por distrito).
// Las políticas en DB usan current_setting(name, true) para no fallar si no está seteado.
app.use("/api", (req, _res, next) => {
  const user = (req as any).jwtUser;
  const role = user?.role ?? "anonymous";
  db.execute(sql`SELECT set_config('app.role', ${role}, true)`).catch(() => {});
  if (user?.districtId) {
    db.execute(sql`SELECT set_config('app.district_id', ${String(user.districtId)}, true)`).catch(() => {});
  } else {
    db.execute(sql`SELECT set_config('app.district_id', '0', true)`).catch(() => {});
  }
  next();
});

// CORS: solo orígenes explícitos. En producción el frontend se sirve
// desde express.static (mismo origen), así que no necesita CORS.
// Para desarrollo local (Vite en :5173) o entornos con frontend separado,
// configurar CORS_ORIGIN como lista separada por comas.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach JWT user info for auth-aware rate limiting (applied before limiters)
app.use("/api", optionalAuth);

// Force fresh responses — prevent stale cached empty data in browsers
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});

// B-18: Rate limiting — specific limits per endpoint type to prevent spam
// Authenticated users get higher limits than anonymous users
function authAwareRateLimit(windowMs: number, authMax: number, anonMax: number, message: string) {
  return rateLimit({
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    keyGenerator: (req) => {
      const jwtUser = (req as any).jwtUser;
      if (jwtUser?.sub) return `user_${jwtUser.sub}`;
      return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "");
    },
    max: (req) => {
      const jwtUser = (req as any).jwtUser;
      return jwtUser?.sub ? authMax : anonMax;
    },
  });
}

const generalLimiter = authAwareRateLimit(60 * 1000, 200, 60, "Demasiadas solicitudes. Intenta de nuevo en un minuto.");

const reportLimiter = authAwareRateLimit(60 * 1000, 30, 5, "Límite de reportes alcanzado. Máximo 30 por minuto (autenticados) o 5 por minuto (anónimo).");

const panicLimiter = authAwareRateLimit(60 * 1000, 15, 3, "Límite de alertas de pánico alcanzado. Máximo 15 por minuto (autenticados) o 3 por minuto (anónimo).");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta en 15 minutos." },
});

app.use("/api/auth", authLimiter);
app.use("/api/panic-alerts", panicLimiter);
app.use("/api/reports", reportLimiter);
app.use("/api", generalLimiter);

app.use("/api", router);

// ── Servir frontend React build en producción ──────────────────────────────
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../radar-vecinal/dist/public");
app.use(express.static(frontendDist));
// SPA fallback — todas las rutas no-API sirven index.html
app.get("*path", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Not found" });
  });
});

export default app;
