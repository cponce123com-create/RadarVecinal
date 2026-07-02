import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * ThemeToggle — Botón dark/light mode con persistencia localStorage.
 * Inspirado en Civix (dark mode toggle con class + localStorage).
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("radar_theme");
    if (stored === "light") {
      setDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("radar_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("radar_theme", "light");
    }
  };

  if (compact) {
    return (
      <button onClick={toggle}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
        title={dark ? "Modo claro" : "Modo oscuro"}
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <button onClick={toggle}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {dark ? "Modo claro" : "Modo oscuro"}
    </button>
  );
}
