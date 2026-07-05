/**
 * features.ts — Geocoder, votos (upvotes) y recursos comunitarios
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { reportsTable, votesTable, districtResourcesTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { optionalAuth } from "./auth";
import { getDistrictId, checkTenant } from "./tenant";

const router: IRouter = Router();

// ── GET /geocode — convertir dirección a coordenadas (OpenStreetMap Nominatim) ─
router.get("/geocode", async (req, res) => {
  const q = req.query.q as string;
  if (!q || q.length < 3) {
    return res.status(400).json({ error: "Escribe al menos 3 caracteres de la dirección." });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=pe`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "RadarVecinal/1.0 (civictech)" },
    });
    const data = await resp.json() as Array<{ lat: string; lon: string; display_name: string }>;

    const results = data.map(d => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      label: d.display_name,
    }));

    return res.json({ results });
  } catch (err) {
    req.log.error({ err }, "Geocode failed");
    return res.status(502).json({ error: "No se pudo geocodificar la dirección." });
  }
});

// ── GET /geocode/reverse — convertir coordenadas a dirección (Nominatim) ────
router.get("/geocode/reverse", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat y lng deben ser números válidos." });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=16`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "RadarVecinal/1.0 (civictech)" },
    });
    const data = await resp.json() as {
      display_name?: string;
      address?: {
        road?: string;
        suburb?: string;
        neighbourhood?: string;
        city_district?: string;
        city?: string;
        municipality?: string;
        county?: string;
        state_district?: string;
        state?: string;
        postcode?: string;
        country?: string;
      };
    };

    if (!data.display_name) {
      return res.status(404).json({ error: "No se encontró dirección para esas coordenadas." });
    }

    const addr = data.address ?? {};

    // Barrio/zona: prioridad suburb > neighbourhood > city_district > municipality
    const zone = addr.suburb
      ?? addr.neighbourhood
      ?? addr.city_district
      ?? addr.municipality
      ?? addr.city
      ?? "";

    // Distrito (provincia/departamento)
    const district = addr.city ?? addr.municipality ?? addr.county ?? addr.state_district ?? "";
    const region = addr.state ?? "";
    const postcode = addr.postcode ?? "";

    return res.json({
      displayName: data.display_name,
      road: addr.road ?? "",
      zone,
      district,
      region,
      postcode,
    });
  } catch (err) {
    req.log.error({ err }, "Reverse geocode failed");
    return res.status(502).json({ error: "No se pudo geocodificar la ubicación." });
  }
});

// ── POST /reports/:id/vote — votar (upvote) un reporte ─────────────────────
router.post("/reports/:id/vote", optionalAuth, async (req, res) => {
  const reportId = parseInt(req.params.id as string);
  const user = (req as any).jwtUser;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  try {
    // Verificar que el reporte existe
    const [report] = await db.select({ id: reportsTable.id }).from(reportsTable)
      .where(eq(reportsTable.id, reportId)).limit(1);
    if (!report) return res.status(404).json({ error: "Reporte no encontrado." });

    // Verificar que el usuario no haya votado ya (por userId si autenticado, o por IP si anónimo)
    const existingVote = user?.sub
      ? await db.select().from(votesTable).where(
          and(eq(votesTable.reportId, reportId), eq(votesTable.userId, Number(user.sub)))
        ).limit(1)
      : await db.select().from(votesTable).where(
          and(eq(votesTable.reportId, reportId), eq(votesTable.userIp, ip))
        ).limit(1);

    if (existingVote.length > 0) {
      // Ya votó → quitar voto (toggle)
      await db.delete(votesTable).where(eq(votesTable.id, existingVote[0].id));
      await db.update(reportsTable).set({
        confirmedCount: sql`${reportsTable.confirmedCount} - 1`,
      }).where(eq(reportsTable.id, reportId));

      const [updated] = await db.select({ confirmedCount: reportsTable.confirmedCount })
        .from(reportsTable).where(eq(reportsTable.id, reportId)).limit(1);
      return res.json({ voted: false, confirmedCount: updated.confirmedCount });
    }

    // Nuevo voto
    await db.insert(votesTable).values({
      reportId,
      userId: user?.sub ? Number(user.sub) : undefined,
      userIp: user?.sub ? undefined : ip,
    });

    await db.update(reportsTable).set({
      confirmedCount: sql`${reportsTable.confirmedCount} + 1`,
    }).where(eq(reportsTable.id, reportId));

    const [updated] = await db.select({ confirmedCount: reportsTable.confirmedCount })
      .from(reportsTable).where(eq(reportsTable.id, reportId)).limit(1);
    return res.json({ voted: true, confirmedCount: updated.confirmedCount });
  } catch (err) {
    req.log.error({ err }, "Vote failed");
    return res.status(500).json({ error: "Error al procesar el voto." });
  }
});

// ── GET /reports/:id/vote — saber si el usuario ya votó ────────────────────
router.get("/reports/:id/vote", optionalAuth, async (req, res) => {
  const reportId = parseInt(req.params.id as string);
  const user = (req as any).jwtUser;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  try {
    const existingVote = user?.sub
      ? await db.select().from(votesTable).where(
          and(eq(votesTable.reportId, reportId), eq(votesTable.userId, Number(user.sub)))
        ).limit(1)
      : await db.select().from(votesTable).where(
          and(eq(votesTable.reportId, reportId), eq(votesTable.userIp, ip))
        ).limit(1);

    return res.json({ voted: existingVote.length > 0 });
  } catch (err) {
    req.log.error({ err }, "Check vote failed");
    return res.status(500).json({ error: "Error al consultar voto." });
  }
});

// ── GET /district-resources — recursos comunitarios por distrito ───────────
router.get("/district-resources", async (req, res) => {
  try {
    const districtId = getDistrictId(req);
    const resConditions: any[] = [];
    if (districtId) {
      resConditions.push(eq(districtResourcesTable.districtId, districtId));
    }

    const resources = await db.select()
      .from(districtResourcesTable)
      .where(resConditions.length > 0 ? and(...resConditions) : undefined)
      .orderBy(districtResourcesTable.sortOrder);

    return res.json({ resources });
  } catch (err) {
    req.log.error({ err }, "Failed to get district resources");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /district-resources — solo admin ──────────────────────────────────
router.post("/district-resources", async (req, res) => {
  const parsed = z.object({
    districtId: z.number().int(),
    type: z.enum(["police", "fire", "hospital", "helpline", "other"]),
    name: z.string().min(2).max(200),
    phone: z.string().optional(),
    address: z.string().optional(),
    url: z.string().optional(),
    description: z.string().optional().default(""),
    sortOrder: z.number().int().optional().default(0),
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });

  try {
    const [resource] = await db.insert(districtResourcesTable).values(parsed.data).returning();
    return res.status(201).json(resource);
  } catch (err) {
    req.log.error({ err }, "Failed to create resource");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
