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
import {
  liveProvidersTable,
  liveTracksTable,
  liveDevicesTable,
  liveVoiceClipsTable,
  proximitySubscriptionsTable,
  districtsTable,
} from "@workspace/db/schema";
import { eq, and, gt, gte, lt, lte, sql, asc, desc } from "drizzle-orm";
import { optionalAuth, requireAuth } from "./auth";
import { getDistrictId, checkTenant } from "./tenant";
import { isMunicipalityLevel } from "../lib/roles";
import { sendProximityPush } from "../lib/fcm";
import { logger } from "../lib/logger";

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
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// No repetir el aviso push del mismo servicio al mismo vecino en 8 min.
const PUSH_COOLDOWN_MS = 8 * 60 * 1000;

const PUSH_LABEL: Record<string, { emoji: string; label: string }> = {
  recolector: { emoji: "🚛", label: "El camión recolector" },
  panadero: { emoji: "🍞", label: "El panadero" },
  lechero: { emoji: "🥛", label: "El lechero" },
  tamalero: { emoji: "🫔", label: "La tamalera" },
  gasero: { emoji: "🔥", label: "El gasero" },
  agua: { emoji: "💧", label: "El repartidor de agua" },
  vendedor: { emoji: "🍲", label: "El vendedor" },
  otro: { emoji: "📍", label: "El servicio" },
};

/**
 * notifyProximity — Al moverse un proveedor, avisa por push a los vecinos cuya
 * casa quedó dentro del radio (con la app cerrada). Best-effort, no bloquea el
 * ping. Respeta el radio, los tipos elegidos y un enfriamiento por (vecino,tipo).
 */
