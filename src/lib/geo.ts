import type { BBox } from './types';

const EARTH_RADIUS_M = 6371008.8;

/** Distancia en metros entre dos puntos (haversine). */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(meters / 1000)} km`;
}

/** Amplia una bbox un porcentaje por cada lado, para no pedir datos en cada gesto. */
export function padBBox(bbox: BBox, ratio: number): BBox {
  const [south, west, north, east] = bbox;
  const dLat = (north - south) * ratio;
  const dLon = (east - west) * ratio;
  return [
    Math.max(-90, south - dLat),
    Math.max(-180, west - dLon),
    Math.min(90, north + dLat),
    Math.min(180, east + dLon),
  ];
}

/** true si `inner` cabe entera dentro de `outer`. */
export function bboxContains(outer: BBox, inner: BBox): boolean {
  return (
    outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]
  );
}

/** Superficie aproximada en km2, para no lanzar consultas enormes. */
export function bboxAreaKm2(bbox: BBox): number {
  const [south, west, north, east] = bbox;
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const height = (north - south) * 111.32;
  const width = (east - west) * 111.32 * Math.cos(midLat);
  return Math.abs(height * width);
}

/** Rumbo en grados desde un punto hacia otro (0 = norte). */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * toRad) * Math.cos(lat2 * toRad);
  const x =
    Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lon2 - lon1) * toRad);
  return (Math.atan2(y, x) / toRad + 360) % 360;
}
