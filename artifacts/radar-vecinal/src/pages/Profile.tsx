import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, Award, Settings, Bell, Map, Clock, ChevronRight, Star } from "lucide-react";

const user = {
  name: "Carlos Mendoza",
  email: "carlos.m@example.com",
  role: "Vecino Verificado",
  sector: "San Miguel Centro",
  joinDate: "Ene 2024",
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
    sub: "Incidentes en tu zona",
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
    sub: "Alertas y avisos del sistema",
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
  return (
    <div className="max-w-2xl mx-auto pb-8 flex flex-col gap-5">
      <h2 className="text-2xl font-bold text-white">Tu Perfil</h2>

      {/* Profile Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden p-6 rounded-2xl bg-card border border-white/5"
      >
        {/* Ambient glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
          {/* Letter Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/40 to-primary/10 border-2 border-primary/30 flex items-center justify-center shadow-[0_0_24px_hsl(217_100%_55%_/_0.2)]">
              <span className="text-3xl font-bold text-white">{user.initials}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-card" />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1 justify-center sm:justify-start">
              <h1 className="text-2xl font-bold text-white">{user.name}</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold border border-primary/25 w-max mx-auto sm:mx-0">
                <Shield className="w-3 h-3" />
                {user.role}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{user.sector} · Desde {user.joinDate}</p>

            {/* Stats row */}
            <div className="flex justify-center sm:justify-start gap-3 flex-wrap">
              {[
                { value: user.reportsCount, label: "Reportes" },
                { value: user.confirmedCount, label: "Confirmaciones" },
                { value: `${user.trustScore}%`, label: "Confiabilidad", green: true },
              ].map(s => (
                <div key={s.label} className="px-4 py-2 rounded-xl bg-background border border-white/5 text-center min-w-[88px]">
                  <p className={`text-xl font-bold ${s.green ? "text-green-400" : "text-white"}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust badge */}
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-muted-foreground">
            Contribuyente activo del distrito. Tus reportes ayudan a mantener la seguridad de San Miguel.
          </span>
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

      {/* Danger Zone */}
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
