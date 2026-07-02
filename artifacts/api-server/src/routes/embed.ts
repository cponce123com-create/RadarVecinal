/**
 * embed.ts — Widget embebible para municipalidades
 * Inspirado en FixMyStreet (widgets embebibles)
 *
 * Uso:
 *   <div data-radar-embed data-district="san-ramon"></div>
 *   <script src="https://radarvecinal.pe/api/embed/widget.js"></script>
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { reportsTable, districtsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// ── GET /embed/widget.js — script embebible ────────────────────────────────
router.get("/embed/widget.js", (_req, res) => {
  res.set("Content-Type", "application/javascript");
  res.set("Access-Control-Allow-Origin", "*");
  res.send(`
(function() {
  var els = document.querySelectorAll('[data-radar-embed]');
  if (!els.length) return;
  els.forEach(function(el) {
    var district = el.dataset.district || 'san-ramon';
    var iframe = document.createElement('iframe');
    iframe.src = '/api/embed/map?district=' + encodeURIComponent(district);
    iframe.style.width = '100%';
    iframe.style.height = '400px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.style.overflow = 'hidden';
    iframe.title = 'Radar Vecinal - Mapa de incidentes';
    el.appendChild(iframe);
  });
})();
  `);
});

// ── GET /embed/map — HTML del widget ───────────────────────────────────────
router.get("/embed/map", async (req, res) => {
  const districtSlug = (req.query.district as string) || "san-ramon";

  try {
    const [district] = await db.select()
      .from(districtsTable)
      .where(and(eq(districtsTable.slug, districtSlug), eq(districtsTable.isActive, true)))
      .limit(1);

    if (!district) {
      res.status(404).send("Distrito no encontrado");
      return;
    }

    const reports = await db.select({
      id: reportsTable.id,
      title: reportsTable.title,
      category: reportsTable.category,
      latitude: reportsTable.latitude,
      longitude: reportsTable.longitude,
      status: reportsTable.status,
      createdAt: reportsTable.createdAt,
    }).from(reportsTable)
      .where(eq(reportsTable.districtId, district.id))
      .orderBy(desc(reportsTable.createdAt))
      .limit(20);

    res.set("Access-Control-Allow-Origin", "*");
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${district.name} - Radar Vecinal</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0f1219; color: #e2e8f0; }
    #map { height: 280px; border-radius: 12px; overflow: hidden; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #1e293b; border-radius: 12px 12px 0 0; }
    .header h2 { font-size: 13px; font-weight: 600; color: #fff; }
    .header a { font-size: 11px; color: #3b82f6; text-decoration: none; }
    .footer { text-align: center; padding: 6px; font-size: 10px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <h2>📍 ${district.name}</h2>
    <a href="https://radarvecinal.pe" target="_blank">Reportar →</a>
  </div>
  <div id="map"></div>
  <div class="footer">${reports.length} incidentes reportados · Datos en tiempo real</div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <script>
    var map = L.map('map', { zoomControl: false, scrollWheelZoom: false }).setView([${district.centerLat || -11.1}, ${district.centerLng || -75.3}], ${district.defaultZoom || 13});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
    var reports = ${JSON.stringify(reports)};
    var colors = { robbery: '#ef4444', fight: '#f59e0b', suspicious: '#8b5cf6', garbage: '#22c55e', water_cut: '#3b82f6', noise: '#ec4899', fire: '#ef4444', medical_emergency: '#06b6d4', other: '#6b7280' };
    reports.forEach(function(r) {
      if (!r.latitude || !r.longitude) return;
      var color = colors[r.category] || '#6b7280';
      L.circleMarker([r.latitude, r.longitude], { radius: 6, color: color, fillColor: color, fillOpacity: 0.6, weight: 2 }).addTo(map).bindPopup('<b>' + r.title + '</b><br>' + r.category);
    });
  <\/script>
</body>
</html>
    `);
  } catch (err) {
    res.status(500).send("Error al cargar el widget");
    return;
  }
});

export default router;
