import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, MapPin, CheckCircle2, ChevronRight, ChevronLeft, AlertTriangle, ShieldOff, Info } from "lucide-react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ReportCategory, ReportUrgency, useCreateReport } from "@workspace/api-client-react";
import { CATEGORY_CONFIG, SECTORS, SENSITIVE_CATEGORIES, DISTRICT } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const URGENCY_CFG: Record<ReportUrgency, { label: string; color: string; dot: string }> = {
  [ReportUrgency.low]:      { label: "Baja",    color: "border-green-500/50 text-green-400 bg-green-500/10",    dot: "bg-green-400" },
  [ReportUrgency.medium]:   { label: "Media",   color: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10", dot: "bg-yellow-400" },
  [ReportUrgency.high]:     { label: "Alta",    color: "border-orange-500/50 text-orange-400 bg-orange-500/10", dot: "bg-orange-400" },
  [ReportUrgency.critical]: { label: "Crítica", color: "border-red-500/50 text-red-400 bg-red-500/10",          dot: "bg-red-400" },
};

const CATEGORY_COLORS: Record<string, { icon: string; ring: string; bg: string }> = {
  robbery:           { icon: "#ef4444", ring: "#ef444455", bg: "rgba(239,68,68,0.12)" },
  fight:             { icon: "#f97316", ring: "#f9731655", bg: "rgba(249,115,22,0.12)" },
  suspicious:        { icon: "#eab308", ring: "#eab30855", bg: "rgba(234,179,8,0.12)" },
  water_cut:         { icon: "#3b82f6", ring: "#3b82f655", bg: "rgba(59,130,246,0.12)" },
  garbage:           { icon: "#6b7280", ring: "#6b728055", bg: "rgba(107,114,128,0.12)" },
  informal_commerce: { icon: "#a855f7", ring: "#a855f755", bg: "rgba(168,85,247,0.12)" },
  noise:             { icon: "#f59e0b", ring: "#f59e0b55", bg: "rgba(245,158,11,0.12)" },
  missing_person:    { icon: "#f59e0b", ring: "#f59e0b55", bg: "rgba(245,158,11,0.12)" },
  fire:              { icon: "#ef4444", ring: "#ef444455", bg: "rgba(239,68,68,0.12)" },
  medical_emergency: { icon: "#ef4444", ring: "#ef444455", bg: "rgba(239,68,68,0.12)" },
  prostitution:      { icon: "#ec4899", ring: "#ec489955", bg: "rgba(236,72,153,0.12)" },
  drug_point:        { icon: "#84cc16", ring: "#84cc1655", bg: "rgba(132,204,22,0.12)" },
  bar_trouble:       { icon: "#f59e0b", ring: "#f59e0b55", bg: "rgba(245,158,11,0.12)" },
  other:             { icon: "#6b7280", ring: "#6b728055", bg: "rgba(107,114,128,0.12)" },
};

const STEP_LABELS = ["Categoría", "Detalles", "Ubicación"];

// ── Draggable marker inside a Leaflet map ──────────────────────────────────
function DraggableMarker({ position, onDrag }: {
  position: { lat: number; lng: number };
  onDrag: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = L.marker([position.lat, position.lng], { draggable: true }).addTo(map);
    marker.bindTooltip("Arrastra para ubicar el lugar exacto", { direction: "top" });
    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      onDrag(ll.lat, ll.lng);
    });
    markerRef.current = marker;
    return () => { marker.remove(); };
  }, [map]);

  return null;
}

