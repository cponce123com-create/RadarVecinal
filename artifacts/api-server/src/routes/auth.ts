import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, districtsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";

const router: IRouter = Router();

const JWT_SECRET: string = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");
const JWT_EXPIRES = "30d";

// ── Zod schemas ─────────────────────────────────────────────────────────────
const registerSchema = z.object({
  name:     z.string().min(2, "Nombre muy corto").max(100),
  email:    z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  sector:   z.string().min(1, "Sector requerido").max(100),
  district: z.string().min(1).max(100).optional().default("San Ramón"),
  dni:      z.string().min(8, "DNI inválido").max(12).optional().nullable(),
});

const loginSchema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

// ── Helper: busca o falla al distrito por nombre ────────────────────────────
async function resolveDistrict(name: string): Promise<number> {
  const [d] = await db.select({ id: districtsTable.id })
    .from(districtsTable)
    .where(eq(districtsTable.name, name))
    .limit(1);
  if (!d) throw new Error(`Distrito "${name}" no encontrado en el catálogo.`);
  return d.id;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function signToken(user: { id: number; email: string; role: string; district: string; districtId: number }) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      district: user.district,
      districtId: user.districtId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id:           String(u.id),
    name:         u.name,
    email:        u.email,
    role:         u.role,
    sector:       u.sector,
    district:     u.district,
    districtId:   u.districtId,
    isActive:     u.isActive,
    reportsCount: u.reportsCount,
    createdAt:    u.createdAt.toISOString(),
  };
}

// ── POST /auth/register ──────────────────────────────────────────────────────
router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => i.message).join("; ");
    return res.status(400).json({ error: msg });
  }

  const { name, email, password, sector, district, dni } = parsed.data;

  try {
    const existing = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    }

    // M-05: Resolver districtId desde el catálogo
    let districtId: number;
    try {
      districtId = await resolveDistrict(district ?? "San Ramón");
    } catch {
      return res.status(400).json({ error: `Distrito "${district}" no válido. Selecciona un distrito del catálogo.` });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db.insert(usersTable).values({
      name:         name.trim(),
      email:        email.toLowerCase().trim(),
      passwordHash,
      sector,
      districtId,
      district:     district ?? "San Ramón",
      dni:          dni ?? null,
      role:         "user",
      isActive:     true,
      reportsCount: 0,
    }).returning();

    const token = signToken(user);
    return res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "register failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /auth/login ─────────────────────────────────────────────────────────
router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: "Esta cuenta no tiene contraseña configurada. Regístrate de nuevo." });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Cuenta desactivada. Contacta al administrador." });
    }

    const token = signToken(user);
    return res.json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "login failed");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /auth/google — Google OAuth ──────────────────────────────────────
router.post("/auth/google", async (req: Request, res: Response) => {
  const { credential } = z.object({ credential: z.string().min(1) }).parse(req.body);

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID no configurado." });
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: "Token de Google inválido." });
    }

    const googleEmail = payload.email.toLowerCase().trim();
    const googleName = payload.name || "Usuario Google";

    // Check if user exists
    const [existing] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, googleEmail))
      .limit(1);

    if (existing) {
      if (!existing.isActive) {
        return res.status(403).json({ error: "Cuenta desactivada." });
      }
      const token = signToken(existing);
      return res.json({ token, user: formatUser(existing) });
    }

    // M-05: Resolver districtId por defecto (San Ramón)
    let districtId: number;
    try {
      districtId = await resolveDistrict("San Ramón");
    } catch {
      return res.status(500).json({ error: "Error de configuración: distrito por defecto no encontrado." });
    }

    const [user] = await db.insert(usersTable).values({
      name: googleName,
      email: googleEmail,
      districtId,
      role: "user",
      sector: "Sin asignar",
      district: "San Ramón",
      isActive: true,
      reportsCount: 0,
    }).returning();

    const token = signToken(user);
    return res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    req.log.error({ err }, "Google auth failed");
    return res.status(401).json({ error: "Autenticación con Google fallida." });
  }
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────
router.get("/auth/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado." });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: string };
    const [user] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(payload.sub)))
      .limit(1);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Usuario no encontrado o inactivo." });
    }

    return res.json(formatUser(user));
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
});

// ── Token verification helper (used by other modules) ──────────────────────
export function verifyToken(token: string): { sub: string; email: string; role: string; district: string; districtId: number } | null {
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
    } catch { /* ignore */ }
  }
  next();
}

// ── Middleware: require auth (verifies JWT + user exists in DB + is active) ─
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Autenticación requerida." });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: string };

    // Verify user still exists and is active in the database
    const [user] = await db.select({
      id: usersTable.id,
      isActive: usersTable.isActive,
      role: usersTable.role,
      districtId: usersTable.districtId,
    })
      .from(usersTable)
      .where(eq(usersTable.id, parseInt(payload.sub)))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado. Token inválido." });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Cuenta desactivada. Contacta al administrador." });
    }

    // Attach full user info from DB (more reliable than JWT alone)
    (req as any).jwtUser = { ...payload, role: user.role, districtId: user.districtId };
    return next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Token inválido o expirado." });
    }
    req.log.error({ err }, "requireAuth: unexpected error");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
}

// ── Middleware: require admin/moderator/super_admin role ──────────────────────
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).jwtUser;
  if (!user || !["admin", "moderator", "super_admin"].includes(user.role)) {
    return res.status(403).json({ error: "Acceso denegado. Se requiere rol de administrador." });
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
export function requireSameDistrict(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).jwtUser;
  if (!user) {
    return res.status(401).json({ error: "Autenticación requerida." });
  }

  // M-04: super_admin puede acceder a cualquier distrito
  if (user.role === "super_admin") {
    return next();
  }

  const resourceDistrictId = parseInt(req.params.districtId || req.body.districtId || req.query.districtId as string);

  if (user.districtId !== resourceDistrictId) {
    return res.status(403).json({ error: "Acceso denegado. No perteneces a este distrito." });
  }

  return next();
}

// ── M-04: Middleware: filtra query por distrito del usuario ──────────────────
// Para GET endpoints: si el usuario está autenticado, usa su districtId.
// Si es anónimo, exige un districtId/slug en la query.
// super_admin puede pasar sin filtro (verá todos los distritos).
export function requireDistrictFilter(req: Request, res: Response, next: NextFunction) {
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

export default router;
