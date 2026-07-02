import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Poi {
  id: string;
  type: string;
  name: string;
}

const POI_ICONS: Record<string, string> = {
  police:   "🏛️",
  fire:     "🚒",
  hospital: "🏥",
  helpline: "📞",
  other:    "📍",
};

/**
 * PoiLayer — Capa de Mapas con recursos comunitarios (comisaría, bomberos, hospital).
 * Inspirado en Mark-a-Spot (POI geo-referenciados en el mapa de reportes).
 */
export default function PoiLayer({ districtId }: { districtId: number | null }) {
  const map = useMap();
  const [pois, setPois] = useState<Poi[]>([]);

  useEffect(() => {
    if (!districtId) return;
    fetch(`/api/district-resources?districtId=${districtId}`)
      .then(r => r.json())
      .then(d => setPois(d.resources ?? []))
      .catch(() => {});
  }, [districtId]);

  useEffect(() => {
    if (pois.length === 0) return;

    const markers = pois.map(poi => {
      // We don't have lat/lng stored, so show a simple label or use geocoding
      // For now, we'll show them as a legend overlay
      return null;
    }).filter(Boolean);

    // Cleanup
    return () => {
      markers.forEach(m => m && map.removeLayer(m));
    };
  }, [pois, map]);

  // Return a legend overlay in the corner
  useEffect(() => {
    if (pois.length === 0) return;

    const LegendControl = L.Control.extend({
      onAdd: function() {
        const div = L.DomUtil.create("div", "");
        div.innerHTML = `
          <div style="background:#0f1219;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px;font-size:11px;color:#e2e8f0">
            <p style="margin:0 0 4px;font-weight:bold;font-size:10px;color:#94a3b8">RECURSOS</p>
            ${pois.map(p => `<div style="display:flex;align-items:center;gap:4px;margin:2px 0">
              <span>${POI_ICONS[p.type] ?? "📍"}</span>
              <span>${p.name}</span>
            </div>`).join("")}
          </div>
        `;
        return div;
      }
    });

    const legend = new LegendControl({ position: "bottomleft" });
    legend.addTo(map);

    return () => { legend.remove(); };
  }, [pois, map]);

  return null;
}
