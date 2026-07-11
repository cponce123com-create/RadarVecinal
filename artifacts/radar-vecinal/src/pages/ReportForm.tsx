import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, MapPin, CheckCircle2, ChevronRight, ChevronLeft, AlertTriangle, ShieldOff, Loader2, X, ImageIcon, Search, Pencil } from "lucide-react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ReportCategory, ReportUrgency, useCreateReport } from "@workspace/api-client-react";
import { CATEGORY_CONFIG, SENSITIVE_CATEGORIES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDistrict } from "@/contexts/DistrictContext";
import GeocoderInput from "@/components/GeocoderInput";
import { pinIcon } from "@/lib/mapMarker";
import IncidentPicker, { type IncidentPick } from "@/components/IncidentPicker";


const URGENCY_CFG: Record<ReportUrgency, { label: string; color: string; dot: string }> = {
  [ReportUrgency.low]:      { label: "Baja",    color: "border-green-500/50 text-green-400 bg-green-500/10",    dot: "bg-green-400" },
  [ReportUrgency.medium]:   { label: "Media",   color: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10", dot: "bg-yellow-400" },
  [ReportUrgency.high]:     { label: "Alta",    color: "border-orange-500/50 text-orange-400 bg-orange-500/10", dot: "bg-orange-400" },
  [ReportUrgency.critical]: { label: "Crítica", color: "border-red-500/50 text-red-400 bg-red-500/10",          dot: "bg-red-400" },
};

// ── FixMyStreet-inspired wizard: Ubicación → Descripción → Confirmar ───────
const STEP_LABELS = ["Ubicación", "Descripción", "Confirmar"];

// ── Draggable marker ───────────────────────────────────────────────────────
function DraggableMarker({ position, onDrag }: {
  position: { lat: number; lng: number };
  onDrag: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = L.marker([position.lat, position.lng], { draggable: true, icon: pinIcon }).addTo(map);
    marker.bindTooltip("Arrastra para ubicar el lugar exacto", { direction: "top" });
    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      onDrag(ll.lat, ll.lng);
    });
    markerRef.current = marker;
    return () => { marker.remove(); };
  }, [map]);

  // Mover el marcador cuando cambie la posición (GPS o búsqueda)
  useEffect(() => {
    const marker = markerRef.current;
    if (marker) {
      marker.setLatLng([position.lat, position.lng]);
    }
  }, [position.lat, position.lng]);

  return null;
}

// ── MapCenterUpdater — fuerza al mapa a moverse cuando cambian las coordenadas ─
function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center[0], center[1], map]);
  return null;
}

