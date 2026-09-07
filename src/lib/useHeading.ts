import { useCallback, useEffect, useRef, useState } from 'react';

interface WebkitOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

type PermissionFn = () => Promise<'granted' | 'denied' | 'default'>;

/** iOS exige pedir permiso para la brújula, y desde un gesto del usuario. */
const needsPermission =
  typeof DeviceOrientationEvent !== 'undefined' &&
  typeof (DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn })
    .requestPermission === 'function';

/** Media circular: evita el salto de 359 a 1 grado al suavizar. */
function smoothAngle(previous: number | null, next: number, factor = 0.25): number {
  if (previous === null) return next;
  const delta = ((next - previous + 540) % 360) - 180;
  return (previous + delta * factor + 360) % 360;
}

export function useHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const smoothed = useRef<number | null>(null);
  const lastEmit = useRef(0);

  const onOrientation = useCallback((event: Event) => {
    const orientation = event as WebkitOrientationEvent;
    let value: number | null = null;

    if (typeof orientation.webkitCompassHeading === 'number') {
      value = orientation.webkitCompassHeading;
    } else if (orientation.absolute && typeof orientation.alpha === 'number') {
      value = (360 - orientation.alpha) % 360;
    }
    if (value === null || Number.isNaN(value)) return;

    smoothed.current = smoothAngle(smoothed.current, value);
    // 20 fps bastan y evitan repintar el mapa en cada evento del sensor.
    const now = performance.now();
    if (now - lastEmit.current < 50) return;
    lastEmit.current = now;
    setHeading(smoothed.current);
  }, []);

  const enable = useCallback(async () => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false;
    if (needsPermission) {
      try {
        const request = (DeviceOrientationEvent as unknown as { requestPermission: PermissionFn })
          .requestPermission;
        if ((await request()) !== 'granted') return false;
      } catch {
        return false;
      }
    }
    setEnabled(true);
    return true;
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
    setHeading(null);
    smoothed.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('deviceorientationabsolute', onOrientation, true);
    window.addEventListener('deviceorientation', onOrientation, true);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrientation, true);
      window.removeEventListener('deviceorientation', onOrientation, true);
    };
  }, [enabled, onOrientation]);

  return { heading, enabled, enable, disable };
}
