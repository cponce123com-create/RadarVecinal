/**
 * DistrictPicker — Selector en cascada: Departamento → Provincia → Distrito.
 *
 * Se usa para elegir el distrito MANUAL (el segundo distrito del usuario,
 * además del detectado por ubicación). Se construye dinámicamente a partir
 * del catálogo de distritos activos del API, así que al dar de alta una
 * nueva municipalidad aparece sola, sin tocar código.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, ChevronRight, Check, Building2, Map as MapIcon, Landmark } from "lucide-react";
import { useDistrict } from "@/contexts/DistrictContext";

interface DistrictPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DistrictPicker({ isOpen, onClose }: DistrictPickerProps) {
  const { districts, manualDistrict, locatedDistrict, setManualDistrict } = useDistrict();

  const [dept, setDept] = useState<string | null>(null);
  const [prov, setProv] = useState<string | null>(null);

  // ── Construir cascada desde el catálogo ──
  const departments = useMemo(
    () => [...new Set(districts.map(d => d.department))].sort((a, b) => a.localeCompare(b, "es")),
    [districts],
  );
  const provinces = useMemo(
    () => dept
      ? [...new Set(districts.filter(d => d.department === dept).map(d => d.province))].sort((a, b) => a.localeCompare(b, "es"))
      : [],
    [districts, dept],
  );
  const options = useMemo(
    () => (dept && prov)
      ? districts.filter(d => d.department === dept && d.province === prov).sort((a, b) => a.name.localeCompare(b.name, "es"))
      : [],
    [districts, dept, prov],
  );

  const reset = () => { setDept(null); setProv(null); };
  const handleClose = () => { reset(); onClose(); };

  const handlePick = (slug: string) => {
    setManualDistrict(slug);
    handleClose();
  };

  // Nivel actual de la cascada: 1=departamento, 2=provincia, 3=distrito
  const level = !dept ? 1 : !prov ? 2 : 3;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(5,8,15,0.85)", backdropFilter: "blur(12px)" }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-md bg-card border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: "85dvh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/6 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Elegir distrito
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Este será tu segundo distrito, además del detectado por tu ubicación.
                </p>
              </div>
              <button onClick={handleClose} aria-label="Cerrar"
                className="w-8 h-8 rounded-full bg-white/6 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Breadcrumb de la cascada */}
            <div className="flex items-center gap-1 px-5 py-2.5 text-[11px] border-b border-white/6 flex-shrink-0 overflow-x-auto hide-scrollbar">
              <button onClick={reset}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg whitespace-nowrap transition-colors ${
                  level === 1 ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:text-white"
                }`}>
                <Landmark className="w-3 h-3" /> {dept ?? "Departamento"}
              </button>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
              <button onClick={() => dept && setProv(null)} disabled={!dept}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg whitespace-nowrap transition-colors disabled:opacity-40 ${
                  level === 2 ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:text-white"
                }`}>
                <Building2 className="w-3 h-3" /> {prov ?? "Provincia"}
              </button>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
              <span className={`flex items-center gap-1 px-2 py-1 whitespace-nowrap ${level === 3 ? "text-primary font-semibold" : "text-muted-foreground/50"}`}>
                <MapIcon className="w-3 h-3" /> Distrito
              </span>
            </div>

            {/* Lista del nivel actual */}
            <div className="flex-1 overflow-y-auto p-3">
              {districts.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-10">
                  No hay distritos disponibles. Revisa tu conexión.
                </p>
              )}

              {level === 1 && departments.map(d => (
                <button key={d} onClick={() => setDept(d)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm text-white hover:bg-white/6 transition-colors">
                  <span className="flex items-center gap-2.5">
                    <Landmark className="w-4 h-4 text-muted-foreground" /> {d}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </button>
              ))}

              {level === 2 && provinces.map(p => (
                <button key={p} onClick={() => setProv(p)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm text-white hover:bg-white/6 transition-colors">
                  <span className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-muted-foreground" /> {p}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </button>
              ))}

              {level === 3 && options.map(d => {
                const isManual = manualDistrict?.id === d.id;
                const isLocated = locatedDistrict?.id === d.id;
                return (
                  <button key={d.id} onClick={() => handlePick(d.slug)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm transition-colors ${
                      isManual ? "bg-primary/12 text-primary font-semibold" : "text-white hover:bg-white/6"
                    }`}>
                    <span className="flex items-center gap-2.5">
                      <MapPin className={`w-4 h-4 ${isManual ? "text-primary" : "text-muted-foreground"}`} />
                      {d.name}
                      {isLocated && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          📍 Tu ubicación
                        </span>
                      )}
                    </span>
                    {isManual && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}

              {level === 3 && options.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-10">
                  No hay distritos activos en esta provincia todavía.
                </p>
              )}
            </div>

            {/* Nota informativa */}
            <div className="px-5 py-3 border-t border-white/6 flex-shrink-0">
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                Puedes seguir máximo 2 distritos: el de tu ubicación actual y uno elegido aquí.
                Elegir uno nuevo reemplaza al anterior.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DistrictPicker;
