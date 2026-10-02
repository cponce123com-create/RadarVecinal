import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  setAuthTokenGetter,
  setAuthTokenRefresher,
} from "@workspace/api-client-react";

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
  /** true solo para la cuenta del superadministrador que aún no tiene el rol */
  canClaimSuperAdmin?: boolean;
  /** Nombre en clave editable; si es null se usa "Vecino {vecinoId}" */
  alias?:       string | null;
  /** Código público autogenerado de 6 dígitos */
  vecinoId?:    number | null;
  createdAt:    string;
}

interface AuthContextValue {
  user:       AuthUser | null;
  token:      string | null;
  /** Guarda la sesión: access token, refresh token y usuario. */
  login:      (token: string, refreshToken: string | null, user: AuthUser) => void;
  logout:     () => void;
  /** Nivel municipalidad o superior: gestiona y ELIMINA su distrito. */
  isAdmin:    boolean;
  /** Nivel moderador o superior: ve y edita/modera (sin eliminar). */
  isModerator: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// El access token dura 15 minutos; el refresh token 30 días. Guardar ambos
// permite renovar la sesión sin obligar al usuario a volver a entrar.
const TOKEN_KEY = "radarvecinal_token";
const REFRESH_TOKEN_KEY = "radarvecinal_refresh_token";

// Renovar un poco antes de que caduque el access token (15 min).
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

interface AuthSessionPayload {
  token: string;
  refreshToken?: string;
  user: AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Guarda una sesión completa (tokens + usuario) en el estado y en localStorage.
  const applySession = useCallback((payload: AuthSessionPayload) => {
    localStorage.setItem(TOKEN_KEY, payload.token);
    if (payload.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
    }
    setToken(payload.token);
    setUser(payload.user);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Evita que varias llamadas simultáneas renueven a la vez: la rotación de
  // refresh tokens revoca el anterior, así que deben compartir una sola.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  /**
   * Renueva la sesión con el refresh token guardado. Devuelve el nuevo access
   * token, o `null` si no fue posible (sin refresh token o refresh inválido).
   */
  const refreshSession = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const task = (async () => {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;

      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          clearSession();
          return null;
        }
        const data = (await res.json()) as AuthSessionPayload;
        applySession(data);
        return data.token;
      } catch {
        // Error de red: se conserva la sesión y se reintentará más adelante.
        return null;
      }
    })().finally(() => {
      refreshInFlight.current = null;
    });

    refreshInFlight.current = task;
    return task;
  }, [applySession, clearSession]);

  // Rehidratar desde localStorage al abrir la app. Si el access token caducó,
  // se renueva con el refresh token en vez de cerrar la sesión.
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (res.ok) {
          const data = (await res.json()) as AuthUser;
          if (!cancelled) {
            setToken(savedToken);
            setUser(data);
          }
          return;
        }
      } catch {
        // Sin red: se intenta renovar igualmente.
      }

      const newToken = await refreshSession();
      if (!cancelled && !newToken) clearSession();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshSession, clearSession]);

  // Sincronizar token JWT con el API client (customFetch) para que todas
  // las llamadas a la API incluyan el Authorization header automáticamente.
  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  // Permitir que customFetch renueve la sesión sola ante un 401.
  useEffect(() => {
    setAuthTokenRefresher(refreshSession);
    return () => setAuthTokenRefresher(null);
  }, [refreshSession]);

  // Renovación proactiva: mantiene viva la sesión mientras se usa la app,
  // incluso en las llamadas que usan fetch directamente (no customFetch).
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      void refreshSession();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, refreshSession]);

  const login = useCallback(
    (newToken: string, newRefreshToken: string | null, newUser: AuthUser) => {
      localStorage.setItem(TOKEN_KEY, newToken);
      if (newRefreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
      }
      setToken(newToken);
      setUser(newUser);
    },
    [],
  );

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      // Best-effort: revoca el refresh token en el servidor.
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    clearSession();
  }, [clearSession]);

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
