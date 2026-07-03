import { useState, useEffect, useCallback, useRef } from "react";

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface GeoState {
  position: GeoPosition | null;
  error: string | null;
  loading: boolean;
  supported: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    position: null,
    error: null,
    loading: false,
    supported: typeof navigator !== "undefined" && "geolocation" in navigator,
  });
  const watchIdRef = useRef<number | null>(null);

  const request = useCallback(() => {
    if (!state.supported) {
      setState(s => ({ ...s, error: "Tu dispositivo no soporta geolocalización." }));
      return;
    }

    // Limpiar watch anterior si existe
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setState(s => ({ ...s, loading: true, error: null }));

    // Usar watchPosition en vez de getCurrentPosition para mayor confiabilidad
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
          error: null,
          loading: false,
          supported: true,
        });
      },
      err => {
        setState(s => ({
          ...s,
          loading: false,
          error:
            err.code === 1 ? "Permiso de ubicación denegado. Actívalo en ajustes." :
            err.code === 2 ? "No se pudo obtener tu ubicación." :
            "Tiempo agotado al obtener ubicación.",
        }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [state.supported]);

  // Limpiar watch al desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Fallback: si getCurrentPosition/wacthPosition no responde en 8s, activar getCurrentPosition
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.loading) {
      fallbackTimer.current = setTimeout(() => {
        if (state.loading && watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          // Intentar getCurrentPosition como respaldo
          navigator.geolocation.getCurrentPosition(
            pos => {
              setState({
                position: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
                error: null,
                loading: false,
                supported: true,
              });
            },
            () => { /* ignorar error del fallback */ },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 }
          );
        }
      }, 8000);
    }
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, [state.loading]);

  return { ...state, request };
}