async function notifyProximity(p: {
  districtId: number;
  type: string;
  latitude: number;
  longitude: number;
}): Promise<void> {
  try {
    const subs = await db
      .select()
      .from(proximitySubscriptionsTable)
      .where(
        and(
          eq(proximitySubscriptionsTable.districtId, p.districtId),
          eq(proximitySubscriptionsTable.enabled, true),
        ),
      )
      .limit(2000);
    if (subs.length === 0) return;

    // Frase personalizada (voz grabada) si el distrito la definió.
    const [clip] = await db
      .select({
        phrase: liveVoiceClipsTable.phrase,
        enabled: liveVoiceClipsTable.enabled,
      })
      .from(liveVoiceClipsTable)
      .where(
        and(
          eq(liveVoiceClipsTable.districtId, p.districtId),
          eq(liveVoiceClipsTable.type, p.type as any),
        ),
      )
      .limit(1);

    const meta = PUSH_LABEL[p.type] ?? PUSH_LABEL.otro;
    const now = Date.now();

    for (const s of subs) {
      const types = Array.isArray(s.types) ? (s.types as string[]) : [];
      if (!types.includes(p.type)) continue;

      const d = distanceMeters(s.homeLat, s.homeLng, p.latitude, p.longitude);
      if (d > s.radiusM) continue;

      const cooldowns = (
        s.cooldowns && typeof s.cooldowns === "object" ? s.cooldowns : {}
      ) as Record<string, number>;
      if (cooldowns[p.type] && now - cooldowns[p.type] < PUSH_COOLDOWN_MS)
        continue;

      const body =
        clip?.enabled && clip.phrase
          ? clip.phrase
          : `${meta.label} está cerca de tu casa.`;

      const sent = await sendProximityPush({
        token: s.pushToken,
        title: `${meta.emoji} Servicio cerca`,
        body,
        districtId: p.districtId,
        providerType: p.type,
      });

      if (sent) {
        await db
          .update(proximitySubscriptionsTable)
          .set({ cooldowns: { ...cooldowns, [p.type]: now } })
          .where(eq(proximitySubscriptionsTable.id, s.id))
          .catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, "[live] notifyProximity failed");
  }
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
        verified: liveProvidersTable.verified,
        startedAt: liveProvidersTable.startedAt,
        updatedAt: liveProvidersTable.updatedAt,
      })
      .from(liveProvidersTable)
      .leftJoin(
        districtsTable,
        eq(liveProvidersTable.districtId, districtsTable.id),
      )
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
      return res
        .status(400)
        .json({ error: "Se requiere distrito (districtId)." });
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
        verified: liveProvidersTable.verified,
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
    return res
      .status(400)
      .json({ error: "Se requiere distrito (districtId)." });
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
  const id = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Id inválido." });
  }

  try {
    const [row] = await db
      .select({
        broadcastKey: liveProvidersTable.broadcastKey,
        districtId: liveProvidersTable.districtId,
        type: liveProvidersTable.type,
        latitude: liveProvidersTable.latitude,
        longitude: liveProvidersTable.longitude,
      })
      .from(liveProvidersTable)
      .where(eq(liveProvidersTable.id, id))
      .limit(1);

    if (!row)
      return res.status(404).json({ error: "Transmisión no encontrada." });
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
    const moved = distanceMeters(
      row.latitude,
      row.longitude,
      latitude,
      longitude,
    );
    if (moved >= TRACK_MIN_METERS) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(liveTracksTable)
        .where(eq(liveTracksTable.providerId, id));
      if (Number(count) < TRACK_MAX_POINTS) {
        await db
          .insert(liveTracksTable)
          .values({
            providerId: id,
            districtId: row.districtId,
            latitude,
            longitude,
          })
          .catch(() => {});
      }
    }

    // Aviso push a vecinos cercanos (best-effort, no bloquea el ping).
    void notifyProximity({
      districtId: row.districtId,
      type: row.type,
      latitude,
      longitude,
    });

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
  const id = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Id inválido." });
  }

  try {
    const [row] = await db
      .select({ broadcastKey: liveProvidersTable.broadcastKey })
      .from(liveProvidersTable)
      .where(eq(liveProvidersTable.id, id))
      .limit(1);

    if (!row)
      return res.status(404).json({ error: "Transmisión no encontrada." });
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
  const id = parseInt(req.params.id as string, 10);
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
    return res
      .status(400)
      .json({ error: "Se requiere distrito (districtId)." });
  }
  const from = new Date(String(req.query.from ?? ""));
  const to = new Date(String(req.query.to ?? ""));
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return res
      .status(400)
      .json({ error: "Rango de fechas inválido (from/to)." });
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
      .leftJoin(
        liveTracksTable,
        eq(liveTracksTable.providerId, liveProvidersTable.id),
      )
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
    return res
      .status(400)
      .json({ error: "Se requiere distrito (districtId)." });
  }
  const lat = parseFloat(String(req.query.lat));
  const lng = parseFloat(String(req.query.lng));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res
      .status(400)
      .json({ error: "lat y lng deben ser números válidos." });
  }
  const from = new Date(String(req.query.from ?? ""));
  const to = new Date(String(req.query.to ?? ""));
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return res
      .status(400)
      .json({ error: "Rango de fechas inválido (from/to)." });
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
      .innerJoin(
        liveProvidersTable,
        eq(liveTracksTable.providerId, liveProvidersTable.id),
      )
      .where(and(...conditions))
      .limit(20000);

    let best: {
      distanceMeters: number;
      at: string;
      providerId: string;
    } | null = null;
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

// ════════════════════════════════════════════════════════════════════════════
// Dispositivos oficiales (registro desde admin + ingesta por deviceKey)
// ════════════════════════════════════════════════════════════════════════════

// Nivel municipalidad+ y del mismo distrito (super_admin puede en cualquiera).
function resolveAdminDistrict(req: any, res: any): number | null {
  const user = req.jwtUser;
  if (!user || !isMunicipalityLevel(user.role)) {
    res
      .status(403)
      .json({ error: "Solo la municipalidad puede gestionar dispositivos." });
    return null;
  }
  let districtId: number;
  if (user.role === "super_admin") {
    districtId = Number(
      req.query.districtId ?? req.body?.districtId ?? user.districtId,
    );
    if (!districtId) {
      res.status(400).json({ error: "Se requiere districtId." });
      return null;
    }
  } else {
    districtId = Number(user.districtId);
  }
  return districtId;
}

