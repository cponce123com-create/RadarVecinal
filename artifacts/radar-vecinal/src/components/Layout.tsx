import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  Map as MapIcon, 
  PlusCircle, 
  Bell, 
  User, 
  Menu,
  Shield,
  Clock,
  BarChart3,
  UserX,
  Settings
} from "lucide-react";
import { PanicModal } from "./PanicModal";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPanicOpen, setIsPanicOpen] = useState(false);

  const mainNav = [
    { href: "/home", icon: Home, label: "Inicio" },
    { href: "/mapa", icon: MapIcon, label: "Mapa" },
    { href: "/reportar", icon: PlusCircle, label: "Reportar", isPrimary: true },
    { href: "/alertas", icon: Bell, label: "Alertas" },
    { href: "/perfil", icon: User, label: "Perfil" },
  ];

  const sideNav = [
    ...mainNav.filter(n => !n.isPrimary),
    { href: "/historial", icon: Clock, label: "Historial" },
    { href: "/menor-perdido", icon: UserX, label: "Personas Extraviadas" },
    { href: "/estadisticas", icon: BarChart3, label: "Estadísticas" },
    { href: "/admin", icon: Settings, label: "Administración" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-card border-r border-border h-screen sticky top-0 z-40 shadow-2xl">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-tight text-white text-glow">Radar Vecinal</h1>
            <p className="text-xs text-primary font-medium">San Miguel, Lima</p>
          </div>
        </div>

        <div className="px-4 pb-6">
          <Link href="/reportar" className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(0,102,255,0.3)] hover:shadow-[0_0_30px_rgba(0,102,255,0.5)]">
            <PlusCircle className="w-5 h-5" />
            NUEVO REPORTE
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto hide-scrollbar">
          {sideNav.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== '/home' && location.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? "bg-white/10 text-white font-medium shadow-inner border border-white/5" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <div className="p-4 rounded-xl bg-gradient-to-br from-card to-background border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <h4 className="text-sm font-bold text-white mb-1">Zona Segura</h4>
            <p className="text-xs text-muted-foreground mb-3">Tu comunidad está protegida.</p>
            <div className="flex items-center gap-2 text-xs font-medium text-success">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Sistemas Operativos
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="font-display font-bold text-lg text-white">Radar Vecinal</h1>
        </div>
        <button 
          className="p-2 text-muted-foreground hover:text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm md:hidden flex flex-col pt-20 px-4">
          <nav className="flex flex-col gap-2">
             {sideNav.map((item) => {
               const Icon = item.icon;
               return (
                 <Link
                   key={item.href}
                   href={item.href}
                   onClick={() => setIsMobileMenuOpen(false)}
                   className="flex items-center gap-4 p-4 rounded-xl bg-card border border-white/5 text-white"
                 >
                   <Icon className="w-6 h-6 text-primary" />
                   <span className="text-lg font-medium">{item.label}</span>
                 </Link>
               )
             })}
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-24 md:pb-0 relative flex flex-col max-h-screen overflow-y-auto hide-scrollbar">
        <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around px-2 pb-safe z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          if (item.isPrimary) {
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className="relative -top-5 flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,102,255,0.4)] border-4 border-background">
                  <Icon className="w-7 h-7" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-16 h-16 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${isActive ? "fill-primary/20" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Floating Panic Button - Always visible bottom right */}
      <button
        onClick={() => setIsPanicOpen(true)}
        className="fixed bottom-24 md:bottom-8 right-4 md:right-8 w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center shadow-[0_0_30px_rgba(255,0,0,0.5)] hover:scale-105 active:scale-95 transition-all z-40 border-2 border-white/20"
      >
        <div className="absolute inset-0 rounded-full animate-ping bg-destructive/40" />
        <ShieldAlert className="w-8 h-8 relative z-10" />
      </button>

      <PanicModal isOpen={isPanicOpen} onClose={() => setIsPanicOpen(false)} />
    </div>
  );
}

// Added missing import
import { ShieldAlert } from "lucide-react";
