import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, LogIn, ShieldOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "@/components/AuthModal";
import AdminPanel from "@/components/admin/AdminPanel";

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  // Show loading state while auth state hydrates
  const authLoading = user === undefined;
  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Not logged in → prompt login
  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="rounded-2xl bg-card border border-white/8 p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Lock className="w-7 h-7 text-accent" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">Acceso Restringido</h2>
              <p className="text-sm text-muted-foreground">
                Inicia sesión con una cuenta de administrador para acceder al panel de control.
              </p>
            </div>
            <button
              onClick={() => setAuthOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-[0_0_16px_hsl(217_100%_55%_/_0.3)]"
            >
              <LogIn className="w-4 h-4" />
              Iniciar sesión
            </button>
          </div>
        </motion.div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  // Logged in but not admin → denied
  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="rounded-2xl bg-card border border-red-500/30 p-8 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ShieldOff className="w-7 h-7 text-red-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">Acceso Denegado</h2>
              <p className="text-sm text-muted-foreground">
                Necesitas permisos de administrador o moderador para acceder a esta sección.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Authorized → show admin panel
  return <AdminPanel />;
}
