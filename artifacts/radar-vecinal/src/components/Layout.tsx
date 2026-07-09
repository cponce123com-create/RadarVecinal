import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Map as MapIcon, PlusCircle, Bell, User, Menu, X,
  Radar, Clock, BarChart3, UserX, Settings, ShieldAlert, ChevronRight,
  Siren, Phone, LogIn, LogOut, MapPin, ChevronDown,
  Plus,
} from "lucide-react";
import { PanicModal } from "./PanicModal";
import AuthModal from "./AuthModal";
import ThemeToggle from "./ThemeToggle";
import OfflineBanner from "./OfflineBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useDistrict } from "@/contexts/DistrictContext";
import DistrictPicker from "@/components/DistrictPicker";

interface LayoutProps {
  children: ReactNode;
}

const MAIN_NAV = [
  { href: "/home", icon: LayoutDashboard, label: "Inicio" },
  { href: "/mapa", icon: MapIcon, label: "Mapa" },
  { href: "/reportar", icon: PlusCircle, label: "Reportar", isPrimary: true },
  { href: "/alertas", icon: Siren, label: "Alertas" },
  { href: "/emergencias", icon: Phone, label: "Emergencias" },
];

const SIDE_NAV = [
  { href: "/home",           icon: LayoutDashboard, label: "Inicio" },
  { href: "/mapa",           icon: MapIcon,         label: "Mapa" },
  { href: "/alertas",        icon: Siren,           label: "Alertas" },
  { href: "/reportar",       icon: PlusCircle,      label: "Reportar" },
  { href: "/emergencias",    icon: Phone,           label: "Emergencias" },
  { href: "/notificaciones", icon: Bell,            label: "Notificaciones" },
  { href: "/historial",      icon: Clock,           label: "Historial" },
  { href: "/menor-perdido",  icon: UserX,           label: "Personas Extraviadas" },
  { href: "/estadisticas",   icon: BarChart3,       label: "Estadísticas" },
  { href: "/perfil",         icon: User,            label: "Perfil" },
  { href: "/admin",          icon: Settings,        label: "Administración" },
];

// Título dinámico del topbar según la ruta
const TITLES: { match: (l: string) => boolean; title: string; sub: string }[] = [
  { match: l => l.startsWith("/mapa"),          title: "Mapa de Incidentes",  sub: "GEOLOCALIZACIÓN · DISTRITO" },
  { match: l => l.startsWith("/alertas"),       title: "Alertas de Pánico",   sub: "MONITOREO · EMERGENCIAS" },
  { match: l => l.startsWith("/reportar"),      title: "Reportar Incidente",  sub: "NUEVO REPORTE" },
  { match: l => l.startsWith("/emergencias"),   title: "Emergencias",         sub: "LÍNEAS DIRECTAS" },
  { match: l => l.startsWith("/estadisticas"),  title: "Estadísticas",        sub: "ANALÍTICA · DISTRITO" },
  { match: l => l.startsWith("/admin"),         title: "Centro de Control",   sub: "GESTIÓN · MODERACIÓN" },
  { match: l => l.startsWith("/perfil"),        title: "Mi Perfil",           sub: "CUENTA · VECINO" },
  { match: l => l.startsWith("/notificaciones"),title: "Notificaciones",      sub: "AVISOS · RED VECINAL" },
  { match: l => l.startsWith("/historial"),     title: "Historial",           sub: "REGISTRO · INCIDENTES" },
  { match: l => l.startsWith("/menor-perdido"), title: "Personas Extraviadas",sub: "BÚSQUEDA ACTIVA" },
];

