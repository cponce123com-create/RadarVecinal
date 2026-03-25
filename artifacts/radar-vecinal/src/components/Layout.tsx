import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Map as MapIcon, PlusCircle, Bell, User, Menu, X,
  Shield, Clock, BarChart3, UserX, Settings, ShieldAlert, ChevronRight
} from "lucide-react";
import { PanicModal } from "./PanicModal";

interface LayoutProps {
  children: ReactNode;
}

const MAIN_NAV = [
  { href: "/home", icon: Home, label: "Inicio" },
  { href: "/mapa", icon: MapIcon, label: "Mapa" },
  { href: "/reportar", icon: PlusCircle, label: "Reportar", isPrimary: true },
  { href: "/alertas", icon: Bell, label: "Alertas" },
  { href: "/perfil", icon: User, label: "Perfil" },
];

const SIDE_NAV = [
  { href: "/home", icon: Home, label: "Inicio" },
  { href: "/mapa", icon: MapIcon, label: "Mapa" },
  { href: "/alertas", icon: Bell, label: "Alertas" },
  { href: "/perfil", icon: User, label: "Perfil" },
  { href: "/historial", icon: Clock, label: "Historial" },
  { href: "/menor-perdido", icon: UserX, label: "Personas Extraviadas" },
  { href: "/estadisticas", icon: BarChart3, label: "Estadísticas" },
  { href: "/admin", icon: Settings, label: "Administración" },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panicOpen, setPanicOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/home" ? location === href : location.startsWith(href);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 flex-shrink-0">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-[17px] text-white leading-none">Radar Vecinal</h1>
            <p className="text-[11px] text-primary/80 font-medium mt-0.5">San Miguel, Lima</p>
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

        {/* Footer Zone */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-primary/8 to-transparent border border-primary/15 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
            <p className="text-xs font-bold text-white mb-0.5">Sistema Operativo</p>
            <p className="text-[11px] text-muted-foreground mb-2">Red vecinal activa</p>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 status-blink" />
              Todos los sistemas OK
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar/95 backdrop-blur-xl border-b border-sidebar-border sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold text-base text-white">Radar Vecinal</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
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

              <div className="p-4 border-t border-sidebar-border">
                <Link href="/reportar">
                  <div
                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold cursor-pointer"
                    onClick={() => setMobileOpen(false)}
                  >
                    <PlusCircle className="w-4 h-4" />
                    Nuevo Reporte
                  </div>
                </Link>
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
    </div>
  );
}