// ── GET /live/devices — listar dispositivos del distrito ────────────────────
router.get("/live/devices", requireAuth, async (req, res) => {
  const districtId = resolveAdminDistrict(req, res);
  if (districtId == null) return;
  try {
    const fresh = new Date(Date.now() - FRESH_MS);
    const devices = await db
      .select({
        id: liveDevicesTable.id,
        type: liveDevicesTable.type,
        label: liveDevicesTable.label,
        deviceKey: liveDevicesTable.deviceKey,
        enabled: liveDevicesTable.enabled,
        createdAt: liveDevicesTable.createdAt,
        liveNow: sql<boolean>`EXISTS (
          SELECT 1 FROM ${liveProvidersTable}
          WHERE ${liveProvidersTable.deviceId} = ${liveDevicesTable.id}
            AND ${liveProvidersTable.isActive} = true
            AND ${liveProvidersTable.updatedAt} > ${fresh}
        )`,
      })
      .from(liveDevicesTable)
      .where(eq(liveDevicesTable.districtId, districtId))
      .orderBy(desc(liveDevicesTable.createdAt));
    return res.json({
      devices: devices.map((d) => ({
        ...d,
        id: String(d.id),
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list devices");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /live/devices — crear dispositivo (devuelve deviceKey) ─────────────
const createDeviceSchema = z.object({
  label: z.string().min(2).max(80),
  type: z.enum(PROVIDER_TYPES).optional().default("recolector"),
  districtId: z.number().int().optional(),
});
router.post("/live/devices", requireAuth, async (req, res) => {
  const districtId = resolveAdminDistrict(req, res);
  if (districtId == null) return;
  const parsed = createDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }
  try {
    const deviceKey = crypto.randomBytes(12).toString("hex");
    const [device] = await db
      .insert(liveDevicesTable)
      .values({
        districtId,
        type: parsed.data.type,
        label: parsed.data.label,
        deviceKey,
        createdById: (req as any).jwtUser?.sub
          ? Number((req as any).jwtUser.sub)
          : null,
      })
      .returning();
    return res.status(201).json({
      ...device,
      id: String(device.id),
      createdAt: device.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create device");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── PATCH /live/devices/:id — renombrar / habilitar-deshabilitar ────────────
router.patch("/live/devices/:id", requireAuth, async (req, res) => {
  const user = (req as any).jwtUser;
  if (!user || !isMunicipalityLevel(user.role)) {
    return res.status(403).json({ error: "Solo la municipalidad." });
  }
  const id = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Id inválido." });
  try {
    const [device] = await db
      .select()
      .from(liveDevicesTable)
      .where(eq(liveDevicesTable.id, id))
      .limit(1);
    if (!device)
      return res.status(404).json({ error: "Dispositivo no encontrado." });
    if (!checkTenant(req, device.districtId)) {
      return res
        .status(403)
        .json({ error: "No puedes gestionar dispositivos de otro distrito." });
    }
    const patch: Record<string, unknown> = {};
    if (
      typeof req.body?.label === "string" &&
      req.body.label.trim().length >= 2
    )
      patch.label = req.body.label.trim();
    if (typeof req.body?.enabled === "boolean")
      patch.enabled = req.body.enabled;
    if (Object.keys(patch).length === 0)
      return res.status(400).json({ error: "Nada que actualizar." });

    const [updated] = await db
      .update(liveDevicesTable)
      .set(patch)
      .where(eq(liveDevicesTable.id, id))
      .returning();

    // Al deshabilitar, cortar cualquier transmisión activa del dispositivo.
    if (patch.enabled === false) {
      await db
        .update(liveProvidersTable)
        .set({ isActive: false })
        .where(
          and(
            eq(liveProvidersTable.deviceId, id),
            eq(liveProvidersTable.isActive, true),
          ),
        );
    }
    return res.json({
      ...updated,
      id: String(updated.id),
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update device");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── DELETE /live/devices/:id — eliminar dispositivo ─────────────────────────
router.delete("/live/devices/:id", requireAuth, async (req, res) => {
  const user = (req as any).jwtUser;
  if (!user || !isMunicipalityLevel(user.role)) {
    return res.status(403).json({ error: "Solo la municipalidad." });
  }
  const id = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Id inválido." });
  try {
    const [device] = await db
      .select()
      .from(liveDevicesTable)
      .where(eq(liveDevicesTable.id, id))
      .limit(1);
    if (!device)
      return res.status(404).json({ error: "Dispositivo no encontrado." });
    if (!checkTenant(req, device.districtId)) {
      return res
        .status(403)
        .json({ error: "No puedes gestionar dispositivos de otro distrito." });
    }
    // Desenlazar transmisiones históricas (mantienen su ruta) antes de borrar.
    await db
      .update(liveProvidersTable)
      .set({ deviceId: null, isActive: false })
      .where(eq(liveProvidersTable.deviceId, id));
    await db.delete(liveDevicesTable).where(eq(liveDevicesTable.id, id));
    return res.json({ success: true, id: String(id) });
  } catch (err) {
    req.log.error({ err }, "Failed to delete device");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /live/device/:deviceKey — info pública del dispositivo (modo app) ────
router.get("/live/device/:deviceKey", async (req, res) => {
  try {
    const [device] = await db
      .select({
        id: liveDevicesTable.id,
        type: liveDevicesTable.type,
        label: liveDevicesTable.label,
        districtId: liveDevicesTable.districtId,
        districtName: districtsTable.name,
        enabled: liveDevicesTable.enabled,
      })
      .from(liveDevicesTable)
      .leftJoin(
        districtsTable,
        eq(liveDevicesTable.districtId, districtsTable.id),
      )
      .where(eq(liveDevicesTable.deviceKey, req.params.deviceKey))
      .limit(1);
    if (!device)
      return res.status(404).json({ error: "Dispositivo no encontrado." });
    if (!device.enabled)
      return res.status(403).json({ error: "Dispositivo deshabilitado." });
    return res.json({ ...device, id: String(device.id) });
  } catch (err) {
    req.log.error({ err }, "Failed to get device");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /live/device/:deviceKey/ping — ingesta de ubicación (sin login) ────
// Sirve para el celular montado (modo dispositivo del app) y para un GPS
// vehicular que reporte por HTTP. Busca o crea UNA transmisión activa por
// dispositivo y le agrega el punto de ruta.
const devicePingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
router.post("/live/device/:deviceKey/ping", async (req, res) => {
  const parsed = devicePingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }
  const { latitude, longitude } = parsed.data;
  try {
    const [device] = await db
      .select()
      .from(liveDevicesTable)
      .where(eq(liveDevicesTable.deviceKey, req.params.deviceKey))
      .limit(1);
    if (!device)
      return res.status(404).json({ error: "Dispositivo no encontrado." });
    if (!device.enabled)
      return res.status(403).json({ error: "Dispositivo deshabilitado." });

    const fresh = new Date(Date.now() - FRESH_MS);
    const [active] = await db
      .select({
        id: liveProvidersTable.id,
        latitude: liveProvidersTable.latitude,
        longitude: liveProvidersTable.longitude,
      })
      .from(liveProvidersTable)
      .where(
        and(
          eq(liveProvidersTable.deviceId, device.id),
          eq(liveProvidersTable.isActive, true),
          gt(liveProvidersTable.updatedAt, fresh),
        ),
      )
      .orderBy(desc(liveProvidersTable.updatedAt))
      .limit(1);

    let providerId: number;
    if (active) {
      providerId = active.id;
      await db
        .update(liveProvidersTable)
        .set({ latitude, longitude, isActive: true, updatedAt: new Date() })
        .where(eq(liveProvidersTable.id, providerId));
      const moved = distanceMeters(
        active.latitude,
        active.longitude,
        latitude,
        longitude,
      );
      if (moved >= TRACK_MIN_METERS) {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(liveTracksTable)
          .where(eq(liveTracksTable.providerId, providerId));
        if (Number(count) < TRACK_MAX_POINTS) {
          await db
            .insert(liveTracksTable)
            .values({
              providerId,
              districtId: device.districtId,
              latitude,
              longitude,
            })
            .catch(() => {});
        }
      }
    } else {
      const [created] = await db
        .insert(liveProvidersTable)
        .values({
          districtId: device.districtId,
          type: device.type,
          label: device.label,
          displayName: "",
          latitude,
          longitude,
          broadcastKey: crypto.randomBytes(16).toString("hex"),
          deviceId: device.id,
          verified: true,
        })
        .returning();
      providerId = created.id;
      await db
        .insert(liveTracksTable)
        .values({
          providerId,
          districtId: device.districtId,
          latitude,
          longitude,
        })
        .catch(() => {});
    }

    // Aviso push a vecinos cercanos (best-effort).
    void notifyProximity({
      districtId: device.districtId,
      type: device.type,
      latitude,
      longitude,
    });

    return res.json({ ok: true, providerId: String(providerId) });
  } catch (err) {
    req.log.error({ err }, "Failed device ping");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /live/device/:deviceKey/stop — finalizar transmisión del dispositivo ─
router.post("/live/device/:deviceKey/stop", async (req, res) => {
  try {
    const [device] = await db
      .select({ id: liveDevicesTable.id })
      .from(liveDevicesTable)
      .where(eq(liveDevicesTable.deviceKey, req.params.deviceKey))
      .limit(1);
    if (!device)
      return res.status(404).json({ error: "Dispositivo no encontrado." });
    await db
      .update(liveProvidersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(liveProvidersTable.deviceId, device.id),
          eq(liveProvidersTable.isActive, true),
        ),
      );
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed device stop");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Suscripción de proximidad (aviso push con la app cerrada)
// ════════════════════════════════════════════════════════════════════════════

const proxSubSchema = z.object({
  pushToken: z.string().min(10).max(500),
  districtId: z.number().int(),
  homeLat: z.number().min(-90).max(90),
  homeLng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(50).max(2000).optional().default(300),
  types: z.array(z.enum(PROVIDER_TYPES)).optional().default(["recolector"]),
  enabled: z.boolean().optional().default(true),
});

// ── PUT /live/proximity-subscription — registrar/actualizar (por token) ─────
router.put("/live/proximity-subscription", optionalAuth, async (req, res) => {
  const parsed = proxSubSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }
  const d = parsed.data;
  try {
    const [existing] = await db
      .select({ id: proximitySubscriptionsTable.id })
      .from(proximitySubscriptionsTable)
      .where(eq(proximitySubscriptionsTable.pushToken, d.pushToken))
      .limit(1);

    if (existing) {
      await db
        .update(proximitySubscriptionsTable)
        .set({
          districtId: d.districtId,
          homeLat: d.homeLat,
          homeLng: d.homeLng,
          radiusM: d.radiusM,
          types: d.types,
          enabled: d.enabled,
          updatedAt: new Date(),
        })
        .where(eq(proximitySubscriptionsTable.id, existing.id));
    } else {
      await db.insert(proximitySubscriptionsTable).values({
        districtId: d.districtId,
        pushToken: d.pushToken,
        homeLat: d.homeLat,
        homeLng: d.homeLng,
        radiusM: d.radiusM,
        types: d.types,
        enabled: d.enabled,
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save proximity subscription");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── DELETE /live/proximity-subscription — darse de baja (por token) ─────────
router.delete("/live/proximity-subscription", async (req, res) => {
  const token = req.body?.pushToken;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Se requiere pushToken." });
  }
  try {
    await db
      .delete(proximitySubscriptionsTable)
      .where(eq(proximitySubscriptionsTable.pushToken, token));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete proximity subscription");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Clips de voz de los avisos ("Vecino, la tamalera está cerca")
// ════════════════════════════════════════════════════════════════════════════

// ── GET /live/voice-clips?districtId= — clips del distrito (para reproducir) ─
// Público (optionalAuth): la app del vecino los necesita para sonar el aviso.
router.get("/live/voice-clips", optionalAuth, async (req, res) => {
  const districtId = getDistrictId(req);
  if (!districtId) {
    return res
      .status(400)
      .json({ error: "Se requiere distrito (districtId)." });
  }
  try {
    const rows = await db
      .select({
        id: liveVoiceClipsTable.id,
        type: liveVoiceClipsTable.type,
        audioUrl: liveVoiceClipsTable.audioUrl,
        phrase: liveVoiceClipsTable.phrase,
        enabled: liveVoiceClipsTable.enabled,
        updatedAt: liveVoiceClipsTable.updatedAt,
      })
      .from(liveVoiceClipsTable)
      .where(eq(liveVoiceClipsTable.districtId, districtId));
    return res.json({
      clips: rows.map((r) => ({
        ...r,
        id: String(r.id),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list voice clips");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── PUT /live/voice-clips — crear/actualizar un clip (municipalidad) ─────────
const voiceClipSchema = z.object({
  type: z.enum(PROVIDER_TYPES),
  audioUrl: z.string().url().max(500).nullable().optional(),
  phrase: z.string().max(200).optional().default(""),
  enabled: z.boolean().optional().default(true),
  districtId: z.number().int().optional(),
});
router.put("/live/voice-clips", requireAuth, async (req, res) => {
  const districtId = resolveAdminDistrict(req, res);
  if (districtId == null) return;
  const parsed = voiceClipSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  }
  const { type, audioUrl, phrase, enabled } = parsed.data;
  const userId = (req as any).jwtUser?.sub
    ? Number((req as any).jwtUser.sub)
    : null;
  try {
    // Upsert manual (único por distrito+tipo).
    const [existing] = await db
      .select({ id: liveVoiceClipsTable.id })
      .from(liveVoiceClipsTable)
      .where(
        and(
          eq(liveVoiceClipsTable.districtId, districtId),
          eq(liveVoiceClipsTable.type, type as any),
        ),
      )
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(liveVoiceClipsTable)
        .set({
          audioUrl: audioUrl ?? null,
          phrase: phrase ?? "",
          enabled: enabled ?? true,
          updatedById: userId,
          updatedAt: new Date(),
        })
        .where(eq(liveVoiceClipsTable.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(liveVoiceClipsTable)
        .values({
          districtId,
          type: type as any,
          audioUrl: audioUrl ?? null,
          phrase: phrase ?? "",
          enabled: enabled ?? true,
          updatedById: userId,
        })
        .returning();
    }
    return res.json({
      ...row,
      id: String(row.id),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to upsert voice clip");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── DELETE /live/voice-clips/:id — eliminar un clip (municipalidad) ──────────
router.delete("/live/voice-clips/:id", requireAuth, async (req, res) => {
  const user = (req as any).jwtUser;
  if (!user || !isMunicipalityLevel(user.role)) {
    return res.status(403).json({ error: "Solo la municipalidad." });
  }
  const id = parseInt(req.params.id as string, 10);
  if (!Number.isFinite(id))
    return res.status(400).json({ error: "Id inválido." });
  try {
    const [clip] = await db
      .select()
      .from(liveVoiceClipsTable)
      .where(eq(liveVoiceClipsTable.id, id))
      .limit(1);
    if (!clip) return res.status(404).json({ error: "Clip no encontrado." });
    if (!checkTenant(req, clip.districtId)) {
      return res
        .status(403)
        .json({ error: "No puedes gestionar clips de otro distrito." });
    }
    await db.delete(liveVoiceClipsTable).where(eq(liveVoiceClipsTable.id, id));
    return res.json({ success: true, id: String(id) });
  } catch (err) {
    req.log.error({ err }, "Failed to delete voice clip");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