function DistrictSelector({ compact = false }: { compact?: boolean }) {
  const {
    currentDistrict, districtInfo, setDistrict,
    availableDistricts, locatedDistrict, detectingLocation, isLocked, needsSelection,
  } = useDistrict();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Admin/moderator: distrito fijo, sin dropdown
  if (isLocked) {
    return (
      <div className={`flex items-center gap-1.5 text-muted-foreground ${
        compact ? "text-xs py-1 px-2" : "text-[11px] py-1 mt-0.5"
      }`}>
        <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
        <span className="font-medium truncate max-w-[130px]">{currentDistrict}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 border border-white/10">🔒</span>
      </div>
    );
  }

  const label = detectingLocation && !districtInfo
    ? "Detectando..."
    : currentDistrict || "Elegir distrito";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 transition-colors ${
          needsSelection ? "text-amber-300 hover:text-amber-200" : "text-muted-foreground hover:text-white"
        } ${compact ? "text-xs py-1 px-2 rounded-lg hover:bg-white/8" : "text-[11px] py-1 mt-0.5"}`}
      >
        <MapPin className={`w-3 h-3 flex-shrink-0 ${needsSelection ? "text-amber-300" : "text-primary"}`} />
        <span className="font-medium truncate max-w-[130px]">{label}</span>
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
              className="absolute left-0 top-full mt-1 z-50 bg-popover border border-white/10 rounded-xl shadow-2xl min-w-[230px] overflow-hidden"
            >
              <div className="p-1.5 flex flex-col gap-0.5">
                <p className="px-3 pt-1.5 pb-1 text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  Tus distritos (máx. 2)
                </p>
                {availableDistricts.map(d => {
                  const isCurrent = districtInfo?.id === d.id;
                  const isLocated = locatedDistrict?.id === d.id;
                  return (
                    <button key={d.id} onClick={() => { setDistrict(d.slug); setOpen(false); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        isCurrent
                          ? "bg-primary/15 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-white/6 hover:text-white"
                      }`}>
                      <span className="text-xs flex-shrink-0">{isLocated ? "📍" : "⭐"}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{d.name}</span>
                        <span className="block text-[9px] text-muted-foreground/60 truncate">
                          {isLocated ? "Tu ubicación actual" : `${d.province}, ${d.department}`}
                        </span>
                      </span>
                      {isCurrent && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                    </button>
                  );
                })}
                {availableDistricts.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {detectingLocation ? "Detectando tu ubicación..." : "Sin distrito detectado. Elige uno:"}
                  </p>
                )}
                <div className="h-px bg-white/6 my-0.5" />
                <button onClick={() => { setPickerOpen(true); setOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left text-primary hover:bg-primary/10 transition-colors font-medium">
                  <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                  {availableDistricts.some(d => locatedDistrict?.id !== d.id) ? "Cambiar distrito manual…" : "Añadir otro distrito…"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <DistrictPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panicOpen, setPanicOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (location.includes("auth=login")) {
      setAuthOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location]);

  const { user, logout } = useAuth();
  const { currentDistrict } = useDistrict();
  const isActive = (href: string) =>
    href === "/home" ? location === href || location === "/" : location.startsWith(href);
  const baseHead = TITLES.find(t => t.match(location)) ?? { title: "Panel de Inicio", sub: "DASHBOARD · TIEMPO REAL" };
  // UX5: el subtítulo refleja el distrito activo (multi-tenant) en vez de un valor fijo.
  const head = currentDistrict
    ? { ...baseHead, sub: baseHead.sub.replace(/·\s*DISTRITO\b/i, `· ${currentDistrict.toUpperCase()}`) }
    : baseHead;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row relative">
      {/* A11y: saltar al contenido (visible solo al enfocar con teclado) */}
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-white focus:font-semibold focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      {/* textura de grid global */}
      <div className="rv-grid pointer-events-none fixed inset-0 opacity-50 z-0" />

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-sidebar/90 backdrop-blur-xl border-r border-sidebar-border h-screen sticky top-0 z-30">
        <div className="flex items-center gap-3 px-5 py-[18px] border-b border-white/5">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#1b4fd8] flex items-center justify-center shadow-[0_6px_20px_hsl(221_100%_59%_/_0.4),inset_0_1px_0_rgba(255,255,255,0.25)]">
            <Radar className="w-[22px] h-[22px] text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-base text-white tracking-tight leading-none">Radar Vecinal</div>
            <DistrictSelector />
          </div>
        </div>

        <div className="px-3.5 pt-4 pb-1.5">
          <Link href="/reportar">
            <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[13px] bg-gradient-to-br from-primary to-[#1e52d6] text-white font-semibold text-[13.5px] cursor-pointer transition-transform hover:-translate-y-px shadow-[0_8px_22px_hsl(221_100%_59%_/_0.35),inset_0_1px_0_rgba(255,255,255,0.2)]">
              <PlusCircle className="w-4 h-4" /> Nuevo Reporte
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto hide-scrollbar">
          {SIDE_NAV.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-[11px] transition-all duration-150 cursor-pointer ${
                  active ? "bg-primary/15 text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white/80"
                }`}>
                  <Icon className={`w-[17px] h-[17px] flex-shrink-0 ${active ? "text-[#5b8dff]" : "text-[#6b7488]"}`} />
                  <span className={`text-[13.5px] ${active ? "font-semibold" : "font-normal"}`}>{item.label}</span>
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 pb-1"><ThemeToggle /></div>
        <div className="p-3.5 border-t border-white/5">
          {user ? (
            <div className="flex items-center gap-3 p-3 rounded-[13px] bg-white/[0.035] border border-white/6">
              <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/30 flex items-center justify-center text-[13px] font-bold text-[#5b8dff] flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10.5px] text-muted-foreground truncate">{user.sector}</p>
              </div>
              <button onClick={logout} title="Cerrar sesión"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                <LogOut className="w-[15px] h-[15px]" />
              </button>
            </div>
          ) : (
            <button onClick={() => setAuthOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[13px] border border-white/8 text-sm font-medium text-muted-foreground hover:text-white hover:border-white/20 hover:bg-white/4 transition-all">
              <LogIn className="w-4 h-4" /> Iniciar sesión
            </button>
          )}
        </div>
      </aside>

      {/* ── Header móvil ── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar/95 backdrop-blur-xl border-b border-sidebar-border sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[#1b4fd8] flex items-center justify-center">
            <Radar className="w-[18px] h-[18px] text-white" />
          </div>
          <span className="font-display font-bold text-base text-white">Radar Vecinal</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <DistrictSelector compact />
          {user ? (
            <Link href="/perfil">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-[#5b8dff] cursor-pointer">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </Link>
          ) : (
            <button onClick={() => setAuthOpen(true)} aria-label="Iniciar sesión" className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
              <LogIn className="w-[18px] h-[18px]" />
            </button>
          )}
          <button onClick={() => setMobileOpen(true)} aria-label="Abrir menú de navegación" aria-expanded={mobileOpen} className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Drawer móvil ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50 md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col md:hidden pt-[env(safe-area-inset-top,0px)]"
              style={{ willChange: "transform", overscrollBehavior: "contain" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-[#1b4fd8] flex items-center justify-center">
                    <Radar className="w-[18px] h-[18px] text-white" />
                  </div>
                  <span className="font-display font-bold text-white">Radar Vecinal</span>
                </div>
                <button onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" className="p-1.5 rounded-lg text-muted-foreground hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                {SIDE_NAV.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
                      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer min-h-[44px] ${
                        active ? "bg-primary/15 text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white"
                      }`} onClick={() => setMobileOpen(false)}>
                        <Icon className={`w-5 h-5 ${active ? "text-[#5b8dff]" : ""}`} />
                        <span className={`text-sm ${active ? "font-semibold" : ""}`}>{item.label}</span>
                        {active && <ChevronRight className="w-4 h-4 ml-auto text-primary" />}
                      </div>
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-sidebar-border flex flex-col gap-2">
                <Link href="/reportar">
                  <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-primary to-[#1e52d6] text-white font-semibold cursor-pointer" onClick={() => setMobileOpen(false)}>
                    <PlusCircle className="w-4 h-4" /> Nuevo Reporte
                  </div>
                </Link>
                {user ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/6">
                    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-[#5b8dff] flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.district} · {user.sector}</p>
                    </div>
                    <button onClick={() => { logout(); setMobileOpen(false); }} className="text-red-400/70 hover:text-red-400 p-1 rounded transition-colors">
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setAuthOpen(true); setMobileOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/8 text-sm font-medium text-muted-foreground hover:text-white transition-all">
                    <LogIn className="w-4 h-4" /> Iniciar sesión / Registrarse
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Contenido principal ── */}
      <main className="flex-1 flex flex-col min-h-screen md:max-h-screen md:overflow-y-auto hide-scrollbar pb-20 md:pb-0 relative z-10">
        {/* Topbar desktop */}
        <div className="hidden md:flex items-center justify-between px-7 py-4 sticky top-0 z-20 bg-background/70 backdrop-blur-xl border-b border-white/5">
          <div>
            <div className="font-display text-[19px] font-bold text-white tracking-tight">{head.title}</div>
            <div className="text-[11.5px] text-muted-foreground label-mono mt-0.5">{head.sub}</div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-[7px] rounded-[10px] bg-success/10 border border-success/25">
              <span className="w-[7px] h-[7px] rounded-full bg-success status-blink shadow-[0_0_8px_hsl(142_71%_55%)]" />
              <span className="text-[11px] text-success font-medium label-mono">RED ACTIVA</span>
            </div>
            <Link href="/notificaciones" aria-label="Notificaciones">
              <div className="w-[38px] h-[38px] rounded-[11px] bg-white/4 border border-white/7 flex items-center justify-center relative cursor-pointer hover:bg-white/8 transition-colors">
                <Bell className="w-[17px] h-[17px] text-[#c3c9d6]" aria-hidden="true" />
                <span className="absolute top-2 right-[9px] w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_6px_hsl(0_84%_60%)]" />
              </div>
            </Link>
          </div>
        </div>

        <OfflineBanner />
        <div id="contenido-principal" tabIndex={-1} className="w-full max-w-[1180px] mx-auto px-4 md:px-7 py-5 md:py-6 flex-1 focus:outline-none">
          {children}
        </div>
      </main>

      {/* ── Bottom nav móvil ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-evenly bg-sidebar/95 backdrop-blur-xl border-t border-sidebar-border pb-[env(safe-area-inset-bottom,0px)]">
        {MAIN_NAV.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          if (item.isPrimary) {
            return (
              <Link key={item.href} href={item.href} className="flex-1 flex justify-center">
                <div className="flex flex-col items-center cursor-pointer mt-[-12px]">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-[#1e52d6] flex items-center justify-center border-[3px] border-background shadow-[0_0_20px_hsl(221_100%_59%_/_0.45)]">
                    <Icon className="w-5.5 h-5.5 text-white" />
                  </div>
                  <span className="text-[9px] font-medium text-primary mt-[3px]">Reportar</span>
                </div>
              </Link>
            );
          }
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center py-2 cursor-pointer transition-colors min-h-[44px] ${
                active ? "text-primary" : "text-muted-foreground/70 hover:text-white"
              }`}>
              <Icon className="w-5 h-5 mb-[3px]" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Botón de pánico ── */}
      <button onClick={() => setPanicOpen(true)}
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(2rem+env(safe-area-inset-bottom,0px))] right-4 md:right-8 w-14 h-14 md:w-[62px] md:h-[62px] rounded-full bg-gradient-to-br from-destructive to-red-600 flex items-center justify-center z-50 panic-glow border-2 border-red-400/40 hover:scale-105 active:scale-95 transition-transform min-h-[44px] min-w-[44px]"
        aria-label="Botón de pánico">
        <ShieldAlert className="w-7 h-7 md:w-8 md:h-8 text-white" />
      </button>

      <PanicModal isOpen={panicOpen} onClose={() => setPanicOpen(false)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
