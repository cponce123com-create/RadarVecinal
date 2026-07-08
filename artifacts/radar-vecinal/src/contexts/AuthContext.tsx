import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  id:           string;
  name:         string;
  email:        string;
  role:         string;
  sector:       string;
  district:     string;
  districtId:   number;
  isActive:     boolean;
  reportsCount: number;
  /** Nombre en clave editable; si es null se usa "Vecino {vecinoId}" */
  alias?:       string | null;
  /** Código público autogenerado de 6 dígitos */
  vecinoId?:    number | null;
  createdAt:    string;
}

interface AuthContextValue {
  user:       AuthUser | null;
  token:      string | null;
  login:      (token: string, user: AuthUser) => void;
  logout:     () => void;
  /** Nivel municipalidad o superior: gestiona y ELIMINA su distrito. */
  isAdmin:    boolean;
  /** Nivel moderador o superior: ve y edita/modera (sin eliminar). */
  isModerator: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("radarvecinal_token");
    if (savedToken) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then(res => {
          if (!res.ok) throw new Error("Invalid token");
          return res.json();
        })
        .then((data: AuthUser) => {
          setToken(savedToken);
          setUser(data);
        })
        .catch(() => {
          localStorage.removeItem("radarvecinal_token");
        });
    }
  }, []);

  // Sincronizar token JWT con el API client (customFetch) para que todas
  // las llamadas a la API incluyan el Authorization header automáticamente.
  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem("radarvecinal_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("radarvecinal_token");
    setToken(null);
    setUser(null);
  };

  // Jerarquía de 4 niveles: super_admin > admin/municipal (municipalidad) >
  // moderator/viewer (moderador) > user. admin≡municipal; moderator≡viewer.
  const MUNICIPALITY_ROLES = ["super_admin", "admin", "municipal"];
  const MODERATOR_ROLES = [...MUNICIPALITY_ROLES, "moderator", "viewer"];
  const isAdmin = !!(user && MUNICIPALITY_ROLES.includes(user.role));
  const isModerator = !!(user && MODERATOR_ROLES.includes(user.role));
  const isSuperAdmin = !!(user && user.role === "super_admin");

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, isAdmin, isModerator, isSuperAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
