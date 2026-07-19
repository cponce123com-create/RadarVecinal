/**
 * features.ts — Geocoder, votos (upvotes) y recursos comunitarios
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { districtResourcesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getDistrictId } from "./tenant";
import { MemoryCache } from "../lib/memoryCache";

const router: IRouter = Router();

// ── Geocodificación (Nominatim/OSM) ─────────────────────────────────────────
// Nominatim exige ≤1 req/s y cachear los resultados, o bloquean la IP. Cacheamos
// en memoria (TTL 1h) y ponemos timeout para no colgar la petición.
const geocodeCache = new MemoryCache<unknown>();
const GEOCODE_TTL = 60 * 60 * 1000; // 1 hora

async function fetchNominatim(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": "RadarVecinal/1.0 (civictech; contacto@radarvecinal.pe)",
    },
    signal: AbortSignal.timeout(6000),
  });
}

// ── GET /geocode — convertir dirección a coordenadas (OpenStreetMap Nominatim) ─
router.get("/geocode", async (req, res) => {
  const q = req.query.q as string;
  if (!q || q.length < 3) {
    return res
      .status(400)
      .json({ error: "Escribe al menos 3 caracteres de la dirección." });
  }

  const cacheKey = `s:${q.trim().toLowerCase()}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return res.json({ results: cached });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=pe`;
    const resp = await fetchNominatim(url);
    const data = (await resp.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    const results = data.map((d) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      label: d.display_name,
    }));

    geocodeCache.set(cacheKey, results, GEOCODE_TTL);
    return res.json({ results });
  } catch (err) {
    req.log.error({ err }, "Geocode failed");
    return res
      .status(502)
      .json({ error: "No se pudo geocodificar la dirección." });
  }
});

// ── GET /geocode/reverse — convertir coordenadas a dirección (Nominatim) ────
router.get("/geocode/reverse", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res
      .status(400)
      .json({ error: "lat y lng deben ser números válidos." });
  }

  // Cachear por coords redondeadas a ~11 m: arrastres cercanos reusan el caché.
  const cacheKey = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cachedRev = geocodeCache.get(cacheKey);
  if (cachedRev) return res.json(cachedRev);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=16`;
    const resp = await fetchNominatim(url);
    const data = (await resp.json()) as {
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
      return res
        .status(404)
        .json({ error: "No se encontró dirección para esas coordenadas." });
    }

    const addr = data.address ?? {};

    // Barrio/zona: prioridad suburb > neighbourhood > city_district > municipality
    const zone =
      addr.suburb ??
      addr.neighbourhood ??
      addr.city_district ??
      addr.municipality ??
      addr.city ??
      "";

    // Distrito (provincia/departamento)
    const district =
      addr.city ??
      addr.municipality ??
      addr.county ??
      addr.state_district ??
      "";
    const region = addr.state ?? "";
    const postcode = addr.postcode ?? "";

    const payload = {
      displayName: data.display_name,
      road: addr.road ?? "",
      zone,
      district,
      region,
      postcode,
    };
    geocodeCache.set(cacheKey, payload, GEOCODE_TTL);
    return res.json(payload);
  } catch (err) {
    req.log.error({ err }, "Reverse geocode failed");
    return res
      .status(502)
      .json({ error: "No se pudo geocodificar la ubicación." });
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

    const resources = await db
      .select()
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
  const parsed = z
    .object({
      districtId: z.number().int(),
      type: z.enum(["police", "fire", "hospital", "helpline", "other"]),
      name: z.string().min(2).max(200),
      phone: z.string().optional(),
      address: z.string().optional(),
      url: z.string().optional(),
      description: z.string().optional().default(""),
      sortOrder: z.number().int().optional().default(0),
    })
    .safeParse(req.body);

  if (!parsed.success)
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join("; ") });

  try {
    const [resource] = await db
      .insert(districtResourcesTable)
      .values(parsed.data)
      .returning();
    return res.status(201).json(resource);
  } catch (err) {
    req.log.error({ err }, "Failed to create resource");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
