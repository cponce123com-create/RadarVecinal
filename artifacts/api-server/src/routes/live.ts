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
import { liveProvidersTable, liveTracksTable, districtsTable } from "@workspace/db/schema";
import { eq, and, gt, gte, lt, lte, sql, asc, desc } from "drizzle-orm";
import { optionalAuth, requireAuth } from "./auth";
import { getDistrictId } from "./tenant";

const router: IRouter = Router();

// Una transmisión se considera "viva" si recibió un ping en los últimos 3 min.
// Pasado ese tiempo se da por terminada (el transmisor cerró la app o perdió
// señal). Los vecinos dejan de verla en el mapa.
const FRESH_MS = 3 * 60 * 1000;

// Solo se guarda un punto de ruta si el transmisor avanzó al menos esta
// distancia desde el último punto guardado (submuestreo: ruta fiel sin inflar
// la base de datos).
const TRACK_MIN_METERS = 12;
// Tope de seguridad de puntos por transmisión (una ruta larga no crece sin fin).
const TRACK_MAX_POINTS = 5000;

// Distancia aproximada en metros entre dos coordenadas (haversine).
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

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

    // Primer punto de la ruta (inicio de la transmisión).
    await db
      .insert(liveTracksTable)
      .values({
        providerId: row.id,
        districtId,
        latitude: data.latitude,
        longitude: data.longitude,
      })
      .catch(() => {});

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
      .select({
        broadcastKey: liveProvidersTable.broadcastKey,
        districtId: liveProvidersTable.districtId,
        latitude: liveProvidersTable.latitude,
        longitude: liveProvidersTable.longitude,
      })
      .from(liveProvidersTable)
      .where(eq(liveProvidersTable.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Transmisión no encontrada." });
    if (row.broadcastKey !== parsed.data.broadcastKey) {
      return res.status(403).json({ error: "Clave de transmisión inválida." });
    }

    const { latitude, longitude } = parsed.data;

    await db
      .update(liveProvidersTable)
      .set({ latitude, longitude, isActive: true, updatedAt: new Date() })
      .where(eq(liveProvidersTable.id, id));

    // Guardar punto de ruta solo si avanzó ≥ TRACK_MIN_METERS (submuestreo),
    // respetando un tope de puntos por transmisión. Best-effort: si falla, el
    // ping igual se considera exitoso.
    const moved = distanceMeters(row.latitude, row.longitude, latitude, longitude);
    if (moved >= TRACK_MIN_METERS) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(liveTracksTable)
        .where(eq(liveTracksTable.providerId, id));
      if (Number(count) < TRACK_MAX_POINTS) {
        await db
          .insert(liveTracksTable)
          .values({ providerId: id, districtId: row.districtId, latitude, longitude })
          .catch(() => {});
      }
    }

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

// ── GET /live/:id/track — puntos de la ruta de una transmisión ──────────────
// Público: sirve tanto para la línea verde en vivo como para ver una ruta del
// historial. Devuelve los puntos en orden cronológico.
router.get("/live/:id/track", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Id inválido." });
  }
  try {
    const points = await db
      .select({
        latitude: liveTracksTable.latitude,
        longitude: liveTracksTable.longitude,
        recordedAt: liveTracksTable.recordedAt,
      })
      .from(liveTracksTable)
      .where(eq(liveTracksTable.providerId, id))
      .orderBy(asc(liveTracksTable.recordedAt))
      .limit(TRACK_MAX_POINTS);

    return res.json({
      points: points.map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
        at: p.recordedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get track");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /live/history — transmisiones (rutas) de un distrito por rango ───────
// El cliente envía from/to (ISO) calculando el día local; así el servidor no
// asume zona horaria. Devuelve un resumen por transmisión, con nº de puntos.
router.get("/live/history", optionalAuth, async (req, res) => {
  const districtId = getDistrictId(req);
  if (!districtId) {
    return res.status(400).json({ error: "Se requiere distrito (districtId)." });
  }
  const from = new Date(String(req.query.from ?? ""));
  const to = new Date(String(req.query.to ?? ""));
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return res.status(400).json({ error: "Rango de fechas inválido (from/to)." });
  }
  const type = req.query.type ? String(req.query.type) : null;

  try {
    const conditions: any[] = [
      eq(liveProvidersTable.districtId, districtId),
      gte(liveProvidersTable.startedAt, from),
      lt(liveProvidersTable.startedAt, to),
    ];
    if (type && (PROVIDER_TYPES as readonly string[]).includes(type)) {
      conditions.push(eq(liveProvidersTable.type, type as any));
    }

    const rows = await db
      .select({
        id: liveProvidersTable.id,
        type: liveProvidersTable.type,
        label: liveProvidersTable.label,
        displayName: liveProvidersTable.displayName,
        isActive: liveProvidersTable.isActive,
        startedAt: liveProvidersTable.startedAt,
        updatedAt: liveProvidersTable.updatedAt,
        points: sql<number>`count(${liveTracksTable.id})`,
      })
      .from(liveProvidersTable)
      .leftJoin(liveTracksTable, eq(liveTracksTable.providerId, liveProvidersTable.id))
      .where(and(...conditions))
      .groupBy(liveProvidersTable.id)
      .orderBy(desc(liveProvidersTable.startedAt))
      .limit(200);

    return res.json({
      routes: rows.map((r) => ({
        id: String(r.id),
        type: r.type,
        label: r.label,
        displayName: r.displayName,
        isActive: r.isActive,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.updatedAt.toISOString(),
        points: Number(r.points),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get live history");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /live/passed — "¿pasó el recolector por mi casa?" ───────────────────
// Dado un punto (lat/lng), una fecha (from/to) y un tipo (por defecto
// recolector), devuelve el punto de ruta MÁS CERCANO a esa casa: a cuántos
// metros pasó y a qué hora. Acota con una caja delimitadora (~2 km) y calcula
// la distancia exacta (haversine) sobre los candidatos.
const PASSED_BOX_DEG = 0.02; // ~2.2 km alrededor de la casa
const PASSED_NEAR_METERS = 60; // umbral para considerar "sí pasó cerca"

router.get("/live/passed", optionalAuth, async (req, res) => {
  const districtId = getDistrictId(req);
  if (!districtId) {
    return res.status(400).json({ error: "Se requiere distrito (districtId)." });
  }
  const lat = parseFloat(String(req.query.lat));
  const lng = parseFloat(String(req.query.lng));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat y lng deben ser números válidos." });
  }
  const from = new Date(String(req.query.from ?? ""));
  const to = new Date(String(req.query.to ?? ""));
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return res.status(400).json({ error: "Rango de fechas inválido (from/to)." });
  }
  const type = req.query.type ? String(req.query.type) : "recolector";

  try {
    const conditions: any[] = [
      eq(liveTracksTable.districtId, districtId),
      gte(liveTracksTable.recordedAt, from),
      lt(liveTracksTable.recordedAt, to),
      gte(liveTracksTable.latitude, lat - PASSED_BOX_DEG),
      lte(liveTracksTable.latitude, lat + PASSED_BOX_DEG),
      gte(liveTracksTable.longitude, lng - PASSED_BOX_DEG),
      lte(liveTracksTable.longitude, lng + PASSED_BOX_DEG),
    ];
    if ((PROVIDER_TYPES as readonly string[]).includes(type)) {
      conditions.push(eq(liveProvidersTable.type, type as any));
    }

    const rows = await db
      .select({
        latitude: liveTracksTable.latitude,
        longitude: liveTracksTable.longitude,
        recordedAt: liveTracksTable.recordedAt,
        providerId: liveTracksTable.providerId,
      })
      .from(liveTracksTable)
      .innerJoin(liveProvidersTable, eq(liveTracksTable.providerId, liveProvidersTable.id))
      .where(and(...conditions))
      .limit(20000);

    let best: { distanceMeters: number; at: string; providerId: string } | null = null;
    for (const p of rows) {
      const d = distanceMeters(lat, lng, p.latitude, p.longitude);
      if (!best || d < best.distanceMeters) {
        best = {
          distanceMeters: Math.round(d),
          at: p.recordedAt.toISOString(),
          providerId: String(p.providerId),
        };
      }
    }

    return res.json({
      nearest: best,
      passedNear: !!best && best.distanceMeters <= PASSED_NEAR_METERS,
      thresholdMeters: PASSED_NEAR_METERS,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compute passed-by");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
