import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { districtsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

// GET /api/districts — público, retorna solo distritos activos
// M-11: El frontend usa este endpoint en vez de datos hardcodeados
router.get("/districts", async (_req, res) => {
  try {
    const districts = await db.select()
      .from(districtsTable)
      .where(eq(districtsTable.isActive, true))
      .orderBy(districtsTable.name);
    return res.json({ districts });
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
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Parámetros inválidos" });
  }
  try {
    const districts = await db.select().from(districtsTable).where(eq(districtsTable.isActive, true));
    // Calcular distancia con haversine y ordenar
    const R = 6371000;
    const withDistance = districts
      .map(d => {
        const dLat = ((d.centerLat ?? 0) - parsed.data.lat) * Math.PI / 180;
        const dLng = ((d.centerLng ?? 0) - parsed.data.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2
          + Math.cos(parsed.data.lat * Math.PI / 180)
          * Math.cos((d.centerLat ?? 0) * Math.PI / 180)
          * Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return { ...d, distance: Math.round(dist) };
      })
      .filter(d => d.distance < 3000) // Solo dentro de 3 km — evita distritos vecinos lejanos
      .sort((a, b) => a.distance - b.distance)
      .slice(0, parsed.data.limit);

    return res.json({ districts: withDistance, query: { lat: parsed.data.lat, lng: parsed.data.lng } });
  } catch (err) {
    req.log.error({ err }, "Failed to get nearby districts");
    return res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
