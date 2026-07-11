import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  usersTable,
  districtsTable,
  refreshTokensTable,
  userConsentsTable,
} from "@workspace/db/schema";
import { eq, and, sql, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  isSuperAdmin,
  isMunicipalityLevel,
  isModeratorLevel,
} from "../lib/roles";

const router: IRouter = Router();

const JWT_SECRET: string = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");
// BUG-4: Access token corto (15 min), refresh token largo (30 días)
const JWT_EXPIRES = "15m";
const JWT_REFRESH_EXPIRES_DAYS = 30;

// ── Zod schemas ─────────────────────────────────────────────────────────────
// Versión vigente de la política de privacidad y términos. Si el texto legal
// cambia, incrementar aquí y en el frontend (AuthModal) para exigir re-consentimiento.
export const CURRENT_CONSENT_VERSION = "2026-07-v1";

const registerSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(100),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una minúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
  sector: z.string().min(1, "Sector requerido").max(100),
  district: z.string().min(1).max(100).optional().default("San Ramón"),
  dni: z.string().min(8, "DNI inválido").max(12).optional().nullable(),
  phone: z
    .string()
    .regex(/^[+\d\s\-()]{7,15}$/, "Teléfono inválido")
    .optional()
    .nullable(),
  firstName: z.string().min(1, "Nombre requerido").max(100).optional(),
  lastName: z.string().min(1, "Apellido requerido").max(100).optional(),
  districtId: z.number().positive("Distrito requerido").optional(),
  // Ley N° 29733: el consentimiento debe ser previo, expreso e inequívoco.
  // z.literal(true) rechaza el registro si el checkbox no fue marcado —
  // el servidor lo exige aunque alguien manipule el frontend.
  privacyConsent: z.literal(true, {
    errorMap: () => ({
      message:
        "Debes aceptar la política de privacidad y el tratamiento de tus datos personales para crear una cuenta.",
    }),
  }),
  consentVersion: z
    .string()
    .min(1)
    .max(30)
    .optional()
    .default(CURRENT_CONSENT_VERSION),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token requerido"),
});

// ── Helper: busca o falla al distrito por nombre ────────────────────────────
async function resolveDistrict(name: string): Promise<number> {
  const [d] = await db
    .select({ id: districtsTable.id })
    .from(districtsTable)
    .where(eq(districtsTable.name, name))
    .limit(1);
  if (!d) throw new Error(`Distrito no válido.`);
  return d.id;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function signToken(user: {
  id: number;
  email: string;
  role: string;
  district: string;
  districtId: number;
}) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      district: user.district,
      districtId: user.districtId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

async function signRefreshToken(userId: number): Promise<string> {
  // Generar token criptográficamente aleatorio
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");

  const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRES_DAYS * 86400000);

  await db
    .insert(refreshTokensTable)
    .values({
      userId,
      tokenHash: hash,
      expiresAt,
    })
    .catch(() => {}); // best-effort

  return raw; // devolvemos el token raw, el hash se guarda en DB
}

async function revokeRefreshToken(rawToken: string): Promise<void> {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  await db
    .update(refreshTokensTable)
    .set({ revoked: true })
    .where(eq(refreshTokensTable.tokenHash, hash))
    .catch(() => {});
}

async function validateRefreshToken(rawToken: string): Promise<number | null> {
  const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(
      and(
        eq(refreshTokensTable.tokenHash, hash),
        eq(refreshTokensTable.revoked, false),
        sql`${refreshTokensTable.expiresAt} > NOW()`,
      ),
    )
    .limit(1);

  if (!stored) return null;
  return stored.userId;
}

function toISO(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d;
  if (typeof d === "object" && typeof d.toISOString === "function")
    return d.toISOString();
  return String(d);
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    sector: u.sector,
    district: u.district,
    districtId: u.districtId,
    isActive: u.isActive,
    reportsCount: u.reportsCount,
    alias: u.alias ?? null,
    vecinoId: u.vecinoId ?? null,
    // Item 7: Include suspension status for appeal UI
    suspendedUntil: toISO(u.suspendedUntil),
    createdAt: toISO(u.createdAt) ?? new Date().toISOString(),
  };
}

