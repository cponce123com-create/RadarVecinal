/**
 * LiveHistory — Historial de rutas de "Servicios en vivo".
 *
 * La ciudadanía elige una fecha y ve todas las rutas que hizo el camión
 * recolector (u otro servicio) ese día. Al seleccionar una, se dibuja su
 * recorrido en el mapa para comprobar por dónde pasó.
 */
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Route as RouteIcon, Calendar, Clock, MapPin, Ruler, AlertCircle, Radio, Home, LocateFixed, Loader2, CheckCircle2 } from "lucide-react";
import { useDistrict } from "@/contexts/DistrictContext";
import {
  listLiveHistory,
  getProviderTrack,
  findWhenPassed,
  providerMeta,
  PROVIDER_META,
  type LiveRoute,
  type LiveProviderType,
  type TrackPoint,
} from "@/lib/liveProviders";
import { format } from "date-fns";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayRange(dateStr: string): { from: string; to: string } {
  const from = new Date(`${dateStr}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function durationLabel(startISO: string, endISO: string): string {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function trackMeters(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const a = points[i - 1], b = points[i];
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    } else if (points.length === 1) {
      map.setView(points[0], 16);
    }
  }, [map, points]);
  return null;
}

const dot = (color: string) =>
  L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 6px ${color}"></div>`,
  });

function RouteDetail({ route }: { route: LiveRoute }) {
  const { data } = useQuery({
    queryKey: ["provider-track", route.id],
    queryFn: () => getProviderTrack(route.id),
    refetchInterval: route.isActive ? 12000 : false,
  });
  const points = data ?? [];
  const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);
  const meta = providerMeta(route.type);
  const meters = trackMeters(points);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/8 bg-card">
      <div className="relative h-[240px] sm:h-[300px]">
        {latlngs.length >= 1 ? (
          <MapContainer
            center={latlngs[0]} zoom={15} zoomControl={false} attributionControl={false}
            style={{ width: "100%", height: "100%", background: "#0d1117" }}
          >
            <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
            {latlngs.length >= 2 && (
              <>
                <Polyline positions={latlngs} pathOptions={{ color: "#052e16", weight: 8, opacity: 0.35 }} />
                <Polyline positions={latlngs} pathOptions={{ color: "#22c55e", weight: 4, opacity: 0.95 }} />
              </>
            )}
            <Marker position={latlngs[0]} icon={dot("#3b82f6")} />
            <Marker position={latlngs[latlngs.length - 1]} icon={dot(route.isActive ? "#ef4444" : "#22c55e")} />
            <FitBounds points={latlngs} />
          </MapContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            Sin puntos de ruta para este recorrido.
          </div>
        )}
        {route.isActive && (
          <div className="absolute top-2 left-2 z-[500] flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md border border-red-500/40" style={{ background: "rgba(7,9,15,0.85)" }}>
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-[10px] font-semibold text-red-300">EN CURSO</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/6 border-t border-white/6">
        <div className="flex flex-col items-center gap-0.5 py-2.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] text-white font-semibold">{durationLabel(route.startedAt, route.endedAt)}</span>
          <span className="text-[9px] text-muted-foreground">Duración</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-2.5">
          <Ruler className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] text-white font-semibold">{meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`}</span>
          <span className="text-[9px] text-muted-foreground">Recorrido</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 py-2.5">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-white font-semibold">{points.length}</span>
          <span className="text-[9px] text-muted-foreground">Puntos</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/6 text-[11px] text-muted-foreground">
        <span className="text-base">{meta.emoji}</span>
        <span className="text-white/80 font-medium">{route.label || meta.label}</span>
        <span className="ml-auto">🔵 inicio · {route.isActive ? "🔴 ahora" : "🟢 fin"}</span>
      </div>
    </div>
  );
}

