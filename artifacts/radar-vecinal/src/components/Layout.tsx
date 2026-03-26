import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Map as MapIcon, PlusCircle, Bell, User, Menu, X,
  Shield, Clock, BarChart3, UserX, Settings, ShieldAlert, ChevronRight,
  SlidersHorizontal, LogIn, LogOut, MapPin, ChevronDown, Phone
} from "lucide-react";
import { PanicModal } from "./PanicModal";
import AuthModal from "./AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { useDistrict, DISTRICTS } from "@/contexts/DistrictContext";

interface LayoutProps {
  children: ReactNode;
}

const MAIN_NAV = [
  { href: "/home", icon: Home, label: "Inicio" },
  { href: "/mapa", icon: MapIcon, label: "Mapa" },
  { href: "/reportar", icon: PlusCircle, label: "Reportar", isPrimary: true },
  { href: "/alertas", icon: Bell, label: "Alertas" },
  { href: "/emergencias", icon: Phone, label: "Emergencias" },
];

const SIDE_NAV = [
  { href: "/home",           icon: Home,              label: "Inicio" },
  { href: "/mapa",           icon: MapIcon,            label: "Mapa" },
  { href: "/alertas",        icon: Bell,               label: "Alertas" },
  { href: "/emergencias",    icon: Phone,              label: "Emergencias" },
  { href: "/perfil",         icon: User,               label: "Perfil" },
  { href: "/notificaciones", icon: Bell,               label: "Notificaciones" },
  { href: "/historial",      icon: Clock,              label: "Historial" },
  { href: "/menor-perdido",  icon: UserX,              label: "Personas Extraviadas" },
  { href: "/estadisticas",   icon: BarChart3,          label: "Estadísticas" },
  { href: "/configuracion",  icon: SlidersHorizontal,  label: "Configuración" },
  { href: "/admin",          icon: Settings,           label: "Administración" },
];

