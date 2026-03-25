import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, Award, Settings, Bell, Map, Clock, ChevronRight, Star, CreditCard, CheckCircle2, AlertCircle, Lock, Eye, EyeOff } from "lucide-react";

const user = {
  name: "Carlos Mendoza",
  email: "carlos.m@gmail.com",
  dni: "42516789",
  role: "Vecino Verificado",
  sector: "San Ramón Centro",
  joinDate: "Ene 2025",
  reportsCount: 14,
  confirmedCount: 89,
  trustScore: 98,
  initials: "CM",
};

const MENU_ITEMS = [
  {
    href: "/historial",
    icon: Clock,
    label: "Mis Reportes",
    sub: "Ver todos tus aportes",
    accent: "text-primary",
    accentBg: "bg-primary/12",
  },
  {
    href: "/mapa",
    icon: Map,
    label: "Mapa del Distrito",
    sub: "Incidentes en San Ramón",
    accent: "text-green-400",
    accentBg: "bg-green-500/12",
  },
  {
    href: "/admin",
    icon: Shield,
    label: "Panel de Control",
    sub: "Administración (demo)",
    accent: "text-accent",
    accentBg: "bg-accent/12",
  },
  {
    href: null,
    icon: Bell,
    label: "Notificaciones",
    sub: "Alertas sonoras y avisos",
    accent: "text-yellow-400",
    accentBg: "bg-yellow-500/12",
    badge: "Próximamente",
  },
  {
    href: null,
    icon: Settings,
    label: "Configuración",
    sub: "Privacidad y preferencias",
    accent: "text-muted-foreground",
    accentBg: "bg-white/6",
    badge: "Próximamente",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }),
};

