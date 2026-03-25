import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, MapPin, CheckCircle2, ChevronRight, ChevronLeft, AlertTriangle } from "lucide-react";
import { ReportCategory, ReportUrgency, useCreateReport } from "@workspace/api-client-react";
import { CATEGORY_CONFIG, SECTORS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

const URGENCY_CONFIG: Record<ReportUrgency, { label: string; color: string; dot: string }> = {
  [ReportUrgency.low]:      { label: "Baja",     color: "border-green-500/50 text-green-400 bg-green-500/10",    dot: "bg-green-400" },
  [ReportUrgency.medium]:   { label: "Media",    color: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10", dot: "bg-yellow-400" },
  [ReportUrgency.high]:     { label: "Alta",     color: "border-orange-500/50 text-orange-400 bg-orange-500/10", dot: "bg-orange-400" },
  [ReportUrgency.critical]: { label: "Crítica",  color: "border-red-500/50 text-red-400 bg-red-500/10",         dot: "bg-red-400" },
};

const CATEGORY_COLORS: Record<ReportCategory, { icon: string; ring: string; bg: string }> = {
  [ReportCategory.robbery]:            { icon: "#ef4444", ring: "#ef444455", bg: "rgba(239,68,68,0.12)" },
  [ReportCategory.fight]:              { icon: "#f97316", ring: "#f9731655", bg: "rgba(249,115,22,0.12)" },
  [ReportCategory.suspicious]:         { icon: "#eab308", ring: "#eab30855", bg: "rgba(234,179,8,0.12)" },
  [ReportCategory.water_cut]:          { icon: "#3b82f6", ring: "#3b82f655", bg: "rgba(59,130,246,0.12)" },
  [ReportCategory.garbage]:            { icon: "#6b7280", ring: "#6b728055", bg: "rgba(107,114,128,0.12)" },
  [ReportCategory.informal_commerce]:  { icon: "#a855f7", ring: "#a855f755", bg: "rgba(168,85,247,0.12)" },
  [ReportCategory.noise]:              { icon: "#f59e0b", ring: "#f59e0b55", bg: "rgba(245,158,11,0.12)" },
  [ReportCategory.missing_person]:     { icon: "#f59e0b", ring: "#f59e0b55", bg: "rgba(245,158,11,0.12)" },
  [ReportCategory.fire]:               { icon: "#ef4444", ring: "#ef444455", bg: "rgba(239,68,68,0.12)" },
  [ReportCategory.medical_emergency]:  { icon: "#ef4444", ring: "#ef444455", bg: "rgba(239,68,68,0.12)" },
  [ReportCategory.other]:              { icon: "#6b7280", ring: "#6b728055", bg: "rgba(107,114,128,0.12)" },
};

const STEP_LABELS = ["Categoría", "Detalles", "Ubicación"];

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
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const canAdvanceStep1 = !!formData.category;
  const canAdvanceStep2 = !!formData.title.trim() && !!formData.description.trim();

  const handleNext = () => {
    if (step === 1 && !canAdvanceStep1) {
      toast({ title: "Selecciona una categoría", variant: "destructive" });
      return;
    }
    if (step === 2 && !canAdvanceStep2) {
      toast({ title: "Completa título y descripción", variant: "destructive" });
      return;
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
        latitude: -12.0784,
        longitude: -77.0852,
        address: formData.address,
        sector: formData.sector,
        authorName: formData.isAnonymous ? "Anónimo" : "Usuario Local",
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

      {/* Progress */}
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
                <span className={`text-xs font-medium hidden sm:inline transition-colors ${active ? "text-white" : done ? "text-green-400" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
              {num < 3 && <div className={`flex-1 h-px ${step > num ? "bg-green-500/40" : "bg-white/8"} transition-all`} />}
            </div>
          );
        })}
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit}>
        <div className="rounded-2xl bg-card border border-white/5 overflow-hidden shadow-2xl">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-5 md:p-6 space-y-5"
              >
                {/* Category grid */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-3">¿Qué está sucediendo?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.entries(CATEGORY_CONFIG) as [ReportCategory, any][]).map(([key, config]) => {
                      const Icon = config.icon;
                      const isSelected = formData.category === key;
                      const colors = CATEGORY_COLORS[key];
                      return (
                        <motion.button
                          key={key}
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setFormData(prev => ({ ...prev, category: key }))}
                          className="flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all text-center"
                          style={{
                            background: isSelected ? colors.bg : "transparent",
                            borderColor: isSelected ? colors.ring : "rgba(255,255,255,0.06)",
                          }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{ color: isSelected ? colors.icon : "#6b7280" }}
                          />
                          <span
                            className="text-[11px] font-medium leading-tight"
                            style={{ color: isSelected ? "#ffffff" : "#6b7280" }}
                          >
                            {config.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Urgencia</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(Object.entries(URGENCY_CONFIG) as [ReportUrgency, any][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, urgency: key }))}
                        className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          formData.urgency === key ? cfg.color : "border-white/8 text-muted-foreground bg-transparent hover:border-white/15"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-5 md:p-6 space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Título breve <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Ej: Robo de celular en parque"
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Descripción <span className="text-destructive">*</span></label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Describe qué pasó, características de personas, etc."
                    rows={4}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Foto (opcional)</label>
                  <button
                    type="button"
                    className="w-full h-28 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-white/20 hover:bg-white/[0.02] transition-all"
                  >
                    <Camera className="w-6 h-6 opacity-40" />
                    <span className="text-xs">Toca para subir evidencia fotográfica</span>
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-5 md:p-6 space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Sector</label>
                  <select
                    name="sector"
                    value={formData.sector}
                    onChange={handleChange}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Dirección o referencia</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Av. Universitaria cdra 5, frente al parque..."
                      className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {/* Summary */}
                {formData.category && (
                  <div className="p-4 rounded-xl bg-primary/6 border border-primary/15">
                    <p className="text-xs font-bold text-primary/80 uppercase tracking-widest mb-2">Resumen</p>
                    <p className="text-sm font-semibold text-white">{formData.title || "Sin título"}</p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{CATEGORY_CONFIG[formData.category as ReportCategory]?.label} · {formData.urgency}</p>
                  </div>
                )}

                <label className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/8 cursor-pointer hover:border-white/15 transition-colors">
                  <input
                    type="checkbox"
                    name="isAnonymous"
                    checked={formData.isAnonymous}
                    onChange={handleChange}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">Enviar anónimamente</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Tu nombre no será visible para vecinos, solo para autoridades verificadas.</p>
                  </div>
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="px-5 md:px-6 py-4 border-t border-white/5 flex items-center justify-between gap-3 bg-black/10">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/6 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Atrás
              </button>
            ) : <div />}

            <button
              type="submit"
              disabled={createReport.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_0_16px_hsl(217_100%_55%_/_0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createReport.isPending ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Enviando...
                </>
              ) : step === 3 ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Enviar Reporte
                </>
              ) : (
                <>
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
