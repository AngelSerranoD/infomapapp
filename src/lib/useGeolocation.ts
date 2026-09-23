/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Fix } from './types';

export type GeoStatus =
  | 'idle'
  | 'locating'
  | 'live'
  | 'denied'
  | 'unavailable'
  | 'insecure'
  | 'error';

/** Pasado este tiempo sin recibir posición, el punto se pinta apagado. */
const STALE_MS = 25000;

/**
 * Una posición nueva pero mucho peor que la que ya tenemos casi siempre viene
 * de la antena de telefonía, no del GPS. Se ignora salvo que la buena ya sea
 * vieja o el usuario se haya movido de verdad.
 */
function shouldAccept(next: Fix, current: Fix | null): boolean {
  if (!current) return true;
  const age = next.timestamp - current.timestamp;
  if (age > 12000) return true;
  if (next.accuracy <= current.accuracy) return true;
  if (next.accuracy <= current.accuracy * 1.6) return true;
  // Si se ha movido más de lo que explica el error, la posición es real.
  const moved = Math.hypot(
    (next.lat - current.lat) * 111320,
    (next.lon - current.lon) * 111320 * Math.cos((next.lat * Math.PI) / 180),
  );
  return moved > current.accuracy + next.accuracy;
}

export function useGeolocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [isStale, setStale] = useState(false);

  const watchId = useRef<number | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const wantsTracking = useRef(false);

  const handlePosition = useCallback((position: GeolocationPosition) => {
    const next: Fix = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracy: position.coords.accuracy ?? 9999,
      heading:
        typeof position.coords.heading === 'number' && !Number.isNaN(position.coords.heading)
          ? position.coords.heading
          : null,
      speed: position.coords.speed ?? null,
      timestamp: position.timestamp || Date.now(),
    };
    setStale(false);
    setStatus('live');
    if (shouldAccept(next, fixRef.current)) {
      fixRef.current = next;
      setFix(next);
    }
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      setStatus('denied');
      wantsTracking.current = false;
      return;
    }
    // Un timeout suelto no es motivo para apagar el seguimiento: el watch sigue
    // vivo y suele recuperarse en cuanto engancha satelites.
    if (error.code === error.TIMEOUT) {
      setStatus((prev) => (prev === 'live' ? 'live' : 'locating'));
      return;
    }
    setStatus(fixRef.current ? 'live' : 'error');
  }, []);

  const stop = useCallback(() => {
    wantsTracking.current = false;
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    if (!window.isSecureContext) {
      // Sin HTTPS el navegador no da la posición, ni siquiera pregunta.
      setStatus('insecure');
      return;
    }

    wantsTracking.current = true;
    if (watchId.current !== null) return;

    setStatus(fixRef.current ? 'live' : 'locating');

    // Primero una posición rápida aunque sea aproximada, para no dejar la
    // pantalla quieta mientras el GPS engancha.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!fixRef.current) handlePosition(position);
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 },
    );

    watchId.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20000,
    });
  }, [handleError, handlePosition]);

  // Marca la posición como vieja si deja de llegar señal.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = fixRef.current;
      setStale(!!current && Date.now() - current.timestamp > STALE_MS);
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  // iOS congela el watch al pasar la app a segundo plano; se reengancha al volver.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !wantsTracking.current) return;
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      start();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [start]);

  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  return { fix, status, isStale, start, stop };
}
