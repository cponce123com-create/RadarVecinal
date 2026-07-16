/**
 * live.ts — Servicios en vivo (rastreo GPS en tiempo real).
 *
 * Un transmisor (camión recolector, panadero, lechero, tamalero, gasero,
 * aguatero o vendedor de comida dominical) comparte su ubicación en vivo y los
 * vecinos lo ven moverse por el mapa del distrito.
 *
 * Flujo:
 *   POST /live/start        → crea la transmisión, devuelve { id, broadcastKey }
 *   POST /live/:id/ping      → actualiza lat/lng (requiere broadcastKey)
 *   POST /live/:id/stop      → finaliza (requiere broadcastKey)
 *   GET  /live?districtId=   → lista transmisiones activas y frescas del distrito
 *
 * La broadcastKey autoriza ping/stop sin sesión iniciada (muchos ambulantes no
 * tienen cuenta). El transmisor la guarda en su dispositivo mientras transmite.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { liveProvidersTable, districtsTable } from "@workspace/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { optionalAuth, requireAuth } from "./auth";
import { getDistrictId } from "./tenant";

const router: IRouter = Router();

// Una transmisión se considera "viva" si recibió un ping en los últimos 3 min.
// Pasado ese tiempo se da por terminada (el transmisor cerró la app o perdió
// señal). Los vecinos dejan de verla en el mapa.
const FRESH_MS = 3 * 60 * 1000;

const PROVIDER_TYPES = [
  "recolector",
  "panadero",
  "lechero",
  "tamalero",
  "gasero",
  "agua",
  "vendedor",
  "otro",
] as const;

const startSchema = z.object({
  type: z.enum(PROVIDER_TYPES),
  label: z.string().max(80).optional().default(""),
  displayName: z.string().max(80).optional().default(""),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  districtId: z.number().int().optional(),
});

const pingSchema = z.object({
  broadcastKey: z.string().min(8),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const stopSchema = z.object({
  broadcastKey: z.string().min(8),
});

// ── Expiración perezosa de transmisiones sin ping reciente ──────────────────
async function expireStaleProviders() {
  const cutoff = new Date(Date.now() - FRESH_MS);
  await db
    .update(liveProvidersTable)
    .set({ isActive: false })
    .where(
      and(
        eq(liveProvidersTable.isActive, true),
        sql`${liveProvidersTable.updatedAt} < ${cutoff}`,
      ),
    );
}

// ── GET /live/all — TODAS las transmisiones activas (solo super_admin) ──────
// Herramienta de diagnóstico para pruebas: ve las transmisiones de todos los
// distritos con su distrito, para confirmar dónde quedó una transmisión.
router.get("/live/all", requireAuth, async (req, res) => {
  const user = (req as any).jwtUser;
  if (user?.role !== "super_admin") {
    return res.status(403).json({ error: "Solo super_admin." });
  }
  try {
    await expireStaleProviders();
    const fresh = new Date(Date.now() - FRESH_MS);
    const rows = await db
      .select({
        id: liveProvidersTable.id,
        districtId: liveProvidersTable.districtId,
        districtName: districtsTable.name,
        type: liveProvidersTable.type,
        label: liveProvidersTable.label,
        displayName: liveProvidersTable.displayName,
        latitude: liveProvidersTable.latitude,
        longitude: liveProvidersTable.longitude,
        startedAt: liveProvidersTable.startedAt,
        updatedAt: liveProvidersTable.updatedAt,
      })
      .from(liveProvidersTable)
      .leftJoin(districtsTable, eq(liveProvidersTable.districtId, districtsTable.id))
      .where(
        and(
          eq(liveProvidersTable.isActive, true),
          gt(liveProvidersTable.updatedAt, fresh),
        ),
      )
      .orderBy(liveProvidersTable.updatedAt)
      .limit(200);

    return res.json({
      providers: rows.map((r) => ({
        ...r,
        id: String(r.id),
        startedAt: r.startedAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list all live providers");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /live — transmisiones activas y frescas del distrito ────────────────
router.get("/live", optionalAuth, async (req, res) => {
  try {
    await expireStaleProviders();

    const districtId = getDistrictId(req);
    if (!districtId) {
      return res.status(400).json({ error: "Se requiere distrito (districtId)." });
    }

    const fresh = new Date(Date.now() - FRESH_MS);
    const rows = await db
      .select({
        id: liveProvidersTable.id,
        type: liveProvidersTable.type,
        label: liveProvidersTable.label,
        displayName: liveProvidersTable.displayName,
        latitude: liveProvidersTable.latitude,
        longitude: liveProvidersTable.longitude,
        startedAt: liveProvidersTable.startedAt,
        updatedAt: liveProvidersTable.updatedAt,
      })
      .from(liveProvidersTable)
      .where(
        and(
          eq(liveProvidersTable.districtId, districtId),
          eq(liveProvidersTable.isActive, true),
          gt(liveProvidersTable.updatedAt, fresh),
        ),
      )
      .orderBy(liveProvidersTable.type)
      .limit(100);

    return res.json({
      providers: rows.map((r) => ({
        ...r,
        id: String(r.id),
        startedAt: r.startedAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list live providers");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /live/start — iniciar transmisión ──────────────────────────────────
router.post("/live/start", optionalAuth, async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }
  const data = parsed.data;
  const user = (req as any).jwtUser;

  // Distrito: usuarios de backoffice quedan atados al suyo; el resto lo envía.
  let districtId: number;
  if (user?.districtId && user.role !== "super_admin") {
    districtId = Number(user.districtId);
  } else if (data.districtId) {
    districtId = Number(data.districtId);
  } else {
    return res.status(400).json({ error: "Se requiere distrito (districtId)." });
  }

  try {
    // Un mismo usuario autenticado no acumula transmisiones activas: si reinicia,
    // se cierran las anteriores (evita duplicados fantasma en el mapa).
    if (user?.sub) {
      await db
        .update(liveProvidersTable)
        .set({ isActive: false })
        .where(
          and(
            eq(liveProvidersTable.userId, Number(user.sub)),
            eq(liveProvidersTable.isActive, true),
          ),
        );
    }

    const broadcastKey = crypto.randomBytes(16).toString("hex");
    const [row] = await db
      .insert(liveProvidersTable)
      .values({
        districtId,
        userId: user?.sub ? Number(user.sub) : null,
        type: data.type,
        label: data.label ?? "",
        displayName: data.displayName ?? "",
        latitude: data.latitude,
        longitude: data.longitude,
        broadcastKey,
      })
      .returning();

    return res.status(201).json({ id: String(row.id), broadcastKey });
  } catch (err) {
    req.log.error({ err }, "Failed to start live provider");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /live/:id/ping — actualizar ubicación ──────────────────────────────
router.post("/live/:id/ping", async (req, res) => {
  const parsed = pingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Id inválido." });
  }

  try {
    const [row] = await db
      .select({ broadcastKey: liveProvidersTable.broadcastKey })
      .from(liveProvidersTable)
      .where(eq(liveProvidersTable.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Transmisión no encontrada." });
    if (row.broadcastKey !== parsed.data.broadcastKey) {
      return res.status(403).json({ error: "Clave de transmisión inválida." });
    }

    await db
      .update(liveProvidersTable)
      .set({
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(liveProvidersTable.id, id));

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to ping live provider");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /live/:id/stop — finalizar transmisión ─────────────────────────────
router.post("/live/:id/stop", async (req, res) => {
  const parsed = stopSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Se requiere broadcastKey." });
  }
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Id inválido." });
  }

  try {
    const [row] = await db
      .select({ broadcastKey: liveProvidersTable.broadcastKey })
      .from(liveProvidersTable)
      .where(eq(liveProvidersTable.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Transmisión no encontrada." });
    if (row.broadcastKey !== parsed.data.broadcastKey) {
      return res.status(403).json({ error: "Clave de transmisión inválida." });
    }

    await db
      .update(liveProvidersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(liveProvidersTable.id, id));

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to stop live provider");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