// ── POST /auth/register ──────────────────────────────────────────────────────
router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return res.status(400).json({ error: msg });
  }

  const { name, email, password, sector, district, dni, consentVersion } =
    parsed.data;

  try {
    const existing = await db
      .select({ id: usersTable.id, lockedUntil: usersTable.lockedUntil })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      const userRecord = existing[0];
      // Item 4: Si el usuario existe y está bloqueado, no permitir re-registro
      if (
        userRecord.lockedUntil &&
        new Date(userRecord.lockedUntil) > new Date()
      ) {
        return res.status(429).json({
          error:
            "Cuenta bloqueada temporalmente por muchos intentos fallidos. Intenta más tarde.",
        });
      }
      return res
        .status(409)
        .json({ error: "Ya existe una cuenta con ese correo." });
    }

    // M-05: Resolver districtId desde el catálogo
    let districtId: number;
    try {
      districtId = await resolveDistrict(district ?? "San Ramón");
    } catch {
      return res
        .status(400)
        .json({ error: "Distrito no válido. Verifica e intenta de nuevo." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        sector,
        districtId,
        district: district ?? "San Ramón",
        dni: dni ?? null,
        role: "user",
        isActive: true,
        reportsCount: 0,
      })
      .returning();

    // ── Ley N° 29733: guardar evidencia del consentimiento ────────────────
    // Registro append-only con versión de la política, fecha, IP y navegador.
    // `trust proxy` está activo en app.ts, así que req.ip es la IP real del
    // cliente detrás del proxy de Render. Best-effort: si el insert falla no
    // debe bloquear el registro (el consentimiento ya fue validado por Zod),
    // pero se loguea como error para corregirlo.
    try {
      await db.insert(userConsentsTable).values({
        userId: user.id,
        type: "privacy_policy",
        version: consentVersion ?? CURRENT_CONSENT_VERSION,
        ipAddress: req.ip ?? null,
        userAgent: (req.headers["user-agent"] ?? "").slice(0, 300) || null,
      });
    } catch (consentErr) {
      req.log.error(
        { err: consentErr, userId: user.id },
        "Failed to persist user consent record",
      );
    }

    const token = signToken(user);
    return res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "register failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /auth/login ─────────────────────────────────────────────────────────
// Item 4: Progressive login blocking — 5 failed attempts = 15 min lockout
router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (!user) {
      return res
        .status(401)
        .json({ error: "Correo o contraseña incorrectos." });
    }

    // Item 4: Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMin = Math.ceil(
        (new Date(user.lockedUntil).getTime() - Date.now()) / 60000,
      );
      return res.status(429).json({
        error: `Cuenta bloqueada por muchos intentos fallidos. Intenta de nuevo en ${remainingMin} minuto(s).`,
      });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        error:
          "Esta cuenta no tiene contraseña configurada. Regístrate de nuevo.",
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      // Item 4: Increment failed attempts
      const newAttempts = (user.loginAttempts ?? 0) + 1;
      if (newAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await db
          .update(usersTable)
          .set({ loginAttempts: newAttempts, lockedUntil })
          .where(eq(usersTable.id, user.id));
        return res.status(429).json({
          error:
            "Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.",
        });
      }
      await db
        .update(usersTable)
        .set({ loginAttempts: newAttempts })
        .where(eq(usersTable.id, user.id));
      return res
        .status(401)
        .json({ error: "Correo o contraseña incorrectos." });
    }

    // Item 4: Successful login — reset attempts
    await db
      .update(usersTable)
      .set({ loginAttempts: 0, lockedUntil: null })
      .where(eq(usersTable.id, user.id));

    if (!user.isActive) {
      return res
        .status(403)
        .json({ error: "Cuenta desactivada. Contacta al administrador." });
    }

    const token = signToken(user);
    return res.json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "login failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /auth/refresh — Renovar access token con refresh token ─────────────
