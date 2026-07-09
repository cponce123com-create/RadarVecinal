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
  /** FASE-2: true si el distrito detectado por GPS es aproximado (haversine) vs exacto (polígono) */
  isLocationApproximate: boolean;
}

const DistrictContext = createContext<DistrictContextValue | null>(null);

const LS_MANUAL = "radarvecinal_manual_district_slug";
const LS_ACTIVE = "radarvecinal_active_district_slug";
const LS_LEGACY = "radarvecinal_district_slug"; // clave de la versión anterior

/** Distancia aproximada en metros entre dos coordenadas (haversine). */
function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Precisión (en metros) a partir de la cual un fix se considera bueno para
// resolver el distrito. Los límites distritales son de escala kilométrica, así
// que ~200 m sobra; al alcanzarla dejamos de perseguir mejoras de precisión.
const GOOD_ACCURACY_M = 200;

export function DistrictProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [locatedDistrict, setLocatedDistrict] = useState<DistrictInfo | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(true);
  const [isLocationApproximate, setIsLocationApproximate] = useState(false);
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

  // ── 2. Detectar distrito por ubicación (GPS → /districts/locate) ────────
  //
  // Usamos watchPosition (no getCurrentPosition) porque el PRIMER fix del GPS
  // suele ser impreciso (~1-3 km, basado en red/wifi) y resuelve un distrito
  // equivocado; segundos después llega el fix fino. Antes ese primer valor
  // quedaba "pegado" en el encabezado. Ahora re-resolvemos el distrito cuando:
  //   · llega un fix bastante más preciso  → corrige el arranque impreciso, o
  //   · el usuario se desplaza de zona     → sigue mostrando el distrito real.
  // Al alcanzar buena precisión dejamos de perseguir mejoras (ahorro de datos);
  // el watch permanece activo para detectar desplazamientos.
  useEffect(() => {
    if (!loaded) return;
    if (!("geolocation" in navigator)) {
      setDetectingLocation(false);
      return;
    }

    let cancelled = false;
    let reqSeq = 0; // descarta respuestas fuera de orden (la última manda)
    let bestAccuracy = Infinity;
    let haveGoodFix = false;
    let lastLat: number | null = null;
    let lastLng: number | null = null;
    let lastLocateAt = 0;

    const locate = (lat: number, lng: number) => {
      lastLat = lat;
      lastLng = lng;
      lastLocateAt = Date.now();
      const seq = ++reqSeq;
      fetch(`/api/districts/locate?lat=${lat}&lng=${lng}`)
        .then(res => res.json())
        .then(data => {
          if (cancelled || seq !== reqSeq) return; // ya hay una petición más nueva
          const located: DistrictInfo | undefined = data.district;
          if (located) setLocatedDistrict(located);
          setIsLocationApproximate(data.method === "approximate");
          setDetectingLocation(false);
        })
        .catch(() => { if (!cancelled) setDetectingLocation(false); });
    };

    const onPosition = (pos: GeolocationPosition) => {
      if (cancelled) return;
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const firstFix = lastLat === null;
      const movedM = firstFix ? Infinity : haversineMeters(lastLat!, lastLng!, lat, lng);
      // "mejoró bastante": el nuevo fix es ≥40% más preciso que el mejor visto
      const muchMoreAccurate = accuracy <= bestAccuracy * 0.6;
      // se desplazó de zona (con margen sobre la propia imprecisión del fix)
      const movedFar = movedM > Math.max(300, accuracy);

      if (accuracy < bestAccuracy) bestAccuracy = accuracy;

      if (firstFix) {
        locate(lat, lng); // pinta algo cuanto antes
      } else if (!haveGoodFix && muchMoreAccurate) {
        locate(lat, lng); // corrige el arranque impreciso
      } else if (movedFar && Date.now() - lastLocateAt > 5000) {
        locate(lat, lng); // cambió de sitio (como máx. una vez cada 5 s)
      }

      if (accuracy <= GOOD_ACCURACY_M) haveGoodFix = true;
    };

    const watchId = navigator.geolocation.watchPosition(
      onPosition,
      () => { if (!cancelled) setDetectingLocation(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
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
        isLocationApproximate,
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
