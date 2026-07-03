/**
 * PanicAlertsLayer — Capa de alertas de pánico activas sobre el mapa.
 *
 * Se renderiza DENTRO de un <MapContainer> (se pasa como children de
 * <LeafletMap>). Muestra marcadores rojos pulsantes con popup informativo
 * para cada alerta de pánico activa del distrito, y se refresca sola:
 *   - polling cada 20 s (respaldo)
 *   - refresco inmediato cuando el stream SSE global invalida la query
 */
import { useEffect } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useGetPanicAlerts } from "@workspace/api-client-react";
import { useDistrict } from "@/contexts/DistrictContext";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const PANIC_LABEL: Record<string, { emoji: string; label: string }> = {
  robbery:        { emoji: "🚨", label: "Asalto en progreso" },
  medical:        { emoji: "🚑", label: "Emergencia médica" },
  fight:          { emoji: "⚔️", label: "Violencia física" },
  fire:           { emoji: "🔥", label: "Incendio" },
  missing_person: { emoji: "🔍", label: "Persona extraviada" },
  other:          { emoji: "⚠️", label: "Emergencia" },
};

function makePanicIcon(emoji: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
    html: `
      <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;inset:-6px;border-radius:50%;border:2px solid #ef4444;opacity:.6;animation:pulse 1.2s ease-out infinite;"></span>
        <span style="position:absolute;inset:-14px;border-radius:50%;border:2px solid #ef4444;opacity:.3;animation:pulse 1.2s ease-out infinite .4s;"></span>
        <div style="
          width:44px;height:44px;border-radius:50%;
          background:rgba(239,68,68,0.22);
          border:3px solid #ef4444;
          display:flex;align-items:center;justify-content:center;
          font-size:20px;
          box-shadow:0 0 22px rgba(239,68,68,0.65);
          cursor:pointer;
        ">${emoji}</div>
      </div>`,
  });
}

export function PanicAlertsLayer() {
  const { currentDistrictId } = useDistrict();
  const map = useMap();

  const { data } = useGetPanicAlerts(
    currentDistrictId ? { districtId: currentDistrictId, active: true } : undefined,
    // Cast necesario: el tipo generado por Orval exige queryKey, pero el hook lo construye internamente.
    // refetchInterval es el respaldo por si el SSE se cae.
    { query: { refetchInterval: 20000 } as any },
  );

  const alerts = (data?.alerts ?? []).filter(a => a.isActive);

  // Al aparecer la PRIMERA alerta activa, centrar suavemente el mapa en ella
  // (solo cuando pasa de 0 a 1+, para no pelear con el usuario mientras navega)
  useEffect(() => {
    if (alerts.length === 1) {
      const a = alerts[0];
      map.flyTo([a.latitude, a.longitude], Math.max(map.getZoom(), 15), { duration: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length]);

  return (
    <>
      {alerts.map(alert => {
        const meta = PANIC_LABEL[alert.type] ?? PANIC_LABEL.other;
        return (
          <Marker
            key={alert.id}
            position={[alert.latitude, alert.longitude]}
            icon={makePanicIcon(meta.emoji)}
            zIndexOffset={1000}
          >
            <Popup closeButton={false} maxWidth={240}>
              <div style={{ fontFamily: "inherit", minWidth: 190 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                  <strong style={{ fontSize: 13, color: "#ef4444" }}>{meta.label}</strong>
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.5, color: "#444" }}>
                  <div><b>Reportado por:</b> {alert.authorName}</div>
                  {alert.sector && <div><b>Sector:</b> {alert.sector}</div>}
                  {alert.address && <div><b>Referencia:</b> {alert.address}</div>}
                  <div style={{ marginTop: 4, color: "#888" }}>
                    Hace {formatDistanceToNow(new Date(alert.createdAt), { locale: es })}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default PanicAlertsLayer;
