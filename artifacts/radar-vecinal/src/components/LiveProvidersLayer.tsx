/**
 * LiveProvidersLayer — Capa de "servicios en vivo" sobre el mapa.
 *
 * Se renderiza DENTRO de un <MapContainer> (como children de <LeafletMap>).
 * Muestra marcadores con emoji para cada transmisor activo del distrito
 * (camión recolector, panadero, lechero, tamalero, vendedor de comida…) y se
 * refresca sola por polling cada 12 s. Los marcadores se mueven al llegar
 * nuevos pings porque su `position` cambia con cada refetch.
 */
import { Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { useDistrict } from "@/contexts/DistrictContext";
import {
  listLiveProviders,
  getProviderTrack,
  providerMeta,
  providerTitle,
  type LiveProvider,
} from "@/lib/liveProviders";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

function makeLiveIcon(emoji: string, color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
    html: `
      <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ${color};opacity:.5;animation:pulse 1.8s ease-out infinite;"></span>
        <div style="
          width:40px;height:40px;border-radius:50%;
          background:rgba(9,12,20,0.92);
          border:3px solid ${color};
          display:flex;align-items:center;justify-content:center;
          font-size:19px;
          box-shadow:0 0 16px ${color}88;
        ">${emoji}</div>
      </div>`,
  });
}

// ── Línea verde de la ruta recorrida (breadcrumbs en vivo) ──────────────────
// Se dibuja para el camión recolector: la ciudadanía ve por dónde pasó desde
// que inició su transmisión y comprueba si pasó por su casa.
function ProviderTrail({ providerId }: { providerId: string }) {
  const { data } = useQuery({
    queryKey: ["provider-track", providerId],
    queryFn: () => getProviderTrack(providerId),
    refetchInterval: 12000,
    staleTime: 8000,
  });
  const pts = (data ?? []).map((p) => [p.lat, p.lng] as [number, number]);
  if (pts.length < 2) return null;
  return (
    <>
      {/* Halo suave debajo para dar contraste sobre el mapa */}
      <Polyline positions={pts} pathOptions={{ color: "#052e16", weight: 8, opacity: 0.35, lineCap: "round", lineJoin: "round" }} />
      <Polyline positions={pts} pathOptions={{ color: "#22c55e", weight: 4, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
    </>
  );
}

export function LiveProvidersLayer({ enabled = true }: { enabled?: boolean }) {
  const { currentDistrictId } = useDistrict();

  const { data } = useQuery({
    queryKey: ["live-providers", currentDistrictId],
    queryFn: () => listLiveProviders(currentDistrictId as number),
    enabled: enabled && !!currentDistrictId,
    refetchInterval: 12000,
    staleTime: 8000,
  });

  if (!enabled) return null;
  const providers: LiveProvider[] = data ?? [];

  return (
    <>
      {/* Ruta en vivo del camión recolector (línea verde) */}
      {providers.filter((p) => p.type === "recolector").map((p) => (
        <ProviderTrail key={`trail-${p.id}`} providerId={p.id} />
      ))}
      {providers.map((p) => {
        const meta = providerMeta(p.type);
        return (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={makeLiveIcon(meta.emoji, meta.color)}
            zIndexOffset={800}
          >
            <Popup closeButton={false} maxWidth={230}>
              <div style={{ fontFamily: "inherit", minWidth: 170 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                  <strong style={{ fontSize: 13, color: meta.color }}>
                    {providerTitle(p)}
                  </strong>
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.5, color: "#444" }}>
                  {p.displayName && p.label && <div>{p.displayName}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, color: "#16a34a" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                    <b>En vivo</b> · visto hace{" "}
                    {formatDistanceToNow(new Date(p.updatedAt), { locale: es })}
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

export default LiveProvidersLayer;