// ── Main export ────────────────────────────────────────────────────────────
export default function ReportForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createReport = useCreateReport();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "" as ReportCategory | "",
    urgency: ReportUrgency.medium as ReportUrgency,
    isAnonymous: false,
    sector: SECTORS[0],
    address: "",
    contactPhone: "",
    latitude: DISTRICT.center.lat,
    longitude: DISTRICT.center.lng,
  });

  const isSensitive = formData.category !== "" && SENSITIVE_CATEGORIES.has(formData.category as ReportCategory);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
      };
      if (name === "category" && SENSITIVE_CATEGORIES.has(value as ReportCategory)) {
        updated.isAnonymous = true;
      }
      return updated;
    });
  };

  const handleCategorySelect = (key: ReportCategory) => {
    const sens = SENSITIVE_CATEGORIES.has(key);
    setFormData(prev => ({ ...prev, category: key, isAnonymous: sens ? true : prev.isAnonymous }));
  };

  const canAdvanceStep1 = !!formData.category;
  const canAdvanceStep2 = !!formData.title.trim() && !!formData.description.trim();

  const handleNext = () => {
    if (step === 1 && !canAdvanceStep1) {
      toast({ title: "Selecciona una categoría", variant: "destructive" }); return;
    }
    if (step === 2 && !canAdvanceStep2) {
      toast({ title: "Completa título y descripción", variant: "destructive" }); return;
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
        isAnonymous: formData.isAnonymous,
        latitude: formData.latitude,
        longitude: formData.longitude,
        address: formData.address,
        sector: formData.sector,
        contactPhone: formData.contactPhone || null,
        authorName: formData.isAnonymous ? "Anónimo" : "Vecino de San Ramón",
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

            {/* ── Step 1: Categoría ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="p-5 md:p-6 space-y-5">

                {/* Category grid */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-3">¿Qué está sucediendo?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.entries(CATEGORY_CONFIG) as [ReportCategory, any][]).map(([key, config]) => {
                      const Icon = config.icon;
                      const isSelected = formData.category === key;
                      const colors = CATEGORY_COLORS[key] ?? CATEGORY_COLORS.other;
                      return (
                        <motion.button
                          key={key}
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleCategorySelect(key)}
                          className="flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all text-center"
                          style={{
                            background: isSelected ? colors.bg : "transparent",
                            borderColor: isSelected ? colors.ring : "rgba(255,255,255,0.06)",
                          }}
                        >
                          <Icon className="w-5 h-5" style={{ color: isSelected ? colors.icon : "#6b7280" }} />
                          <span className="text-[11px] font-medium leading-tight" style={{ color: isSelected ? "#fff" : "#6b7280" }}>
                            {config.label}
                          </span>
                          {SENSITIVE_CATEGORIES.has(key) && (
                            <span className="text-[9px] font-semibold text-purple-400/70 flex items-center gap-0.5">
                              <ShieldOff className="w-2.5 h-2.5" /> Anónimo
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Urgency */}
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
              </motion.div>
            )}

            {/* ── Step 2: Detalles ── */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="p-5 md:p-6 space-y-4">

                {/* Important anonymous notice */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/6 border border-primary/20">
                  <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-300/80 leading-relaxed">
                    <span className="font-semibold text-white">Tu reporte es muy valioso</span> para la seguridad de San Ramón.
                    Recuerda que puedes enviarlo de forma <span className="font-semibold text-primary">completamente anónima</span> si lo prefieres.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Título breve <span className="text-destructive">*</span></label>
                  <input
                    type="text" name="title" value={formData.title} onChange={handleChange}
                    placeholder="Ej: Prostíbulo clandestino en Jr. Tarma"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Descripción <span className="text-destructive">*</span></label>
                  <textarea
                    name="description" value={formData.description} onChange={handleChange}
                    placeholder="Describe qué observaste, horarios, personas involucradas, etc."
                    rows={4}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Teléfono de contacto <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <input
                    type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange}
                    placeholder="Ej: 987 654 321 (para que la autoridad pueda confirmar)"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                  />
                  <p className="text-[10px] text-muted-foreground/50 mt-1.5">Solo visible para administradores verificados.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Foto (opcional)</label>
                  <button type="button"
                    className="w-full h-24 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-white/20 hover:bg-white/[0.02] transition-all">
                    <Camera className="w-6 h-6 opacity-40" />
                    <span className="text-xs">Toca para subir evidencia fotográfica</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Ubicación ── */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="p-5 md:p-6 space-y-4">

                {/* Draggable map */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Ubicación exacta
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">Arrastra el marcador para indicar el lugar preciso del incidente.</p>
                  <div className="rounded-xl overflow-hidden border border-white/10" style={{ height: 220 }}>
                    <MapContainer
                      center={[formData.latitude, formData.longitude]}
                      zoom={16}
                      zoomControl={false}
                      style={{ width: "100%", height: "100%" }}
                    >
                      <TileLayer
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution=""
                        maxZoom={19}
                      />
                      <DraggableMarker
                        position={{ lat: formData.latitude, lng: formData.longitude }}
                        onDrag={(lat, lng) => setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                      />
                    </MapContainer>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-right font-mono">
                    {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}
                  </p>
                </div>

                {/* Sector */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Sector</label>
                  <select name="sector" value={formData.sector} onChange={handleChange}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors">
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Dirección o referencia</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                    <input type="text" name="address" value={formData.address} onChange={handleChange}
                      placeholder="Jr. Tarma cdra. 3, frente al mercado..."
                      className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {/* Summary card */}
                {formData.category && (
                  <div className="p-4 rounded-xl bg-primary/6 border border-primary/15">
                    <p className="text-xs font-bold text-primary/80 uppercase tracking-widest mb-2">Resumen del reporte</p>
                    <p className="text-sm font-semibold text-white">{formData.title || "Sin título"}</p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {CATEGORY_CONFIG[formData.category as ReportCategory]?.label} · Urgencia {URGENCY_CFG[formData.urgency].label}
                    </p>
                  </div>
                )}

                {/* Anonymous notice / toggle */}
                {isSensitive ? (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/8 border border-purple-500/30">
                    <ShieldOff className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-purple-300">Reporte siempre anónimo</p>
                      <p className="text-xs text-purple-400/70 mt-0.5">
                        Esta categoría es delicada. Tu identidad está protegida — solo los administradores pueden ver quién reportó.
                      </p>
                    </div>
                  </div>
                ) : (
                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                    formData.isAnonymous ? "bg-blue-500/8 border-blue-500/30" : "bg-white/3 border-white/8 hover:border-white/15"
                  }`}>
                    <input type="checkbox" name="isAnonymous" checked={formData.isAnonymous} onChange={handleChange} className="mt-0.5 accent-primary" />
                    <div>
                      <p className="text-sm font-semibold text-white">Enviar anónimamente</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Tu nombre no será visible para otros vecinos, solo para administradores verificados.</p>
                    </div>
                  </label>
                )}

                {/* Final reminder */}
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-green-500/6 border border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <p className="text-xs text-green-300/80">
                    <span className="font-semibold">¡Tu reporte importa!</span> Cada denuncia ayuda a mantener San Ramón más seguro para todos.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
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
                <><AlertTriangle className="w-4 h-4" /> Enviar Reporte</>
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