router.post("/auth/refresh", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Refresh token inválido",
    });
  }

  const { refreshToken } = parsed.data;

  try {
    const userId = await validateRefreshToken(refreshToken);
    if (!userId) {
      return res.status(401).json({
        error: "Refresh token inválido o expirado. Inicia sesión de nuevo.",
      });
    }

    // Revocar el refresh token usado (rotación)
    await revokeRefreshToken(refreshToken);

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      return res
        .status(403)
        .json({ error: "Cuenta desactivada. Contacta al administrador." });
    }

    const token = signToken(user);
    const newRefreshToken = await signRefreshToken(user.id);

    return res.json({
      token,
      refreshToken: newRefreshToken,
      user: formatUser(user),
    });
  } catch (err) {
    req.log.error({ err }, "refresh failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /auth/logout — Revocar refresh token ───────────────────────────────
router.post("/auth/logout", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Refresh token inválido",
    });
  }

  try {
    await revokeRefreshToken(parsed.data.refreshToken);
    return res.json({
      success: true,
      message: "Sesión cerrada correctamente.",
    });
  } catch (err) {
    req.log.error({ err }, "logout failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────
router.get("/auth/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado." });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as {
      sub: string;
    };
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(payload.sub)))
      .limit(1);

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ error: "Usuario no encontrado o inactivo." });
    }

    return res.json(formatUser(user));
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
});

// ── Token verification helper (used by other modules) ──────────────────────
export function verifyToken(token: string): {
  sub: string;
  email: string;
  role: string;
  district: string;
  districtId: number;
} | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

// ── Middleware: optional auth (attaches user if token valid) ─────────────────
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
      (req as any).jwtUser = payload;
    } catch {
      /* ignore */
    }
  }
  next();
}

// ── Middleware: require auth (verifies JWT + user exists in DB + is active) ─
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Autenticación requerida." });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as {
      sub: string;
    };

    // Verify user still exists and is active in the database
    const [user] = await db
      .select({
        id: usersTable.id,
        isActive: usersTable.isActive,
        role: usersTable.role,
        districtId: usersTable.districtId,
        suspendedUntil: usersTable.suspendedUntil,
      })
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(payload.sub)))
      .limit(1);

    if (!user) {
      return res
        .status(401)
        .json({ error: "Usuario no encontrado. Token inválido." });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ error: "Cuenta desactivada. Contacta al administrador." });
    }

    // Hacer cumplir la suspensión temporal (antes solo se guardaba, no se
    // aplicaba: un usuario suspendido seguía operando con normalidad).
    if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) {
      return res.status(403).json({
        error: "Cuenta suspendida temporalmente por reportes falsos.",
        suspendedUntil: user.suspendedUntil.toISOString(),
      });
    }

    // Attach full user info from DB (more reliable than JWT alone)
    (req as any).jwtUser = {
      ...payload,
      role: user.role,
      districtId: user.districtId,
    };
    return next();
  } catch (err) {
    if (
      err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({ error: "Token inválido o expirado." });
    }
    req.log.error({ err }, "requireAuth: unexpected error");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
}

// ── Middleware: nivel MUNICIPALIDAD o superior (gestionar y eliminar) ─────────
// super_admin, admin y municipal. Antes excluía a `municipal` (bug: las
// municipalidades no podían administrar su distrito) e incluía a `moderator`.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).jwtUser;
  if (!isMunicipalityLevel(user?.role)) {
    return res
      .status(403)
      .json({ error: "Acceso denegado. Se requiere rol de administrador." });
  }
  return next();
}

// ── Middleware: cualquier rol de backoffice (ver reportes, mensajear) ─────────
// Nivel moderador o superior (viewer/moderator/municipal/admin/super_admin).
export function requireBackoffice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = (req as any).jwtUser;
  if (!isModeratorLevel(user?.role)) {
    return res
      .status(403)
      .json({ error: "Acceso denegado. Se requiere rol de backoffice." });
  }
  return next();
}

// ── Middleware: nivel municipalidad (crear viewers, gestionar su distrito) ────
// Incluye `admin` (equivalente a `municipal`) y super_admin.
export function requireMunicipal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = (req as any).jwtUser;
  if (!isMunicipalityLevel(user?.role)) {
    return res
      .status(403)
      .json({ error: "Acceso denegado. Solo municipalidades." });
  }
  return next();
}

// ── Middleware: nivel MODERADOR o superior (ver + editar/moderar, sin eliminar) ─
// viewer/moderator y todos los superiores. Los moderadores editan/moderan
// contenido de su distrito pero NO pueden eliminar (eso es requireAdmin).
export function requireViewerOrAbove(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = (req as any).jwtUser;
  if (!isModeratorLevel(user?.role)) {
    return res.status(403).json({ error: "Acceso denegado." });
  }
  return next();
}