// ── District Selector ─────────────────────────────────────────────────────────
function DistrictSelector({ compact = false }: { compact?: boolean }) {
  const { district, setDistrict } = useDistrict();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-muted-foreground hover:text-white transition-colors ${
          compact ? "text-xs py-1 px-2 rounded-lg hover:bg-white/8" : "text-[11px] py-1.5 px-2.5 rounded-xl hover:bg-white/5"
        }`}
      >
        <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
        <span className="font-medium truncate max-w-[120px]">{district}</span>
        <ChevronDown className={`w-3 h-3 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full mt-1 z-50 bg-[#0f1220] border border-white/10 rounded-xl shadow-2xl min-w-[180px] overflow-hidden"
            >
              <div className="p-1.5 flex flex-col gap-0.5">
                {DISTRICTS.map(d => (
                  <button key={d} onClick={() => { setDistrict(d); setOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      district === d
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-white/6 hover:text-white"
                    }`}>
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {d}
                    {district === d && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panicOpen, setPanicOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { user, isLoggedIn, logout } = useAuth();

  const isActive = (href: string) =>
    href === "/home" ? location === href : location.startsWith(href);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 z-40">
        {/* Logo + District */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-[17px] text-white leading-none">Radar Vecinal</h1>
            {/* B-05: District selector in sidebar */}
            <DistrictSelector />
          </div>
        </div>

        {/* New Report Button */}
        <div className="px-4 pt-4 pb-2">
          <Link href="/reportar">
            <div className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_0_20px_hsl(217_100%_55%_/_0.25)] hover:shadow-[0_0_28px_hsl(217_100%_55%_/_0.45)] cursor-pointer">
              <PlusCircle className="w-4 h-4" />
              Nuevo Reporte
            </div>
          </Link>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto hide-scrollbar">
          {SIDE_NAV.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  active
                    ? "bg-white/8 text-white"
                    : "text-muted-foreground hover:bg-white/4 hover:text-white/80"
                }`}>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-primary" : ""}`} />
                  <span className={`text-sm ${active ? "font-semibold" : "font-normal"}`}>{item.label}</span>
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer Zone — B-01: Auth user card */}
        <div className="p-4 border-t border-sidebar-border">
          {isLoggedIn && user ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/6">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.sector}</p>
              </div>
              <button onClick={logout} title="Cerrar sesión"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => setAuthOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/8 text-sm font-medium text-muted-foreground hover:text-white hover:border-white/20 hover:bg-white/4 transition-all">
              <LogIn className="w-4 h-4" />
              Iniciar sesión
            </button>
          )}
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar/95 backdrop-blur-xl border-b border-sidebar-border sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold text-base text-white">Radar Vecinal</span>
        </div>
        <div className="flex items-center gap-2">
          {/* B-05: District selector in mobile header */}
          <DistrictSelector compact />
          {/* B-01: Auth button in mobile header */}
          {isLoggedIn && user ? (
            <Link href="/perfil">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary cursor-pointer">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </Link>
          ) : (
            <button onClick={() => setAuthOpen(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
              <LogIn className="w-4.5 h-4.5" />
            </button>
          )}
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <span className="font-bold text-white">Radar Vecinal</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                {SIDE_NAV.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer ${
                          active ? "bg-white/8 text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white"
                        }`}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                        <span className={`text-sm ${active ? "font-semibold" : ""}`}>{item.label}</span>
                        {active && <ChevronRight className="w-4 h-4 ml-auto text-primary" />}
                      </div>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-sidebar-border flex flex-col gap-2">
                <Link href="/reportar">
                  <div
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold cursor-pointer"
                    onClick={() => setMobileOpen(false)}
                  >
                    <PlusCircle className="w-4 h-4" />
                    Nuevo Reporte
                  </div>
                </Link>

                {/* B-01: Auth in mobile drawer */}
                {isLoggedIn && user ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/6">
                    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.district} · {user.sector}</p>
                    </div>
                    <button onClick={() => { logout(); setMobileOpen(false); }}
                      className="text-red-400/70 hover:text-red-400 p-1 rounded transition-colors">
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setAuthOpen(true); setMobileOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/8 text-sm font-medium text-muted-foreground hover:text-white transition-all">
                    <LogIn className="w-4 h-4" />
                    Iniciar sesión / Registrarse
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-h-screen md:max-h-screen md:overflow-y-auto hide-scrollbar pb-20 md:pb-0">
        <div className="w-full max-w-6xl mx-auto p-4 md:p-6 flex-1">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center bg-sidebar/95 backdrop-blur-xl border-t border-sidebar-border">
        {MAIN_NAV.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);

          if (item.isPrimary) {
            return (
              <Link key={item.href} href={item.href}>
                <div className="relative flex-1 flex flex-col items-center px-5 -top-4 cursor-pointer">
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center border-4 border-background shadow-[0_0_24px_hsl(217_100%_55%_/_0.5)]">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[9px] font-medium text-primary mt-0.5">Reportar</span>
                </div>
              </Link>
            );
          }

          return (
            <Link key={item.href} href={item.href}>
              <div className={`flex-1 flex flex-col items-center justify-center py-2.5 px-3 cursor-pointer transition-colors ${
                active ? "text-primary" : "text-muted-foreground/70 hover:text-white"
              }`}>
                <Icon className={`w-5 h-5 mb-1 ${active ? "fill-primary/10" : ""}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* ── Panic Button ── */}
      <button
        onClick={() => setPanicOpen(true)}
        className="fixed bottom-24 md:bottom-8 right-4 md:right-8 w-14 h-14 md:w-16 md:h-16 rounded-full bg-destructive flex items-center justify-center z-50 panic-glow border-2 border-red-400/30 hover:scale-105 active:scale-95 transition-transform"
        aria-label="Botón de pánico"
      >
        <ShieldAlert className="w-7 h-7 md:w-8 md:h-8 text-white" />
      </button>

      <PanicModal isOpen={panicOpen} onClose={() => setPanicOpen(false)} />

      {/* B-01: Auth Modal */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
