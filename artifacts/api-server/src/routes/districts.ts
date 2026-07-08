import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { districtsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { pointInGeoJSONGeometry } from "../lib/pointInPolygon.js";
import { MemoryCache } from "../lib/memoryCache";

const router: IRouter = Router();

// Item 9: In-memory cache for districts (60s TTL)
const districtsCache = new MemoryCache<any>();

// GET /api/districts — público, retorna solo distritos activos
// M-11: El frontend usa este endpoint en vez de datos hardcodeados
router.get("/districts", async (_req, res) => {
  try {
    const cacheKey = "districts_all";
    const cached = districtsCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const districts = await db
      .select()
      .from(districtsTable)
      .where(eq(districtsTable.isActive, true))
      .orderBy(districtsTable.name);

    const result = { districts };

    // Item 9: Cache for 60 seconds
    districtsCache.set(cacheKey, result, 60000);

    return res.json(result);
  } catch (err) {
    _req.log.error({ err }, "Failed to get districts");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// GET /api/districts/nearby — buscar distritos cercanos por coordenadas GPS
// M-15: Usa la fórmula del semiverseno (haversine) para calcular distancias
router.get("/districts/nearby", async (req, res) => {
  const schema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    limit: z.coerce.number().min(1).max(50).optional().default(5),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Parámetros inválidos",
    });
  }
  try {
    const districts = await db
      .select()
      .from(districtsTable)
      .where(eq(districtsTable.isActive, true));
    // Calcular distancia con haversine y ordenar
    const R = 6371000;
    const withDistance = districts
      .map((d) => {
        const dLat = (((d.centerLat ?? 0) - parsed.data.lat) * Math.PI) / 180;
        const dLng = (((d.centerLng ?? 0) - parsed.data.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((parsed.data.lat * Math.PI) / 180) *
            Math.cos(((d.centerLat ?? 0) * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...d, distance: Math.round(dist) };
      })
      .filter((d) => d.distance < 3000) // Solo dentro de 3 km — evita distritos vecinos lejanos
      .sort((a, b) => a.distance - b.distance)
      .slice(0, parsed.data.limit);

    return res.json({
      districts: withDistance,
      query: { lat: parsed.data.lat, lng: parsed.data.lng },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get nearby districts");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

// GET /api/districts/locate — detección exacta de distrito por coordenadas GPS
// FASE-2: Usa point-in-polygon con los límites geográficos del distrito.
// Si no se encuentra en ningún polígono, cae al método haversine (aproximado).
router.get("/districts/locate", async (req, res) => {
  const schema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Parámetros inválidos",
    });
  }
  try {
    const { lat, lng } = parsed.data;

    // 1. Intentar detección exacta por polígono
    const districtsWithBoundary = await db
      .select()
      .from(districtsTable)
      .where(eq(districtsTable.isActive, true));

    for (const district of districtsWithBoundary) {
      if (!district.boundary) continue;
      const geometry = district.boundary as { type: string; coordinates: any };
      if (!geometry.type || !geometry.coordinates) continue;

      const inside = pointInGeoJSONGeometry(lat, lng, geometry);
      if (inside) {
        return res.json({
          district: {
            id: district.id,
            slug: district.slug,
            name: district.name,
            province: district.province,
            department: district.department,
            centerLat: district.centerLat,
            centerLng: district.centerLng,
            defaultZoom: district.defaultZoom,
            isActive: district.isActive,
          },
          method: "exact",
          query: { lat, lng },
        });
      }
    }

    // 2. Fallback: haversine — buscar el distrito activo más cercano
    const allActive = await db
      .select()
      .from(districtsTable)
      .where(eq(districtsTable.isActive, true));

    const R = 6371000;
    let nearest = null;
    let nearestDist = Infinity;

    for (const d of allActive) {
      if (d.centerLat == null || d.centerLng == null) continue;
      const dLat = ((d.centerLat - lat) * Math.PI) / 180;
      const dLng = ((d.centerLng - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((d.centerLat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = d;
      }
    }

    if (nearest && nearestDist < 50000) {
      // 50 km de tolerancia
      return res.json({
        district: {
          id: nearest.id,
          slug: nearest.slug,
          name: nearest.name,
          province: nearest.province,
          department: nearest.department,
          centerLat: nearest.centerLat,
          centerLng: nearest.centerLng,
          defaultZoom: nearest.defaultZoom,
          isActive: nearest.isActive,
        },
        method: "approximate",
        query: { lat, lng },
      });
    }

    // Sin resultado
    return res.json({
      district: null,
      method: "approximate",
      query: { lat, lng },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to locate district");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
