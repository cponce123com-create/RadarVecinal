import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Plus, LinkIcon, ToggleLeft, ToggleRight, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type AdSlot, DEMO_AD_SLOTS } from "./constants";

export default function AdSlotsTab() {
  const [adSlots, setAdSlots] = useState<AdSlot[]>(DEMO_AD_SLOTS);
  const [editingAd, setEditingAd] = useState<AdSlot | null>(null);
  const { toast } = useToast();

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Espacios Publicitarios</p>
          <p className="text-xs text-muted-foreground">Gestiona los espacios de publicidad local disponibles en la app.</p>
        </div>
        <button
          onClick={() => {
            const newSlot: AdSlot = {
              id: `ad${Date.now()}`,
              label: "Nuevo Banner",
              position: "custom",
              client: "Disponible",
              url: "",
              active: false,
              impressions: 0,
              clicks: 0,
            };
            setAdSlots(prev => [...prev, newSlot]);
            setEditingAd(newSlot);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo espacio
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Activos",     value: adSlots.filter(a => a.active).length,              color: "#22c55e" },
          { label: "Impresiones", value: adSlots.reduce((s, a) => s + a.impressions, 0).toLocaleString(), color: "#3b82f6" },
          { label: "Clics",       value: adSlots.reduce((s, a) => s + a.clicks, 0),         color: "#a855f7" },
        ].map(kpi => (
          <div key={kpi.label} className="p-3 rounded-xl bg-card border border-white/5 text-center">
            <p className="text-xl font-bold text-white">{kpi.value}</p>
            <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Ad Slot Cards */}
      <div className="flex flex-col gap-2">
        {adSlots.map(slot => {
          const ctr = slot.impressions > 0 ? ((slot.clicks / slot.impressions) * 100).toFixed(1) : "0.0";
          return (
            <div key={slot.id} className="p-4 rounded-xl bg-card border border-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={() => setAdSlots(prev => prev.map(a => a.id === slot.id ? { ...a, active: !a.active } : a))}
                className="flex-shrink-0"
              >
                {slot.active
                  ? <ToggleRight className="w-7 h-7 text-green-400" />
                  : <ToggleLeft  className="w-7 h-7 text-muted-foreground" />
                }
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-white truncate">{slot.label}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    slot.active
                      ? "bg-green-500/15 text-green-400"
                      : "bg-white/5 text-muted-foreground"
                  }`}>
                    {slot.active ? "Activo" : "Pausado"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{slot.client}</p>
                {slot.url && (
                  <a href={slot.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-primary/60 hover:text-primary transition-colors mt-0.5">
                    <LinkIcon className="w-3 h-3" />
                    <span className="truncate">{slot.url}</span>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-4 text-center flex-shrink-0">
                <div>
                  <p className="text-xs font-bold text-white">{slot.impressions.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Impr.</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{slot.clicks}</p>
                  <p className="text-[10px] text-muted-foreground">Clics</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{ctr}%</p>
                  <p className="text-[10px] text-muted-foreground">CTR</p>
                </div>
              </div>

              <button
                onClick={() => setEditingAd({ ...slot })}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/20 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Edit Ad Slot Modal */}
      <AnimatePresence>
        {editingAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setEditingAd(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Megaphone className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="font-bold text-white">Editar espacio publicitario</h3>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { label: "Nombre del banner",  field: "label" as const,    type: "text",  placeholder: "Ej. Banner Superior" },
                  { label: "Posición (código)",   field: "position" as const, type: "text",  placeholder: "Ej. home_top" },
                  { label: "Cliente / Anunciante",field: "client" as const,   type: "text",  placeholder: "Nombre del anunciante" },
                  { label: "URL de destino",      field: "url" as const,      type: "url",   placeholder: "https://..." },
                ].map(({ label, field, type, placeholder }) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-white/70 mb-1">{label}</label>
                    <input
                      type={type}
                      value={editingAd[field] as string}
                      onChange={e => setEditingAd(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
                  <span className="text-sm text-white font-medium">Estado activo</span>
                  <button
                    onClick={() => setEditingAd(prev => prev ? { ...prev, active: !prev.active } : prev)}
                  >
                    {editingAd.active
                      ? <ToggleRight className="w-7 h-7 text-green-400" />
                      : <ToggleLeft  className="w-7 h-7 text-muted-foreground" />
                    }
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setEditingAd(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-muted-foreground hover:text-white transition-all">
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setAdSlots(prev => prev.map(a => a.id === editingAd.id ? editingAd : a));
                    setEditingAd(null);
                    toast({ title: "Espacio actualizado", description: `"${editingAd.label}" guardado correctamente.` });
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-sm font-bold text-primary hover:bg-primary/30 transition-all"
                >
                  Guardar cambios
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