export default function Profile() {
  const [dniVisible, setDniVisible] = useState(false);
  const [editDni, setEditDni] = useState(false);
  const [dniInput, setDniInput] = useState(user.dni);
  const [dniSaved, setDniSaved] = useState(true);
  const [dniError, setDniError] = useState("");

  const handleDniSave = () => {
    if (!/^\d{8}$/.test(dniInput)) {
      setDniError("El DNI debe tener exactamente 8 dígitos numéricos.");
      return;
    }
    setDniError("");
    setDniSaved(true);
    setEditDni(false);
  };

  const maskedDni = `••••${user.dni.slice(-4)}`;

  return (
    <div className="max-w-2xl mx-auto pb-8 flex flex-col gap-5">
      <h2 className="text-2xl font-bold text-white">Tu Perfil</h2>

      {/* Profile Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden p-5 sm:p-6 rounded-2xl bg-card border border-white/5"
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
          {/* Letter Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-primary/40 to-primary/10 border-2 border-primary/30 flex items-center justify-center shadow-[0_0_24px_hsl(217_100%_55%_/_0.2)]">
              <span className="text-2xl sm:text-3xl font-bold text-white">{user.initials}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-card" />
          </div>

          <div className="flex-1 text-center sm:text-left w-full">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 justify-center sm:justify-start">
              <h1 className="text-xl sm:text-2xl font-bold text-white">{user.name}</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold border border-primary/25 w-max mx-auto sm:mx-0">
                <Shield className="w-3 h-3" />
                {user.role}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{user.sector} · Desde {user.joinDate}</p>

            {/* Stats row */}
            <div className="flex justify-center sm:justify-start gap-2 sm:gap-3 flex-wrap">
              {[
                { value: user.reportsCount,        label: "Reportes" },
                { value: user.confirmedCount,       label: "Validaciones" },
                { value: `${user.trustScore}%`,     label: "Confiabilidad", green: true },
              ].map(s => (
                <div key={s.label} className="px-3 sm:px-4 py-2 rounded-xl bg-background border border-white/5 text-center min-w-[76px] sm:min-w-[88px]">
                  <p className={`text-lg sm:text-xl font-bold ${s.green ? "text-green-400" : "text-white"}`}>{s.value}</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />
          <span className="text-xs text-muted-foreground">
            Contribuyente activo de San Ramón, Chanchamayo. Tus reportes ayudan a mantener la seguridad del distrito.
          </span>
        </div>
      </motion.div>

      {/* DNI Verification Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="p-4 sm:p-5 rounded-2xl bg-card border border-white/5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/12 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Verificación de Identidad</h3>
            <p className="text-[11px] text-muted-foreground">Tu DNI es tu identificador único en el sistema</p>
          </div>
          {dniSaved && !editDni && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400 bg-green-500/12 px-2 py-0.5 rounded-full border border-green-500/20 flex-shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              Verificado
            </span>
          )}
        </div>

        {/* DNI Field */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">
              Número de DNI peruano
            </label>
            {editDni ? (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={dniInput}
                    onChange={e => { setDniInput(e.target.value.replace(/\D/g, "").slice(0, 8)); setDniError(""); }}
                    placeholder="Ej: 42516789"
                    maxLength={8}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors font-mono tracking-wider"
                  />
                  <Lock className="absolute right-3 top-3.5 w-4 h-4 text-muted-foreground/40" />
                </div>
                {dniError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {dniError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDniSave}
                    className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all"
                  >
                    Guardar DNI
                  </button>
                  <button
                    onClick={() => { setEditDni(false); setDniInput(user.dni); setDniError(""); }}
                    className="px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-white hover:bg-white/6 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-background border border-white/8">
                  <span className="font-mono text-sm text-white tracking-widest flex-1">
                    {dniVisible ? user.dni : maskedDni}
                  </span>
                  <button
                    onClick={() => setDniVisible(v => !v)}
                    className="text-muted-foreground hover:text-white transition-colors flex-shrink-0"
                  >
                    {dniVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => setEditDni(true)}
                  className="px-3 py-2.5 rounded-xl border border-white/10 text-xs text-muted-foreground hover:text-white hover:bg-white/6 transition-all whitespace-nowrap"
                >
                  Editar
                </button>
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">Correo electrónico</label>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-white/8">
                <span className="text-sm text-white/70 truncate">{user.email}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wide">Sector</label>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-white/8">
                <span className="text-sm text-white/70 truncate">{user.sector}</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/50 flex items-start gap-1.5">
            <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
            Tu DNI es confidencial y solo lo ven los administradores del sistema. Nunca se muestra públicamente.
          </p>
        </div>
      </motion.div>

      {/* Menu Items */}
      <div className="flex flex-col gap-2">
        {MENU_ITEMS.map((item, i) => {
          const Icon = item.icon;
          const inner = (
            <motion.div
              key={item.label}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className={`flex items-center gap-4 p-4 rounded-xl bg-card border border-white/5 transition-all ${
                item.href ? "hover:border-white/10 hover:bg-white/[0.025] cursor-pointer" : "opacity-70 cursor-default"
              } group`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.accentBg}`}>
                <Icon className={`w-5 h-5 ${item.accent}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
              {item.badge ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/6 text-muted-foreground border border-white/8 flex-shrink-0">
                  {item.badge}
                </span>
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
              )}
            </motion.div>
          );
          return item.href ? <Link href={item.href} key={item.label}>{inner}</Link> : <div key={item.label}>{inner}</div>;
        })}
      </div>

      {/* Sign out */}
      <motion.div custom={MENU_ITEMS.length} variants={cardVariants} initial="hidden" animate="visible">
        <button className="w-full flex items-center gap-4 p-4 rounded-xl border border-red-900/25 bg-red-950/15 hover:bg-red-950/25 hover:border-red-800/40 transition-all group text-left">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/12">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">Cerrar Sesión</p>
            <p className="text-xs text-muted-foreground">Salir de tu cuenta actual</p>
          </div>
        </button>
      </motion.div>
    </div>
  );
}
