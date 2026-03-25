import { useState } from "react";
import { useLocation } from "wouter";
import { Camera, MapPin, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { 
  ReportCategory, 
  ReportUrgency, 
  useCreateReport 
} from "@workspace/api-client-react";
import { CATEGORY_CONFIG, SECTORS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

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
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    if (!formData.category || !formData.title || !formData.description) {
      toast({ title: "Error", description: "Completa los campos obligatorios", variant: "destructive" });
      return;
    }

    createReport.mutate({
      data: {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        urgency: formData.urgency,
        isAnonymous: formData.isAnonymous,
        latitude: -12.0784, // Mock
        longitude: -77.0852, // Mock
        address: formData.address,
        sector: formData.sector,
        authorName: formData.isAnonymous ? "Anónimo" : "Usuario Local",
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Reporte Enviado",
          description: "Gracias por colaborar con la seguridad del distrito.",
        });
        setLocation("/home");
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-bold text-white mb-2">Crear Reporte</h2>
        <p className="text-muted-foreground">Proporciona detalles claros para que la comunidad y autoridades puedan actuar.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center mb-8">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex items-center flex-1 last:flex-none">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step >= num ? "bg-primary text-white" : "bg-card border border-white/10 text-muted-foreground"
            }`}>
              {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
            </div>
            {num < 3 && (
              <div className={`flex-1 h-1 mx-2 rounded-full ${step > num ? "bg-primary/50" : "bg-white/5"}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8 rounded-2xl bg-card border border-white/5 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        {step === 1 && (
          <div className="space-y-6 relative z-10 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium text-white mb-3">¿Qué está sucediendo?</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                  const isSelected = formData.category === key;
                  const Icon = config.icon;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setFormData({ ...formData, category: key as ReportCategory })}
                      className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
                        isSelected 
                          ? `bg-${config.color.split('-')[1]}/10 border-${config.color.split('-')[1]}` 
                          : "bg-background border-white/5 hover:border-white/20"
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-2 ${isSelected ? config.color : "text-muted-foreground"}`} />
                      <span className={`text-xs text-center font-medium ${isSelected ? "text-white" : "text-muted-foreground"}`}>
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Nivel de Urgencia</label>
              <div className="flex gap-2">
                {Object.values(ReportUrgency).map((u) => (
                  <button
                    type="button"
                    key={u}
                    onClick={() => setFormData({ ...formData, urgency: u })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize border transition-all ${
                      formData.urgency === u 
                        ? "bg-white text-black border-white" 
                        : "bg-background border-white/10 text-muted-foreground hover:bg-white/5"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 relative z-10 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Título breve</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Ej: Robo de celular en parque"
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">Descripción detallada</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe qué pasó, características de sospechosos, etc."
                rows={4}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Evidencia fotográfica (Opcional)</label>
              <button type="button" className="w-full h-32 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:bg-white/5 hover:border-white/20 transition-colors">
                <Camera className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-sm">Toca para tomar o subir foto</span>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 relative z-10 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Sector</label>
              <select
                name="sector"
                value={formData.sector}
                onChange={handleChange}
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
              >
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Dirección exacta o referencia</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Av. Universitaria cdra 5..."
                  className="w-full bg-background border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-3 mt-8">
              <input
                type="checkbox"
                name="isAnonymous"
                checked={formData.isAnonymous}
                onChange={handleChange}
                id="anon"
                className="mt-1"
              />
              <label htmlFor="anon" className="text-sm text-primary-foreground/90 cursor-pointer">
                <strong>Enviar de forma anónima.</strong> Tu nombre no será visible para los vecinos, solo para las autoridades verificadas.
              </label>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 rounded-xl font-medium text-white hover:bg-white/5 transition-colors"
            >
              Atrás
            </button>
          ) : <div></div>}
          
          <button
            type="submit"
            disabled={createReport.isPending}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,102,255,0.4)] disabled:opacity-50"
          >
            {createReport.isPending ? "Procesando..." : step === 3 ? "Enviar Reporte" : "Siguiente"}
            {step < 3 && <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
