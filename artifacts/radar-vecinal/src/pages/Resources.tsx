import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, MapPin, Globe, Shield, Heart, Truck, Building2, Hospital, ExternalLink, Loader2 } from "lucide-react";
import { useDistrict } from "@/contexts/DistrictContext";

interface Resource {
  id: string;
  type: string;
  name: string;
  phone: string | null;
  address: string | null;
  url: string | null;
  description: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  police:    { label: "Comisaría",     icon: Shield,    color: "#3b82f6" },
  fire:      { label: "Bomberos",      icon: Truck,     color: "#ef4444" },
  hospital:  { label: "Salud",         icon: Hospital,  color: "#22c55e" },
  helpline:  { label: "Línea de ayuda",icon: Heart,     color: "#a855f7" },
  other:     { label: "Otro",          icon: Building2, color: "#f59e0b" },
};

export default function Resources() {
  const { currentDistrictId, currentDistrict } = useDistrict();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentDistrictId) return;
    setLoading(true);
    fetch(`/api/district-resources?districtId=${currentDistrictId}`)
      .then(r => r.json())
      .then(d => setResources(d.resources ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentDistrictId]);

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto pb-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-1">Recursos de {currentDistrict}</h1>
        <p className="text-sm text-muted-foreground">Teléfonos y servicios útiles para tu comunidad</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      ) : resources.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-2xl bg-card border border-white/5 text-center"
        >
          <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            No hay recursos registrados para este distrito todavía.
          </p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          {resources.map((r, i) => {
            const cfg = TYPE_CONFIG[r.type] ?? TYPE_CONFIG.other;
            const Icon = cfg.icon;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-card border border-white/5 flex items-start gap-3"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${cfg.color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground/70 mb-2">{cfg.label}</p>

                  {r.description && (
                    <p className="text-xs text-muted-foreground/60 mb-2">{r.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {r.phone && (
                      <a href={`tel:${r.phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                      >
                        <Phone className="w-3 h-3" /> {r.phone}
                      </a>
                    )}
                    {r.address && (
                      <a href={`https://www.google.com/maps/search/${encodeURIComponent(r.address)}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                      >
                        <MapPin className="w-3 h-3" /> Ubicación
                      </a>
                    )}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
                      >
                        <Globe className="w-3 h-3" /> Sitio web <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
