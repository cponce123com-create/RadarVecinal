import { useState, useEffect, useCallback } from "react";

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

  const request = useCallback(() => {
    if (!state.supported) {
      setState(s => ({ ...s, error: "Tu dispositivo no soporta geolocalización." }));
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [state.supported]);

  return { ...state, request };
}
