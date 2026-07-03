import { useState, useEffect, useRef, useCallback } from 'react';

interface NearbyAlert {
  id: string;
  title: string;
  category: string;
  urgency: string;
  distance: number;
  latitude: number;
  longitude: number;
  address?: string;
  sector?: string;
}

interface GeofenceWatcherState {
  watching: boolean;
  currentPosition: { lat: number; lng: number } | null;
  nearbyAlerts: NearbyAlert[];
  error: string | null;
  start: () => void;
  stop: () => void;
}

interface GeofenceConfig {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  distanceFilter?: number; // minimum meters to trigger a refresh
  radius?: number; // search radius in meters
  districtId?: number; // district ID for the nearby query
}

const DEFAULT_CONFIG: GeofenceConfig = {
  enableHighAccuracy: true,
  maximumAge: 10000,
  distanceFilter: 50,
  radius: 1000,
  districtId: 1, // default: San Ramón
};

export function useGeofenceWatcher(config?: GeofenceConfig): GeofenceWatcherState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [watching, setWatching] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyAlerts, setNearbyAlerts] = useState<NearbyAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const lastFetchPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    try {
      const radius = cfg.radius ?? 1000;
      const districtId = cfg.districtId ?? 1;
      const res = await fetch(`/api/reports/nearby?lat=${lat}&lng=${lng}&radius=${radius}&districtId=${districtId}`);
      if (!res.ok) {
        console.warn('[Geofence] nearby fetch failed:', res.status, res.statusText);
        return;
      }
      const data = await res.json();
      const alerts: NearbyAlert[] = data.reports ?? [];

      // Filter out already notified IDs
      const newAlerts = alerts.filter(a => !notifiedIdsRef.current.has(a.id));
      alerts.forEach(a => notifiedIdsRef.current.add(a.id));

      setNearbyAlerts(prev => {
        const merged = [...newAlerts, ...prev.filter(a => !newAlerts.find(n => n.id === a.id))];
        return merged.slice(0, 20); // keep max 20
      });
    } catch {
      // silent fail
    }
  }, [cfg.radius, cfg.districtId]);

  const handlePosition = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude } = pos.coords;
    setCurrentPosition({ lat: latitude, lng: longitude });
    setError(null);

    const last = lastFetchPosRef.current;
    const distFilter = cfg.distanceFilter ?? 50;

    // Only fetch if moved enough
    if (!last) {
      lastFetchPosRef.current = { lat: latitude, lng: longitude };
      fetchNearby(latitude, longitude);
    } else {
      const dLat = latitude - last.lat;
      const dLng = longitude - last.lng;
      const moved = Math.sqrt(dLat * dLat + dLng * dLng) * 111320; // rough meters
      if (moved > distFilter) {
        lastFetchPosRef.current = { lat: latitude, lng: longitude };
        fetchNearby(latitude, longitude);
      }
    }
  }, [cfg.distanceFilter, fetchNearby]);

  const handleError = useCallback((err: GeolocationPositionError) => {
    setError(
      err.code === 1 ? 'Permiso de ubicación denegado' :
      err.code === 2 ? 'No se pudo obtener ubicación' :
      'Error de geolocalización'
    );
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Tu dispositivo no soporta geolocalización');
      return;
    }

    // Initial position fetch — then watch for changes
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos);
        // Start continuous watching
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePosition,
          handleError,
          {
            enableHighAccuracy: cfg.enableHighAccuracy ?? true,
            maximumAge: cfg.maximumAge ?? 10000,
            timeout: 15000,
          }
        );
        setWatching(true);
      },
      (err) => {
        handleError(err);
        setWatching(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [cfg.enableHighAccuracy, cfg.maximumAge, handlePosition, handleError]);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    watching,
    currentPosition,
    nearbyAlerts,
    error,
    start,
    stop,
  };
}
