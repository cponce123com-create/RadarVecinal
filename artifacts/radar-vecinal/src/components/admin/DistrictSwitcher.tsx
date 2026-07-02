import { useState, useRef, useEffect } from "react";
import { ChevronDown, Shield, MapPin } from "lucide-react";
import { useDistrict } from "@/contexts/DistrictContext";
import { getEffectiveSuperAdmin } from "./panelMode";

/**
 * DistrictSwitcher — Selector de distrito visible solo para super_admin.
 * Para usuarios municipales (admin/moderator) muestra el badge fijo.
 */
interface Props {
  isSuperAdmin: boolean;
}

export default function DistrictSwitcher({ isSuperAdmin }: Props) {
  const effectiveSuperAdmin = getEffectiveSuperAdmin(isSuperAdmin);
  const { currentDistrict, districtInfo, districts, setDistrict } = useDistrict();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!effectiveSuperAdmin) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
        <Shield className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-primary">
          📍 {currentDistrict}
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-all"
      >
        <MapPin className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs font-semibold text-accent">
          {districtInfo?.name ?? "Seleccionar distrito"}
        </span>
        <ChevronDown className={`w-3 h-3 text-accent/70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-[#0f1219] border border-white/10 shadow-2xl z-50 overflow-hidden">
          <div className="p-1.5">
            <p className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
              Cambiar distrito
            </p>
            {districts.map(d => (
              <button
                key={d.id}
                onClick={() => { setDistrict(d.slug); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors ${
                  d.id === districtInfo?.id
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-white hover:bg-white/5"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  d.id === districtInfo?.id ? "bg-accent" : "bg-white/20"
                }`} />
                <span className="truncate">{d.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/50">{d.province}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
