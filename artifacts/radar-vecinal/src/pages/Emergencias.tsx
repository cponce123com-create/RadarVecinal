import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, Flame, Heart, ShieldAlert, AlertTriangle,
  Phone, UserX, Zap, Search
} from "lucide-react";
import { useDistrict } from "@/contexts/DistrictContext";

interface EmergencyContact {
  name: string;
  number: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  category: string;
  description: string;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    name: "Policía Nacional",
    number: "105",
    icon: Shield,
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.25)",
    category: "seguridad",
    description: "Emergencias policiales, robos, asaltos",
  },
  {
    name: "Bomberos",
    number: "116",
    icon: Flame,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.25)",
    category: "incendio",
    description: "Incendios, rescates, emergencias",
  },
  {
    name: "SAMU / Ambulancia",
    number: "106",
    icon: Heart,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.25)",
    category: "salud",
    description: "Emergencias médicas, accidentes",
  },
  {
    name: "Serenazgo",
    number: "0800-00-968",
    icon: ShieldAlert,
    color: "#f97316",
    bg: "rgba(249,115,22,0.10)",
    border: "rgba(249,115,22,0.25)",
    category: "seguridad",
    description: "Seguridad ciudadana local",
  },
  {
    name: "Defensa Civil",
    number: "115",
    icon: AlertTriangle,
    color: "#eab308",
    bg: "rgba(234,179,8,0.10)",
    border: "rgba(234,179,8,0.25)",
    category: "desastre",
    description: "Desastres naturales, deslizamientos",
  },
  {
    name: "Línea de la Mujer",
    number: "100",
    icon: Phone,
    color: "#ec4899",
    bg: "rgba(236,72,153,0.10)",
    border: "rgba(236,72,153,0.25)",
    category: "violencia",
    description: "Violencia familiar y de género",
  },
  {
    name: "Niños y Adolescentes",
    number: "137",
    icon: UserX,
    color: "#a855f7",
    bg: "rgba(168,85,247,0.10)",
    border: "rgba(168,85,247,0.25)",
    category: "infancia",
    description: "Maltrato infantil, explotación",
  },
  {
    name: "Bomberos Voluntarios",
    number: "116",
    icon: Zap,
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.25)",
    category: "incendio",
    description: "Apoyo en incendios y rescates",
  },
];

const CATEGORIES = [
  { id: "todos",     label: "Todos" },
  { id: "seguridad", label: "Seguridad" },
  { id: "salud",     label: "Salud" },
  { id: "incendio",  label: "Incendio" },
  { id: "violencia", label: "Violencia" },
  { id: "desastre",  label: "Desastre" },
  { id: "infancia",  label: "Infancia" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3 } }),
};

export default function Emergencias() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("todos");
  const { currentDistrict, province } = useDistrict();

  const filtered = EMERGENCY_CONTACTS.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.number.includes(search) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "todos" || c.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-2xl mx-auto pb-8 flex flex-col gap-5 rv-in">

      {/* Header */}
      <div>
        <h2 className="font-display text-[22px] font-bold text-white tracking-tight flex items-center gap-2">
          <Phone className="w-6 h-6 text-primary" />
          Números de Emergencia
        </h2>
        <p className="text-[13px] text-muted-foreground mt-1">
          Contactos de emergencia para {currentDistrict ? `${currentDistrict}${province ? `, ${province}` : ""}` : "tu distrito"}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar servicio o número..."
          className="w-full bg-card border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeCategory === cat.id
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-white/[0.04] text-muted-foreground border border-white/8 hover:bg-white/10 hover:text-white"
            }`}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Contacts grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No se encontraron resultados</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((contact, i) => {
            const Icon = contact.icon;
            return (
              <motion.div key={contact.name} custom={i} variants={cardVariants} initial="hidden" animate="visible"
                className="rounded-2xl bg-gradient-to-b from-card to-sidebar border p-4 flex items-center gap-4"
                style={{ borderColor: contact.border }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${contact.color}18`, border: `1.5px solid ${contact.color}44` }}>
                  <Icon className="w-6 h-6" style={{ color: contact.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{contact.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{contact.description}</p>
                  <p className="text-lg font-black mt-1 tabular-nums" style={{ color: contact.color }}>
                    {contact.number}
                  </p>
                </div>
                <a href={`tel:${contact.number}`}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95 hover:opacity-90"
                  style={{ background: contact.color }}>
                  <Phone className="w-4 h-4" />
                  Llamar
                </a>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-card border border-white/6">
        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          En caso de emergencia inmediata, llama directamente al número correspondiente.
          Estos contactos son de cobertura nacional y pueden derivarte al servicio local.
        </p>
      </div>
    </div>
  );
}
