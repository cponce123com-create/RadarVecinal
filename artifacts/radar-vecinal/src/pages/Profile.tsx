import { User, Shield, Award, Settings, LogOut } from "lucide-react";
import { Link } from "wouter";

export default function Profile() {
  // Mocked user profile since there is no /api/me endpoint
  const user = {
    name: "Carlos Mendoza",
    email: "carlos.m@example.com",
    role: "Vecino Verificado",
    sector: "San Miguel Centro",
    joinDate: "Ene 2024",
    reportsCount: 14,
    trustScore: 98
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-3xl font-display font-bold text-white mb-6">Tu Perfil</h2>

      {/* Main Profile Card */}
      <div className="p-8 rounded-3xl bg-card border border-white/5 relative overflow-hidden">
        {/* Abstract shapes bg */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
          <div className="w-32 h-32 rounded-full border-4 border-background shadow-2xl overflow-hidden bg-neutral-900 flex-shrink-0">
             <img src={`${import.meta.env.BASE_URL}images/avatar-placeholder.png`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2 justify-center md:justify-start">
              <h1 className="text-3xl font-bold text-white">{user.name}</h1>
              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold tracking-wide border border-primary/30 flex items-center gap-1 w-max mx-auto md:mx-0">
                <Shield className="w-3 h-3" />
                {user.role}
              </span>
            </div>
            <p className="text-muted-foreground mb-6">{user.sector} • Miembro desde {user.joinDate}</p>

            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <div className="px-4 py-2 rounded-xl bg-background border border-white/5 text-center min-w-[120px]">
                <span className="block text-2xl font-bold text-white mb-1">{user.reportsCount}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Reportes</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-background border border-white/5 text-center min-w-[120px]">
                <span className="block text-2xl font-bold text-success mb-1">{user.trustScore}%</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Confiabilidad</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/historial" className="p-6 rounded-2xl bg-card border border-white/5 hover:bg-white/5 transition-colors group flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-white text-lg">Mis Aportes</h4>
            <p className="text-sm text-muted-foreground">Ver historial de tus reportes</p>
          </div>
        </Link>
        
        <button className="p-6 rounded-2xl bg-card border border-white/5 hover:bg-white/5 transition-colors group flex items-center gap-4 text-left">
          <div className="p-3 rounded-xl bg-white/5 text-white group-hover:scale-110 transition-transform">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-white text-lg">Configuración</h4>
            <p className="text-sm text-muted-foreground">Notificaciones y privacidad</p>
          </div>
        </button>

        <Link href="/admin" className="p-6 rounded-2xl bg-card border border-white/5 hover:bg-white/5 transition-colors group flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-white text-lg">Panel de Control</h4>
            <p className="text-sm text-muted-foreground">Acceso administrativo (Demo)</p>
          </div>
        </Link>

        <button className="p-6 rounded-2xl bg-card border border-white/5 hover:bg-destructive/10 hover:border-destructive/30 transition-colors group flex items-center gap-4 text-left">
          <div className="p-3 rounded-xl bg-white/5 text-destructive group-hover:scale-110 transition-transform">
            <LogOut className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-white text-lg">Cerrar Sesión</h4>
            <p className="text-sm text-muted-foreground">Salir de tu cuenta</p>
          </div>
        </button>
      </div>
    </div>
  );
}