export default function ReportForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentDistrict, currentDistrictId, districtCenter } = useDistrict();
  const createReport = useCreateReport();

  const [step, setStep] = useState(1);

  // Coordenadas pre-seleccionadas desde el mapa (/reportar?lat=..&lng=..)
  const [fromMap] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get("lat") ?? "");
    const lng = parseFloat(params.get("lng") ?? "");
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "" as ReportCategory | "",
    urgency: ReportUrgency.medium as ReportUrgency,
    sector: "",
    address: "",
    contactPhone: "",
    // Fallback provisional: centro del distrito activo (el GPS lo sobreescribe)
    latitude: fromMap?.lat ?? districtCenter.lat,
    longitude: fromMap?.lng ?? districtCenter.lng,
  });

  // ── GPS + Reverse Geocode: detectar ubicación real del vecino ───────────
  const [detectingLocation, setDetectingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  // El usuario ya no escribe barrio/dirección: se autocompletan del mapa. Si
  // decide ajustar la dirección a mano, este ref evita que el geocoder la pise.
  const addressManualRef = useRef(false);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setAddrLoading(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (!res.ok) return;
      const data = await res.json();
      const zone: string = data.zone || "";
      const roadZone = [data.road, data.zone].filter(Boolean).join(", ") || data.displayName || "";
      setFormData(prev => ({
        ...prev,
        // sector siempre con valor (el backend lo exige): zona › distrito › "Centro"
        sector: zone || prev.sector || currentDistrict || "Centro",
        address: addressManualRef.current ? prev.address : roadZone || prev.address,
      }));
    } catch {
      // silencio - se mantiene el valor anterior; el distrito cubre el sector
      setFormData(prev => ({ ...prev, sector: prev.sector || currentDistrict || "Centro" }));
    } finally {
      setAddrLoading(false);
    }
  }, [currentDistrict]);

  useEffect(() => {
    if (fromMap) {
      // Ya tiene coordenadas desde la URL, hace reverse geocode directo
      setDetectingLocation(false);
      reverseGeocode(fromMap.lat, fromMap.lng);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDetectingLocation(false);
      setLocationError("GPS no disponible. Usa el mapa o la búsqueda.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
        setDetectingLocation(false);
        reverseGeocode(lat, lng);
      },
      (err) => {
        setDetectingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError("Permiso de ubicación denegado. Puedes buscar tu dirección en el mapa.");
        } else {
          setLocationError("No se pudo obtener tu ubicación. Usa el mapa o la búsqueda.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  }, [fromMap, reverseGeocode]);

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl]         = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadErr, setUploadErr]       = useState<string | null>(null);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadErr("Solo se permiten imágenes."); return; }
    if (file.size > 8 * 1024 * 1024)     { setUploadErr("Imagen demasiado grande (máx. 8 MB)."); return; }

    setUploadErr(null);
    setUploading(true);
    setImagePreview(URL.createObjectURL(file));

    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Error al obtener URL de subida.");
      const { uploadURL, objectPath } = await urlRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Error al subir la imagen.");

      setImageUrl(`/api/storage/objects/${objectPath.replace(/^\/objects\//, "")}`);
    } catch (err: any) {
      setUploadErr(err.message ?? "Error al subir imagen.");
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  }, []);

  const isSensitive = formData.category !== "" && SENSITIVE_CATEGORIES.has(formData.category as ReportCategory);

  // Nombre en clave con el que se publicará el reporte
  const codeName = user
    ? (user.alias?.trim() || (user.vecinoId ? `Vecino ${String(user.vecinoId).padStart(6, "0")}` : "Vecino (código autogenerado)"))
    : "Vecino";
  const publishAs = isSensitive ? "Anónimo" : codeName;

  const [addressEditing, setAddressEditing] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ── Buscador inteligente de "¿Qué está pasando?" ──
  // Al elegir un subtipo del catálogo se fija categoría + urgencia y se
  // prellena el título (editable). El usuario solo escribe la descripción.
  const handleIncidentPick = (pick: IncidentPick) => {
    setFormData(prev => ({
      ...prev,
      category: pick.category,
      urgency: pick.urgency,
      // Prellena el título solo si estaba vacío o venía de otra selección
      title: prev.title.trim() ? prev.title : pick.label,
    }));
  };
  const clearIncident = () =>
    setFormData(prev => ({ ...prev, category: "" as ReportCategory | "" }));

  const [showErrors, setShowErrors] = useState(false);
  const titleTrimmed = formData.title.trim();
  const descTrimmed  = formData.description.trim();
  const titleErr  = !titleTrimmed ? "El título es obligatorio" : titleTrimmed.length < 5 ? "Mínimo 5 caracteres" : null;
  const descErr   = !descTrimmed  ? "La descripción es obligatoria" : descTrimmed.length < 10 ? "Mínimo 10 caracteres" : null;

  const canAdvanceStep1 = true; // map is always set (has default)
  const canAdvanceStep2 = !!formData.category && !titleErr && !descErr;

  const handleNext = () => {
    if (step === 2) {
      setShowErrors(true);
      if (!canAdvanceStep2) return;
    }
    setStep(s => s + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) { handleNext(); return; }
    createReport.mutate({
      data: {
        title: formData.title,
        description: formData.description,
        category: formData.category as ReportCategory,
        urgency: formData.urgency,
        // El anonimato ya no es una opción manual: las categorías sensibles se
        // fuerzan a anónimo en el servidor; el resto se publica con el nombre
        // en clave del vecino (alias o "Vecino XXXXXX").
        isAnonymous: false,
        latitude: formData.latitude,
        longitude: formData.longitude,
        address: formData.address,
        sector: formData.sector,
        contactPhone: formData.contactPhone || null,
        district: currentDistrict,
        // FIX: sin districtId el backend rechaza reportes de usuarios anónimos (400)
        districtId: currentDistrictId ?? undefined,
        imageUrl: imageUrl ?? null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "✓ Reporte enviado", description: "Gracias por colaborar con la seguridad del distrito." });
        setLocation("/home");
      },
      onError: () => {
        toast({ title: "Error al enviar", description: "Intenta de nuevo.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-xl mx-auto pb-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Crear Reporte</h2>
        <p className="text-sm text-muted-foreground">
          Proporciona detalles claros para que la comunidad y autoridades puedan actuar.
        </p>
      </div>

      {/* Progress stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEP_LABELS.map((label, idx) => {
          const num = idx + 1;
          const done = step > num;
          const active = step === num;
          return (
            <div key={num} className="flex items-center flex-1 last:flex-none gap-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done ? "bg-green-500 text-white" : active ? "bg-primary text-white" : "bg-card border border-white/10 text-muted-foreground"
                }`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : num}
                </div>
                <span className={`text-xs font-medium hidden sm:inline transition-colors ${
                  active ? "text-white" : done ? "text-green-400" : "text-muted-foreground"
                }`}>{label}</span>
              </div>
              {num < 3 && <div className={`flex-1 h-px ${step > num ? "bg-green-500/40" : "bg-white/8"} transition-all`} />}
            </div>
          );
        })}
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit}>
        <div className="rounded-2xl bg-card border border-white/5 overflow-hidden shadow-2xl">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: UBICACIÓN (FixMyStreet: mapa primero) ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="p-5 md:p-6 space-y-4">

                {/* Aviso: punto seleccionado desde el mapa */}
                {fromMap && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/8 border border-primary/25">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <p className="text-xs text-primary/90 font-medium">
                      Ubicación seleccionada desde el mapa. Puedes ajustarla arrastrando el marcador.
                    </p>
                  </div>
                )}

                {/* Geocoder — buscar dirección */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <Search className="w-4 h-4 text-primary" />
                    Buscar dirección
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">Escribe una dirección y el mapa se posicionará automáticamente.</p>
                  <GeocoderInput onSelect={(lat, lng) => {
                    addressManualRef.current = false;
                    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
                    reverseGeocode(lat, lng);
                  }} />
                </div>

                {/* Mapa con marcador */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Ubicación exacta
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">Arrastra el marcador para ajustar el lugar preciso del incidente.</p>
                  <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 220 }}>
                    <MapContainer
                      center={[formData.latitude, formData.longitude]}
                      zoom={16}
                      zoomControl={false}
                      style={{ width: "100%", height: "100%" }}
                    >
                      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="" maxZoom={19} />
                      <MapCenterUpdater center={[formData.latitude, formData.longitude]} />
                      <DraggableMarker
                        position={{ lat: formData.latitude, lng: formData.longitude }}
                        onDrag={(lat, lng) => {
                          addressManualRef.current = false;
                          setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
                          reverseGeocode(lat, lng);
                        }}
                      />
                    </MapContainer>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-right font-mono">
                    {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}
                  </p>
                </div>

                {/* Dirección auto-detectada del marcador (sin cajas manuales) */}
                <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                        Dirección detectada
                      </p>
                      {addrLoading || detectingLocation ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Obteniendo dirección…
                        </span>
                      ) : addressEditing ? (
                        <input
                          autoFocus type="text" name="address" value={formData.address}
                          onChange={(e) => { addressManualRef.current = true; handleChange(e); }}
                          placeholder="Escribe la dirección o una referencia…"
                          className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                        />
                      ) : (
                        <p className="text-sm text-white font-medium break-words">
                          {formData.address || (locationError ? "Ajusta el marcador o busca la dirección" : "Mueve el marcador para detectar la dirección")}
                        </p>
                      )}
                      {!!formData.sector && !addressEditing && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">Zona: {formData.sector}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => setAddressEditing(v => !v)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-white hover:bg-white/8 transition-colors flex-shrink-0">
                      <Pencil className="w-3 h-3" /> {addressEditing ? "Listo" : "Ajustar"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: DESCRIPCIÓN ── */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="p-5 md:p-6 space-y-5">

                {/* ¿Qué está pasando? — buscador inteligente */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-1">
                    ¿Qué está pasando? <span className="text-destructive">*</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-2.5">
                    Escribe y elige el tipo (ej. “robo” → robo a mano armada, hurto de celular…).
                  </p>
                  <IncidentPicker
                    category={formData.category}
                    title={formData.title}
                    onPick={handleIncidentPick}
                    onClear={clearIncident}
                  />
                  {isSensitive && (
                    <p className="text-[11px] text-purple-300/80 mt-2 flex items-center gap-1.5">
                      <ShieldOff className="w-3.5 h-3.5" /> Categoría delicada: se publicará de forma anónima.
                    </p>
                  )}
                </div>

                {/* Urgencia */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Urgencia</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(Object.entries(URGENCY_CFG) as [ReportUrgency, any][]).map(([key, cfg]) => (
                      <button key={key} type="button" onClick={() => setFormData(prev => ({ ...prev, urgency: key }))}
                        className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          formData.urgency === key ? cfg.color : "border-white/8 text-muted-foreground bg-transparent hover:border-white/15"
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Título */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-white">Título breve <span className="text-destructive">*</span></label>
                    <span className={`text-[11px] tabular-nums transition-colors ${formData.title.length > 120 ? "text-orange-400" : "text-muted-foreground/50"}`}>
                      {formData.title.length}/160
                    </span>
                  </div>
                  <input type="text" name="title" value={formData.title} onChange={handleChange}
                    placeholder="Ej: Prostíbulo clandestino en Jr. Tarma" maxLength={160}
                    className={`w-full bg-background border rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none transition-colors ${
                      showErrors && titleErr ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-primary"
                    }`}
                  />
                  {showErrors && titleErr && <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {titleErr}</p>}
                </div>

                {/* Descripción */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-white">Descripción <span className="text-destructive">*</span></label>
                    <span className={`text-[11px] tabular-nums transition-colors ${formData.description.length > 1800 ? "text-orange-400" : "text-muted-foreground/50"}`}>
                      {formData.description.length}/2000
                    </span>
                  </div>
                  <textarea name="description" value={formData.description} onChange={handleChange}
                    placeholder="Describe qué observaste, horarios, personas involucradas, etc. (mín. 10 caracteres)" rows={4} maxLength={2000}
                    className={`w-full bg-background border rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none transition-colors resize-none ${
                      showErrors && descErr ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-primary"
                    }`}
                  />
                  {showErrors && descErr && <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {descErr}</p>}
                </div>

                {/* Identidad: nombre en clave */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/8">
                  <ShieldOff className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">
                      Se publicará como: <span className="text-primary">{publishAs}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isSensitive
                        ? "Categoría delicada: tu identidad queda protegida automáticamente."
                        : user
                          ? "Puedes cambiar tu nombre en clave desde tu Perfil."
                          : "Inicia sesión para tener tu propio nombre en clave."}
                    </p>
                  </div>
                </div>

                {/* Contacto */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Teléfono de contacto <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <input type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange}
                    placeholder="Ej: 987 654 321"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Foto */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Foto de evidencia <span className="text-muted-foreground font-normal">(opcional)</span></label>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  {imagePreview ? (
                    <div className="relative w-full rounded-xl overflow-hidden border border-white/10" style={{ maxHeight: 200 }}>
                      <img src={imagePreview} alt="Vista previa" className="w-full object-cover" style={{ maxHeight: 200 }} />
                      {uploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="w-6 h-6 text-white animate-spin" /><span className="text-white text-sm ml-2">Subiendo...</span></div>}
                      {!uploading && (
                        <button type="button" onClick={() => { setImagePreview(null); setImageUrl(null); setUploadErr(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90"><X className="w-4 h-4 text-white" /></button>
                      )}
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full h-24 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:bg-white/[0.02] transition-all">
                      <Camera className="w-6 h-6 opacity-50" />
                      <span className="text-xs">Toca para subir evidencia fotográfica</span>
                      <span className="text-[10px] opacity-40">JPG, PNG o WEBP · máx. 8 MB</span>
                    </button>
                  )}
                  {uploadErr && <p className="text-xs text-red-400 mt-1">{uploadErr}</p>}
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: CONFIRMAR ── */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="p-5 md:p-6 space-y-4">

                <p className="text-sm font-bold text-white mb-1">Revisa tu reporte antes de enviar</p>

                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-card border border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ubicación</p>
                    <p className="text-xs text-white font-medium truncate">{formData.sector}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{formData.address || "Sin dirección"}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-card border border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Categoría</p>
                    <p className="text-xs text-white font-medium">{(CATEGORY_CONFIG as any)[formData.category]?.label ?? formData.category}</p>
                    <p className="text-[10px] text-muted-foreground/60">Urgencia {URGENCY_CFG[formData.urgency]?.label}</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-card border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Título</p>
                  <p className="text-sm text-white font-semibold">{formData.title}</p>
                </div>

                <div className="p-3 rounded-xl bg-card border border-white/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Descripción</p>
                  <p className="text-xs text-white/80 line-clamp-3">{formData.description}</p>
                </div>

                {imageUrl && (
                  <div className="p-3 rounded-xl bg-card border border-white/5 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">Foto adjunta</span>
                  </div>
                )}

                {/* Identidad de publicación (sin opción manual de anonimato) */}
                {isSensitive ? (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/8 border border-purple-500/30">
                    <ShieldOff className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-purple-300">Reporte siempre anónimo</p>
                      <p className="text-xs text-purple-400/70 mt-0.5">Categoría delicada. Solo administradores ven quién reportó.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/8">
                    <ShieldOff className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Se publicará como: <span className="text-primary">{publishAs}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Los vecinos solo verán tu nombre en clave, nunca tus datos reales.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-green-500/6 border border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <p className="text-xs text-green-300/80">
                    <span className="font-semibold">¡Tu reporte importa!</span> Cada denuncia ayuda a mantener el distrito más seguro.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="px-5 md:px-6 py-4 border-t border-white/5 flex items-center justify-between gap-3 bg-black/10">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/6 transition-all">
                <ChevronLeft className="w-4 h-4" /> Atrás
              </button>
            ) : <div />}

            <button type="submit" disabled={createReport.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_0_16px_hsl(217_100%_55%_/_0.3)] disabled:opacity-50 disabled:cursor-not-allowed">
              {createReport.isPending ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Enviando...</>
              ) : step === 3 ? (
                <><CheckCircle2 className="w-4 h-4" /> Enviar Reporte</>
              ) : (
                <>Siguiente <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
