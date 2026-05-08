import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id:           string;
  name:         string;
  email:        string;
  role:         string;
  sector:       string;
  district:     string;
  isActive:     boolean;
  reportsCount: number;
  createdAt:    string;
}

interface AuthState {
  user:    AuthUser | null;
  token:   string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login:    (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout:   () => void;
  isLoggedIn: boolean;
  isAdmin:    boolean;
}

export interface RegisterData {
  name:     string;
  email:    string;
  password: string;
  sector:   string;
  district: string;
  dni?:     string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY   = "radar_token";
const BASE_URL    = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { "Content-Type": "application/json", ...(options as any)?.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Error desconocido");
  return json;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user:    null,
    token:   null,
    loading: true,
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState(s => ({ ...s, loading: false }));
      return;
    }
    apiFetch("/auth/me", {
      headers: { Authorization: `Bearer ${token}` } as any,
    })
      .then(data => setState({ user: data.user, token, loading: false }))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setState({ user: null, token: null, loading: false });
      });
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    setState({ user: data.user, token: data.token, loading: false });
  };

  const register = async (form: RegisterData) => {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify(form),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    setState({ user: data.user, token: data.token, loading: false });
  };

  const googleLogin = async (credential: string) => {
    const data = await apiFetch("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    setState({ user: data.user, token: data.token, loading: false });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, token: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      googleLogin,
      logout,
      isLoggedIn: !!state.user,
      isAdmin:    state.user?.role === "admin" || state.user?.role === "moderator",
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