// ── "¿Pasó el recolector por mi casa?" ──────────────────────────────────────
function PassedByCard({
  districtId, range, dateLabel,
}: { districtId: number; range: { from: string; to: string }; dateLabel: string }) {
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["passed", districtId, range.from, loc?.lat, loc?.lng],
    queryFn: () => findWhenPassed({ districtId, lat: loc!.lat, lng: loc!.lng, from: range.from, to: range.to, type: "recolector" }),
    enabled: !!loc,
  });

  const locate = () => {
    if (!navigator.geolocation) { setGeoError("Tu dispositivo no permite geolocalización."); return; }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      (err) => {
        setLocating(false);
        setGeoError(err.code === err.PERMISSION_DENIED ? "Permiso de ubicación denegado." : "No se pudo obtener tu ubicación.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const nearest = data?.nearest ?? null;
  const passedNear = data?.passedNear ?? false;

  return (
    <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-4">
      <div className="flex items-center gap-2 mb-2">
        <Home className="w-4 h-4 text-emerald-400" />
        <h3 className="text-[13px] font-semibold text-white">¿Pasó el recolector por tu casa?</h3>
      </div>

      {!loc ? (
        <>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed mb-3">
            Comparte tu ubicación y te digo si el camión pasó cerca el {dateLabel}, a qué hora y a cuántos metros.
          </p>
          <button
            onClick={locate} disabled={locating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
          >
            {locating ? <><Loader2 className="w-4 h-4 animate-spin" /> Ubicando…</> : <><LocateFixed className="w-4 h-4" /> Usar mi ubicación</>}
          </button>
          {geoError && <p className="text-[11px] text-red-300 mt-2">{geoError}</p>}
        </>
      ) : isFetching ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Revisando el recorrido…
        </div>
      ) : (
        <div>
          {nearest && passedNear ? (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/12 border border-emerald-500/40">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-emerald-100">
                <b>Sí pasó.</b> El recolector estuvo a <b>{nearest.distanceMeters} m</b> de tu casa a las{" "}
                <b>{format(new Date(nearest.at), "HH:mm")}</b>.
              </p>
            </div>
          ) : nearest ? (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-amber-100">
                No pasó muy cerca. Lo más cerca fue a <b>{nearest.distanceMeters} m</b> a las{" "}
                <b>{format(new Date(nearest.at), "HH:mm")}</b>.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.04] border border-white/10">
              <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-muted-foreground">
                El recolector no pasó cerca de tu casa el {dateLabel}.
              </p>
            </div>
          )}
          <button onClick={locate} className="text-[11px] text-primary hover:underline mt-2">
            Actualizar mi ubicación
          </button>
        </div>
      )}
    </div>
  );
}

export default function LiveHistory() {
  const { currentDistrictId, currentDistrict } = useDistrict();
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState<LiveProviderType | "">("recolector");
  const [selected, setSelected] = useState<LiveRoute | null>(null);

  const range = useMemo(() => dayRange(date), [date]);

  const { data, isLoading } = useQuery({
    queryKey: ["live-history", currentDistrictId, date, type],
    queryFn: () => listLiveHistory({ districtId: currentDistrictId as number, from: range.from, to: range.to, type }),
    enabled: !!currentDistrictId,
    refetchInterval: 20000,
  });
  const routes = data ?? [];

  // Al cambiar de día/tipo, limpiar la selección si ya no está en la lista.
  useEffect(() => {
    if (selected && !routes.some((r) => r.id === selected.id)) setSelected(null);
  }, [routes, selected]);

  if (!currentDistrictId) {
    return (
      <div className="rv-in max-w-2xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-200">Elige tu distrito arriba para ver el historial de rutas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rv-in max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
          <RouteIcon className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-white leading-tight">Historial de rutas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Recorridos de {currentDistrict || "tu distrito"}. Elige una fecha y comprueba por dónde pasó.
          </p>
        </div>
      </div>

      {/* Controles: fecha + tipo (a lo ancho en móvil) */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="flex items-center gap-2 px-3 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex-1">
          <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
          <input
            type="date" value={date} max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark] w-full"
          />
        </label>
        <select
          value={type} onChange={(e) => setType(e.target.value as LiveProviderType | "")}
          className="px-3 h-11 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none [color-scheme:dark] flex-1"
        >
          <option value="">Todos los servicios</option>
          {PROVIDER_META.map((m) => (
            <option key={m.type} value={m.type}>{m.emoji} {m.label}</option>
          ))}
        </select>
      </div>

      {/* ¿Pasó el recolector por mi casa? */}
      <PassedByCard
        districtId={currentDistrictId}
        range={range}
        dateLabel={format(new Date(`${date}T00:00:00`), "dd/MM/yyyy")}
      />

      {/* Ruta seleccionada */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <RouteDetail route={selected} />
        </motion.div>
      )}

      {/* Lista de rutas del día */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Cargando rutas…
        </div>
      ) : routes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <RouteIcon className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay rutas registradas el {format(new Date(`${date}T00:00:00`), "dd/MM/yyyy")}.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {routes.map((r) => {
            const meta = providerMeta(r.type);
            const active = selected?.id === r.id;
            return (
              <li key={r.id}>
                <button
                  onClick={() => setSelected(active ? null : r)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                    active ? "bg-emerald-500/10 border-emerald-500/40" : "bg-white/[0.03] border-white/8 hover:border-white/15"
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{meta.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white truncate">{r.label || meta.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(r.startedAt), "HH:mm")} · {durationLabel(r.startedAt, r.endedAt)} · {r.points} puntos
                    </p>
                  </div>
                  {r.isActive ? (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 flex-shrink-0">
                      <Radio className="w-2.5 h-2.5" /> en curso
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">ver ruta →</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
