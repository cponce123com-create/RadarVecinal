import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { optionalAuth } from "./routes/auth";

const app: Express = express();

// Swagger UI en /api-docs (antes de las rutas API)
import swaggerRouter from "./lib/swagger";
app.use(swaggerRouter);

// Trust proxy headers so rate-limit works correctly behind reverse proxy
app.set("trust proxy", 1);

// B-19: Security headers (helmet) — CSP básico para prevenir XSS
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"])], // unsafe-eval solo para React dev
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
}));

// Disable ETag so API responses are never cached as stale empty data
app.set("etag", false);

// BUG-1: JWT debe decodificarse ANTES del CORS y limiters que usan jwtUser
app.use("/api", optionalAuth);

// CORS: incluir orígenes fijos de Capacitor (BUG-3) + los que vengan de env var.
// En producción el frontend se sirve desde express.static (mismo origen),
// así que no necesita CORS, pero Capacitor (APK) usa https://localhost.
const CAPACITOR_ORIGINS = ["https://localhost", "capacitor://localhost", "http://localhost"];
const allowedOrigins = [
  ...CAPACITOR_ORIGINS,
  ...(process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
    : ["http://localhost:5173", "http://localhost:3000"]),
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// BUG-2: RLS por variables de sesión abandonado — ver replit.md para rationale.
// La defensa multi-tenant está en la capa de aplicación (tenant.ts checkTenant),
// que filtra explícitamente por districtId en cada query. Las políticas RLS
// en DB (migración 0007) se mantienen solo como defensa estática en profundidad
// (ej: denegar DELETE directo). No dependemos de set_config con pool.

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

const sseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas conexiones SSE. Intenta reconectar en un minuto." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta en 15 minutos." },
  keyGenerator: (req) => {
    // Rate limit por email (si disponible) + IP (con ipKeyGenerator para IPv6)
    const email = req.body?.email;
    const ipKey = ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "");
    return email ? `auth_${email.toLowerCase().trim()}_${ipKey}` : `auth_ip_${ipKey}`;
  },
});

app.use("/api/auth", authLimiter);
app.use("/api/panic-alerts/stream", sseLimiter);
app.use("/api/panic-alerts", panicLimiter);
app.use("/api/reports", reportLimiter);
app.use("/api", generalLimiter);

app.use("/api", router);

// ── 404 JSON para rutas /api desconocidas ─────────────────────────────────
app.use("/api/*", (_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// ── Error handler global ──────────────────────────────────────────────────
app.use((err: any, req: any, res: any, _next: any) => {
  req.log?.error?.({ err }, "Unhandled error");
  res.status(500).json({ error: "Error interno del servidor." });
});

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
