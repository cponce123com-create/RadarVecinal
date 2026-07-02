import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  createdAt:    string;
}

interface AuthContextValue {
  user:       AuthUser | null;
  token:      string | null;
  login:      (token: string, user: AuthUser) => void;
  logout:     () => void;
  isAdmin:    boolean;
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

  const isAdmin = !!(user && ["admin", "moderator", "super_admin"].includes(user.role));

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
