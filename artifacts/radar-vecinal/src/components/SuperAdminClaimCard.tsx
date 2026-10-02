import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ClaimResponse {
  success: boolean;
  message?: string;
  token: string;
  refreshToken?: string;
  user: AuthUser;
}

/**
 * Parte A1: activación del rol de superadministrador.
 *
 * Solo se muestra a la cuenta cuyo correo es el del superadmin (lo indica la
 * bandera `canClaimSuperAdmin` que envía el servidor). Requiere la clave
 * secreta SUPER_ADMIN_CLAIM_SECRET configurada en el servidor.
 */
export default function SuperAdminClaimCard() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user?.canClaimSuperAdmin) return null;

  const handleClaim = async () => {
    const value = secret.trim();
    if (!value || loading) return;
    setLoading(true);
    try {
      const data = await customFetch<ClaimResponse>(
        "/api/auth/claim-superadmin",
        {
          method: "POST",
          body: JSON.stringify({ secret: value }),
        },
      );
      login(data.token, data.refreshToken ?? null, data.user);
      setSecret("");
      toast({
        title: "¡Ahora eres Super Administrador!",
        description: data.message ?? "El rol se activó correctamente.",
      });
    } catch (err) {
      toast({
        title: "No se pudo activar",
        description:
          err instanceof Error
            ? err.message
            : "Verifica la clave e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-primary/8 border border-primary/20 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">
            Activar como superadministrador
          </p>
          <p className="text-xs text-muted-foreground">
            Ingresa la clave secreta del servidor para reclamar tu rol.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Clave de activación"
          aria-label="Clave de activación de superadministrador"
          className="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
        <button
          type="button"
          onClick={handleClaim}
          disabled={loading || !secret.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          Activar
        </button>
      </div>
    </div>
  );
}
