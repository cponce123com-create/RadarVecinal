import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * DistrictContext v2 — Gestión de distritos con detección por ubicación.
 *
 * Reglas de negocio:
 *  1. DISTRITO POR UBICACIÓN: al abrir la app se detecta por GPS el distrito
 *     más cercano (vía GET /api/districts/nearby, radio máx. 50 km).
 *  2. DISTRITO MANUAL: el usuario puede añadir UN distrito adicional mediante
 *     el selector en cascada Departamento → Provincia → Distrito.
 *  3. MÁXIMO 2: el usuario solo alterna entre esos dos distritos.
 *  4. ADMIN CERRADO: admin y moderator quedan BLOQUEADOS al distrito de su
 *     cuenta (JWT) — no pueden cambiar de distrito. super_admin ve todos.
 *
 * El bug que esto corrige: antes, sin selección previa, el contexto tomaba
 * el PRIMER distrito de la lista alfabética — por eso se mostraba un
 * distrito en el que el usuario no estaba.
 */

export interface DistrictInfo {
  id: number;
  slug: string;
  name: string;
  province: string;
  department: string;
  centerLat?: number | null;
  centerLng?: number | null;
  defaultZoom?: number | null;
  isActive: boolean;
}

interface DistrictContextValue {
  // ── API compatible con la versión anterior ──
  currentDistrictId: number | null;
  currentDistrict: string;
  province: string;
  department: string;
  districtInfo: DistrictInfo | null;
  districts: DistrictInfo[];
  setDistrict: (slug: string) => void;
  // ── API nueva ──
  /** Distrito detectado por GPS (null si sin señal o fuera de cobertura) */
  locatedDistrict: DistrictInfo | null;
  /** Distrito elegido manualmente en la cascada (null si nunca eligió) */
  manualDistrict: DistrictInfo | null;
  /** Los distritos entre los que el usuario puede alternar (máx. 2) */
  availableDistricts: DistrictInfo[];
  /** Define/reemplaza el distrito manual y lo activa */
  setManualDistrict: (slug: string) => void;
  /** true mientras se intenta detectar la ubicación */
  detectingLocation: boolean;
  /** true si el rol del usuario lo bloquea a un solo distrito (admin/moderator) */
  isLocked: boolean;
  /** true si no hay ningún distrito determinado y hay que pedir selección */
  needsSelection: boolean;
}

const DistrictContext = createContext<DistrictContextValue | null>(null);

const LS_MANUAL = "radarvecinal_manual_district_slug";
const LS_ACTIVE = "radarvecinal_active_district_slug";
const LS_LEGACY = "radarvecinal_district_slug"; // clave de la versión anterior

export function DistrictProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [locatedDistrict, setLocatedDistrict] = useState<DistrictInfo | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(true);
  const [manualSlug, setManualSlug] = useState<string | null>(() => {
    // Migración: la clave antigua pasa a ser el distrito manual
    return localStorage.getItem(LS_MANUAL) ?? localStorage.getItem(LS_LEGACY);
  });
  const [activeSlug, setActiveSlug] = useState<string | null>(() => localStorage.getItem(LS_ACTIVE));

  // ── 1. Cargar catálogo completo de distritos ────────────────────────────
  useEffect(() => {
    fetch("/api/districts")
      .then(res => res.json())
      .then(data => {
        setDistricts(data.districts ?? []);
        setLoaded(true);
      })
      .catch(() => {
        setDistricts([]);
        setLoaded(true);
      });
  }, []);

  // ── 2. Detectar distrito por ubicación (GPS → /districts/nearby) ────────
  useEffect(() => {
    if (!loaded) return;
    if (!("geolocation" in navigator)) {
      setDetectingLocation(false);
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      pos => {
        fetch(`/api/districts/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&limit=1`)
          .then(res => res.json())
          .then(data => {
            if (cancelled) return;
            const nearest: DistrictInfo | undefined = data.districts?.[0];
            if (nearest) setLocatedDistrict(nearest);
            setDetectingLocation(false);
          })
          .catch(() => { if (!cancelled) setDetectingLocation(false); });
      },
      () => { if (!cancelled) setDetectingLocation(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
    return () => { cancelled = true; };
  }, [loaded]);

  // ── 3. Bloqueo por rol: admin/moderator quedan fijos a su distrito ──────
  const isLocked = !!user && (user.role === "admin" || user.role === "moderator");
  const lockedDistrict = useMemo(() => {
    if (!isLocked || !user?.districtId) return null;
    return districts.find(d => d.id === Number(user.districtId)) ?? null;
  }, [isLocked, user, districts]);

  const manualDistrict = useMemo(
    () => (manualSlug ? districts.find(d => d.slug === manualSlug) ?? null : null),
    [manualSlug, districts],
  );

  // ── 4. Distritos disponibles (máx. 2, sin duplicados) ───────────────────
  const availableDistricts = useMemo(() => {
    if (lockedDistrict) return [lockedDistrict];
    const list: DistrictInfo[] = [];
    if (locatedDistrict) list.push(locatedDistrict);
    if (manualDistrict && manualDistrict.id !== locatedDistrict?.id) list.push(manualDistrict);
    return list;
  }, [lockedDistrict, locatedDistrict, manualDistrict]);

  // ── 5. Distrito activo ───────────────────────────────────────────────────
  const districtInfo = useMemo(() => {
    if (lockedDistrict) return lockedDistrict;
    // Preferir la selección explícita del usuario si sigue disponible
    if (activeSlug) {
      const found = availableDistricts.find(d => d.slug === activeSlug);
      if (found) return found;
    }
    // Prioridad: donde estás parado > el manual
    return locatedDistrict ?? manualDistrict ?? null;
  }, [lockedDistrict, activeSlug, availableDistricts, locatedDistrict, manualDistrict]);

  const needsSelection = loaded && !detectingLocation && !districtInfo;

  // ── 6. Acciones ──────────────────────────────────────────────────────────
  const setManualDistrict = (slug: string) => {
    if (isLocked) return;
    const found = districts.find(d => d.slug === slug);
    if (!found) return;
    setManualSlug(slug);
    localStorage.setItem(LS_MANUAL, slug);
    localStorage.removeItem(LS_LEGACY);
    // Al elegir manualmente, ese distrito pasa a ser el activo
    setActiveSlug(slug);
    localStorage.setItem(LS_ACTIVE, slug);
  };

  /**
   * Compatibilidad con la API anterior. Ahora:
   *  - Si el slug es uno de los 2 disponibles → alterna a él.
   *  - Si es otro distrito → se registra como el manual (reemplaza al anterior).
   */
  const setDistrict = (slug: string) => {
    if (isLocked) return;
    const isAvailable = availableDistricts.some(d => d.slug === slug);
    if (isAvailable) {
      setActiveSlug(slug);
      localStorage.setItem(LS_ACTIVE, slug);
    } else {
      setManualDistrict(slug);
    }
  };

  return (
    <DistrictContext.Provider
      value={{
        currentDistrictId: districtInfo?.id ?? null,
        currentDistrict: districtInfo?.name ?? "",
        province: districtInfo?.province ?? "",
        department: districtInfo?.department ?? "",
        districtInfo,
        districts,
        setDistrict,
        locatedDistrict,
        manualDistrict,
        availableDistricts,
        setManualDistrict,
        detectingLocation,
        isLocked,
        needsSelection,
      }}
    >
      {children}
    </DistrictContext.Provider>
  );
}

export function useDistrict() {
  const ctx = useContext(DistrictContext);
  if (!ctx) throw new Error("useDistrict must be used inside DistrictProvider");
  return ctx;
}
