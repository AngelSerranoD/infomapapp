/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import { classify } from './categories';
import type { OsmType, Place } from './types';

const BASE = 'https://nominatim.openstreetmap.org';

/**
 * Nominatim pide como máximo una petición por segundo. Todas las llamadas
 * pasan por esta cola para respetarlo aunque el usuario escriba rápido.
 */
let nextSlot = 0;
function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1100;
  return new Promise((resolve) => setTimeout(resolve, wait));
}

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  place_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string> | null;
  namedetails?: Record<string, string> | null;
}

export interface SearchHit {
  place: Place;
  /** Dirección completa para mostrar bajo el nombre. */
  address: string;
}

const OSM_TYPE: Record<string, OsmType> = { node: 'node', way: 'way', relation: 'relation' };

/** Claves OSM que identifican de verdad que tipo de sitio es. */
const TYPE_KEYS = [
  'amenity',
  'tourism',
  'shop',
  'historic',
  'leisure',
  'natural',
  'railway',
  'aeroway',
];

function shortAddress(address: Record<string, string> | undefined, fallback: string): string {
  if (!address) return fallback;
  const parts = [
    [address.road, address.house_number].filter(Boolean).join(' '),
    address.neighbourhood ?? address.suburb,
    address.city ?? address.town ?? address.village ?? address.municipality,
    address.country,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : fallback;
}

/**
 * Nombre y tipo de lo qué hay en el punto. Nominatim no siempre devuelve algo
 * con nombre: si se toca en mitad de una calle, lo mejor que puede dar es el
 * portal o el barrio, y hay que decirlo así en vez de ensenar un "2" suelto.
 */
function describe(item: NominatimPlace): { name: string; fallbackLabel: string } {
  const named = item.name || item.namedetails?.name;
  if (named) return { name: named, fallbackLabel: 'Sitio' };

  const address = item.address ?? {};
  const street = [address.road, address.house_number].filter(Boolean).join(' ');
  if (street) return { name: street, fallbackLabel: 'Dirección' };

  const area = address.neighbourhood ?? address.suburb ?? address.quarter;
  if (area) return { name: area, fallbackLabel: 'Barrio' };

  const town = address.city ?? address.town ?? address.village ?? address.municipality;
  if (town) return { name: town, fallbackLabel: 'Localidad' };

  return { name: 'Punto del mapa', fallbackLabel: 'Sin datos en este punto' };
}

/** Pasa la dirección de Nominatim al formato de etiquetas de OpenStreetMap. */
function addressTags(address: Record<string, string> | undefined): Record<string, string> {
  if (!address) return {};
  const tags: Record<string, string> = {};
  if (address.road) tags['addr:street'] = address.road;
  if (address.house_number) tags['addr:housenumber'] = address.house_number;
  if (address.postcode) tags['addr:postcode'] = address.postcode;
  const city = address.city ?? address.town ?? address.village ?? address.municipality;
  if (city) tags['addr:city'] = city;
  return tags;
}

function toPlace(item: NominatimPlace): Place {
  const tags: Record<string, string> = { ...addressTags(item.address), ...(item.extratags ?? {}) };
  // "building=yes" no dice nada del sitio, solo que hay un edificio.
  if (item.category && item.type && item.category !== 'place' && item.type !== 'yes') {
    tags[item.category] = item.type;
  }

  const { name, fallbackLabel } = describe(item);
  tags.name = name;

  const { category, label, glyph } = classify(tags);
  const typed = TYPE_KEYS.some((key) => key in tags);

  const osmType = OSM_TYPE[item.osm_type ?? ''] ?? 'node';
  const osmId = item.osm_id ?? item.place_id ?? 0;

  return {
    id: `${osmType}/${osmId}`,
    osmType,
    osmId,
    lat: Number(item.lat),
    lon: Number(item.lon),
    name,
    category,
    typeLabel: typed ? label : fallbackLabel,
    glyph: typed ? glyph : '\u{1F4CD}',
    tags,
    score: 0,
  };
}

/** Buscador por nombre o dirección, dando prioridad a lo cercano al mapa. */
export async function searchPlaces(
  query: string,
  near: { lat: number; lon: number } | null,
  signal: AbortSignal,
): Promise<SearchHit[]> {
  await throttle();
  if (signal.aborted) return [];

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '8',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    'accept-language': 'es',
  });
  if (near) {
    const d = 0.6;
    params.set('viewbox', [near.lon - d, near.lat + d, near.lon + d, near.lat - d].join(','));
  }

  const response = await fetch(`${BASE}/search?${params}`, { signal });
  if (!response.ok) throw new Error(`Nominatim respondió ${response.status}`);
  const items = (await response.json()) as NominatimPlace[];

  return items.map((item) => ({
    place: toPlace(item),
    address: shortAddress(item.address, item.display_name ?? ''),
  }));
}

/** Qué hay en el punto que ha tocado el usuario. */
export async function reverseLookup(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<SearchHit | null> {
  await throttle();
  if (signal.aborted) return null;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    'accept-language': 'es',
  });

  const response = await fetch(`${BASE}/reverse?${params}`, { signal });
  if (!response.ok) return null;
  const item = (await response.json()) as NominatimPlace & { error?: string };
  if (item.error || !item.lat) return null;

  return {
    place: toPlace(item),
    address: shortAddress(item.address, item.display_name ?? ''),
  };
}
