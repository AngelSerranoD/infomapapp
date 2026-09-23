/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import type { Place } from './types';

export const isApplePlatform =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    /Macintosh/.test(navigator.userAgent));

/**
 * Abre la app de mapas del sistema con la ruta hasta el sitio.
 * En iPhone y Mac va a Apple Maps; en el resto, a Google Maps.
 */
export function openDirections(place: Place) {
  const coords = `${place.lat},${place.lon}`;
  const label = encodeURIComponent(place.name);

  const url = isApplePlatform
    ? `https://maps.apple.com/?daddr=${coords}&q=${label}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=walking`;

  window.open(url, '_blank', 'noopener,noreferrer');
}

export const directionsAppName = isApplePlatform ? 'Apple Maps' : 'Google Maps';
