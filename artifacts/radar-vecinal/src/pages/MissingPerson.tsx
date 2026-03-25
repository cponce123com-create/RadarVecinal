import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserX, Phone, MapPin, Clock, Plus, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useGetMissingPersons, useCreateMissingPerson } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const INPUT_CLASS = "w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-500/60 transition-colors";

export default function MissingPerson() {
  const { data, isLoading } = useGetMissingPersons({ active: true });
  const createMissing = useCreateMissingPerson();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "", age: "", clothing: "", lastSeenAddress: "", contactInfo: "",
  });

  const set = (field: string, value: string) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMissing.mutate({
      data: {
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        clothing: formData.clothing,
        lastSeenAddress: formData.lastSeenAddress,
        contactInfo: formData.contactInfo,
        lastSeenLatitude: -12.07,
        lastSeenLongitude: -77.09,
        lastSeenAt: new Date().toISOString(),
        reportedBy: "Usuario Local",
      }
    }, {
      onSuccess: () => {
        toast({ title: "Alerta publicada", description: "La red vecinal ha sido notificada." });
        setShowForm(false);
        setFormData({ name: "", age: "", clothing: "", lastSeenAddress: "", contactInfo: "" });
      },
      onError: () => {
        toast({ title: "Error al publicar", variant: "destructive" });
      }
    });
  };

  const alerts = data?.alerts ?? [];

  return (
    <div className="max-w-4xl mx-auto pb-8 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <UserX className="w-6 h-6" />
            Personas Extraviadas
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Red de búsqueda comunitaria. Cada minuto cuenta.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-amber-950 font-bold text-sm hover:bg-amber-400 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            <Plus className="w-4 h-4" />
            Reportar Extravío
          </button>
        )}
      </div>

      {/* New Alert Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl bg-card border border-amber-500/25 overflow-hidden shadow-2xl"
          >
            <div className="h-1 w-full bg-amber-500" />
            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-white">Nueva Alerta de Búsqueda</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Nombre completo <span className="text-amber-400">*</span></label>
                    <input required type="text" value={formData.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Sebastián García" className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Edad aproximada</label>
                    <input type="number" min="0" max="120" value={formData.age} onChange={e => set("age", e.target.value)} placeholder="Ej: 9" className={INPUT_CLASS} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Descripción física y vestimenta <span className="text-amber-400">*</span></label>
                  <textarea required rows={3} value={formData.clothing} onChange={e => set("clothing", e.target.value)} placeholder="Color de ropa, características físicas, señas particulares..." className={`${INPUT_CLASS} resize-none`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Último lugar visto <span className="text-amber-400">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                    <input required type="text" value={formData.lastSeenAddress} onChange={e => set("lastSeenAddress", e.target.value)} placeholder="Av. La Marina cdra 5, frente al colegio..." className={`${INPUT_CLASS} pl-10`} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1.5">Teléfono de contacto <span className="text-amber-400">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                    <input required type="tel" value={formData.contactInfo} onChange={e => set("contactInfo", e.target.value)} placeholder="999 999 999" className={`${INPUT_CLASS} pl-10`} />
                  </div>
                </div>
                <div className="flex gap-3 pt-2 border-t border-white/5">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/6 rounded-xl transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={createMissing.isPending} className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-amber-950 text-sm font-bold hover:bg-amber-400 transition-all disabled:opacity-60">
                    {createMissing.isPending ? "Publicando..." : "Publicar Alerta"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-72 rounded-xl bg-card animate-pulse border border-white/5" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
            <UserX className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-white font-semibold mb-1">Sin extraviados activos</p>
          <p className="text-sm text-muted-foreground">Si conoces a alguien que necesite ayuda, usa el botón de arriba.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((person, i) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl bg-card border border-amber-500/20 overflow-hidden flex flex-col"
            >
              {/* Photo area */}
              <div className="relative h-40 bg-gradient-to-br from-amber-950/40 to-neutral-900 flex items-center justify-center border-b border-white/5">
                {person.photoUrl ? (
                  <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover opacity-90" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center">
                      <span className="text-2xl font-bold text-amber-400">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">Sin foto disponible</span>
                  </div>
                )}
                {/* Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-amber-500 text-amber-950 text-[10px] font-bold rounded-lg shadow-lg status-blink">
                  BÚSQUEDA ACTIVA
                </div>
              </div>

              {/* Info */}
              <div className="p-4 flex-1 flex flex-col gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {person.name}
                    {person.age ? <span className="text-sm font-normal text-muted-foreground ml-1.5">({person.age} años)</span> : null}
                  </h3>
                  {person.clothing && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{person.clothing}</p>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-2 text-white/80">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{person.lastSeenAddress}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <a href={`tel:${person.contactInfo}`} className="text-amber-300 hover:text-amber-200 transition-colors">
                      {person.contactInfo}
                    </a>
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(person.createdAt), { addSuffix: true, locale: es })}
                  </div>
                  <a
                    href={`tel:${person.contactInfo}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
                  >
                    <Phone className="w-3 h-3" />
                    Contactar
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
