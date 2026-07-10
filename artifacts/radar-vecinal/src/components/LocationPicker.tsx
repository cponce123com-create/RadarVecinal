import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed } from "lucide-react";
import GeocoderInput from "@/components/GeocoderInput";
import { pinIcon } from "@/lib/mapMarker";

function DraggableMarker({
  position,
  onDrag,
}: {
  position: { lat: number; lng: number };
  onDrag: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = L.marker([position.lat, position.lng], {
      draggable: true,
      icon: pinIcon,
    }).addTo(map);
    marker.bindTooltip("Arrastra para ubicar el lugar exacto", {
      direction: "top",
    });
    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      onDrag(ll.lat, ll.lng);
    });
    markerRef.current = marker;
    return () => {
      marker.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    markerRef.current?.setLatLng([position.lat, position.lng]);
  }, [position.lat, position.lng]);

  return null;
}

function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center[0], center[1], map]);
  return null;
}

interface LocationPickerProps {
  lat: number;
  lng: number;
  /** Se llama al buscar, arrastrar el marcador o usar el GPS. */
  onChange: (lat: number, lng: number, address?: string) => void;
  height?: number;
}

/**
 * Selector de ubicación reutilizable: búsqueda por dirección (geocoder) +
 * mapa con marcador arrastrable + botón "usar mi ubicación".
 */
export default function LocationPicker({
  lat,
  lng,
  onChange,
  height = 200,
}: LocationPickerProps) {
  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <GeocoderInput
            onSelect={(la, ln, address) => onChange(la, ln, address)}
          />
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/6 border border-white/10 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
        >
          <LocateFixed className="w-3.5 h-3.5" /> Mi ubicación
        </button>
      </div>
      <div
        className="rounded-xl overflow-hidden border border-white/10"
        style={{ height }}
      >
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          zoomControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution=""
            maxZoom={19}
          />
          <MapCenterUpdater center={[lat, lng]} />
          <DraggableMarker
            position={{ lat, lng }}
            onDrag={(la, ln) => onChange(la, ln)}
          />
        </MapContainer>
      </div>
      <p className="text-[10px] text-muted-foreground/50 text-right font-mono">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
    </div>
  );
}