// ── Middleware: solo super_admin ─────────────────────────────────────────────
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = (req as any).jwtUser;
  if (!isSuperAdmin(user?.role)) {
    return res
      .status(403)
      .json({ error: "Acceso denegado. Solo super administradores." });
  }
  return next();
}

// ── M-04: Middleware: require same district (tenant isolation) ───────────────
// NOTA: Estos middlewares están disponibles para usarse como middleware de ruta,
// pero actualmente el proyecto implementa el aislamiento via helpers inline
// (getDistrictId / checkTenant en tenant.ts), que son más flexibles para
// combinar con optionalAuth. Si agregas rutas nuevas, importa esos helpers
// de "./tenant" en vez de usar estos middlewares directamente.
// Evita que un admin/moderador acceda a recursos de otro distrito.
// super_admin puede acceder a cualquier distrito.
export function requireSameDistrict(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = (req as any).jwtUser;
  if (!user) {
    return res.status(401).json({ error: "Autenticación requerida." });
  }

  // M-04: super_admin puede acceder a cualquier distrito
  if (user.role === "super_admin") {
    return next();
  }

  const resourceDistrictId = parseInt(
    req.params.districtId ||
      req.body.districtId ||
      (req.query.districtId as string),
  );

  if (user.districtId !== resourceDistrictId) {
    return res
      .status(403)
      .json({ error: "Acceso denegado. No perteneces a este distrito." });
  }

  return next();
}

// ── M-04: Middleware: filtra query por distrito del usuario ──────────────────
// Para GET endpoints: si el usuario está autenticado, usa su districtId.
// Si es anónimo, exige un districtId/slug en la query.
// super_admin puede pasar sin filtro (verá todos los distritos).
export function requireDistrictFilter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = (req as any).jwtUser;

  if (user?.role === "super_admin") {
    // super_admin puede pedir explícitamente un distrito o ver todo
    return next();
  }

  if (user) {
    // Usuario autenticado normal: forzar su distrito
    req.query.districtId = String(user.districtId);
  }
  // Si es anónimo, debe proveer districtId en la query
  // (se valida en cada ruta)

  return next();
}

// ── GET /config/login-warning — Advertencia legal sobre reportes falsos ──────
router.get("/config/login-warning", (_req: Request, res: Response) => {
  return res.json({
    warning: `⚠️ ADVERTENCIA LEGAL\n\nLa Municipalidad de San Ramón te recuerda que:\n\n• Reportar incidentes falsos es una falta grave.\n• Los datos personales (DNI, teléfono, dirección) se usarán exclusivamente para fines de verificación municipal.\n• El uso indebido del sistema puede resultar en la suspensión permanente de tu cuenta.\n• Los reportes falsos serán denunciados ante las autoridades competentes.\n\nAl registrarte, aceptas estos términos y condiciones.`,
    enabled: true,
  });
});

// ── POST /auth/claim-superadmin — Reclamar rol de super_admin por email ─────
// Permite que el dueño del SUPER_ADMIN_EMAIL (configurado en env)
// actualice su rol a super_admin. Seguro: requiere autenticación previa.
router.post(
  "/auth/claim-superadmin",
  requireAuth,
  async (req: Request, res: Response) => {
    const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
    if (!SUPER_ADMIN_EMAIL) {
      return res.status(503).json({
        error:
          "SUPER_ADMIN_EMAIL no configurado. Configura esta variable de entorno en el servidor.",
      });
    }
    const user = (req as any).jwtUser;

    try {
      // Verificar que el email del usuario autenticado coincida
      if (user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return res
          .status(403)
          .json({ error: "No tienes permiso para reclamar este rol." });
      }

      // Actualizar rol en la base de datos
      const [updated] = await db
        .update(usersTable)
        .set({ role: "super_admin" })
        .where(eq(usersTable.id, parseInt(user.sub)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }

      // Generar nuevo token con el rol actualizado
      const token = signToken(updated);
      const newRefreshToken = await signRefreshToken(updated.id);

      return res.json({
        success: true,
        message: "¡Ahora eres Super Administrador! Recarga la página.",
        token,
        refreshToken: newRefreshToken,
        user: formatUser(updated),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to claim superadmin");
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
);

export default router;
