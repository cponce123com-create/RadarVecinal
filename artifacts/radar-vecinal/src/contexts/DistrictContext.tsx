import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DISTRICT } from "@/lib/constants";

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
  /**
   * Centro del mapa del distrito activo (con zoom). ÚNICA fuente para
   * centrar mapas/fallbacks — nada de coordenadas hardcodeadas en páginas.
   * Si aún no hay distrito, cae al centro del piloto (constants.DISTRICT).
   */
  districtCenter: { lat: number; lng: number; zoom: number };
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

// ── Umbrales de precisión del GPS ─────────────────────────────────────────
// El primer fix del navegador suele venir de red/wifi con error de 1-3 km:
// suficiente para caer en un distrito vecino (p. ej. Ate en vez de Santa
// Anita). Por eso NO se resuelve el distrito hasta tener un fix con precisión
// aceptable; si en el plazo de gracia no llega ninguno bueno, se usa el mejor
// disponible (peor es no mostrar nada).
const ACCEPT_ACCURACY_M = 800; // precisión mínima para resolver de inmediato
const GOOD_ACCURACY_M = 200; // con esto dejamos de perseguir mejoras
const FIRST_FIX_GRACE_MS = 8000; // plazo máx. esperando un fix aceptable

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
  // ¿El usuario eligió distrito EN ESTA sesión? Solo entonces su selección
  // supera al GPS. La preferencia persistida de sesiones anteriores NO debe
  // ganarle a la ubicación real de hoy (era parte del bug del "distrito
  // equivocado pegado" en el encabezado).
  const [sessionChosen, setSessionChosen] = useState(false);

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
  // Estrategia en dos fases con watchPosition:
  //
  //  FASE A (primer distrito): NO se resuelve con el primer fix — se espera
  //  uno con precisión aceptable (≤ ACCEPT_ACCURACY_M). Así se OBVIA el fix
  //  impreciso de red que antes pintaba un distrito vecino equivocado. Si en
  //  FIRST_FIX_GRACE_MS no llega ninguno bueno, se usa el mejor disponible.
  //
  //  FASE B (seguimiento): ya resuelto, se re-resuelve solo cuando
  //   · llega un fix bastante más preciso que el usado (caso plazo agotado), o
  //   · el usuario se desplaza de zona (>300 m), máx. una vez cada 5 s.
  //  Con buena precisión (≤ GOOD_ACCURACY_M) se deja de perseguir mejoras.
  useEffect(() => {
    if (!loaded) return;
    if (!("geolocation" in navigator)) {
      setDetectingLocation(false);
      return;
    }

    let cancelled = false;
    let reqSeq = 0; // descarta respuestas fuera de orden (la última manda)
    let located = false; // ¿ya se resolvió el distrito al menos una vez?
    let locatedAccuracy = Infinity; // precisión del fix usado en el último locate
    let bestFix: { lat: number; lng: number; accuracy: number } | null = null;
    let lastLat = 0;
    let lastLng = 0;
    let lastLocateAt = 0;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;

    const clearGrace = () => {
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
    };

    const locate = (lat: number, lng: number, accuracy: number) => {
      located = true;
      locatedAccuracy = accuracy;
      lastLat = lat;
      lastLng = lng;
      lastLocateAt = Date.now();
      clearGrace();
      const seq = ++reqSeq;
      fetch(`/api/districts/locate?lat=${lat}&lng=${lng}`)
        .then(res => res.json())
        .then(data => {
          if (cancelled || seq !== reqSeq) return; // ya hay una petición más nueva
          const found: DistrictInfo | undefined = data.district;
          if (found) setLocatedDistrict(found);
          setIsLocationApproximate(data.method === "approximate");
          setDetectingLocation(false);
        })
        .catch(() => { if (!cancelled) setDetectingLocation(false); });
    };

    // Plazo de gracia: si no llegó ningún fix aceptable, usar el mejor visto.
    graceTimer = setTimeout(() => {
      graceTimer = null;
      if (cancelled || located) return;
      if (bestFix) locate(bestFix.lat, bestFix.lng, bestFix.accuracy);
      // sin ningún fix aún: seguimos esperando al watch (o a su error)
    }, FIRST_FIX_GRACE_MS);

    const onPosition = (pos: GeolocationPosition) => {
      if (cancelled) return;
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      if (!bestFix || accuracy < bestFix.accuracy) bestFix = { lat, lng, accuracy };

      if (!located) {
        // FASE A: solo resolver con un fix aceptable (el timer cubre el resto)
        if (accuracy <= ACCEPT_ACCURACY_M) locate(lat, lng, accuracy);
        return;
      }

      // FASE B: refinar el arranque de plazo agotado o seguir desplazamientos
      const stillCoarse = locatedAccuracy > GOOD_ACCURACY_M;
      const muchMoreAccurate = accuracy <= locatedAccuracy * 0.6;
      const movedM = haversineMeters(lastLat, lastLng, lat, lng);
      const movedFar = movedM > Math.max(300, accuracy);

      if (stillCoarse && muchMoreAccurate) {
        locate(lat, lng, accuracy);
      } else if (movedFar && Date.now() - lastLocateAt > 5000) {
        locate(lat, lng, accuracy);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      onPosition,
      () => {
        if (cancelled || located) return;
        // GPS falló: si algo se alcanzó a recibir, mejor eso que nada
        if (bestFix) locate(bestFix.lat, bestFix.lng, bestFix.accuracy);
        else setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    return () => {
      cancelled = true;
      clearGrace();
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
  // Prioridad: rol bloqueado > elección de ESTA sesión > GPS (donde estás
  // parado) > distrito manual > lo último mostrado en una sesión anterior.
  const districtInfo = useMemo(() => {
    if (lockedDistrict) return lockedDistrict;
    if (sessionChosen && activeSlug) {
      const found = availableDistricts.find(d => d.slug === activeSlug);
      if (found) return found;
    }
    if (locatedDistrict) return locatedDistrict;
    if (manualDistrict) return manualDistrict;
    // Último recurso (GPS apagado/denegado): el distrito de la sesión anterior
    if (activeSlug) return districts.find(d => d.slug === activeSlug) ?? null;
    return null;
  }, [lockedDistrict, sessionChosen, activeSlug, availableDistricts, locatedDistrict, manualDistrict, districts]);

  const needsSelection = loaded && !detectingLocation && !districtInfo;

  const districtCenter = useMemo(
    () => ({
      lat: districtInfo?.centerLat ?? DISTRICT.center.lat,
      lng: districtInfo?.centerLng ?? DISTRICT.center.lng,
      zoom: districtInfo?.defaultZoom ?? DISTRICT.zoom,
    }),
    [districtInfo],
  );

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
    setSessionChosen(true);
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
      setSessionChosen(true);
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
        districtCenter,
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
