/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import { CATEGORIES, CATEGORY_BY_ID, classify, type CategoryId } from './categories';
import type { BBox, OsmType, Place } from './types';

/**
 * `overpass-api.de` reparte las peticiones entre varios servidores y muchas
 * veces cae en uno saturado: medido, devuelve 429 o 504 al cabo de 10-14 s.
 * `lz4` es el mismo servicio apuntando al nodo que responde en unos 2 s, asi
 * que va primero y el otro queda de reserva. Los espejos de terceros
 * (kumi.systems, private.coffee, osm.ch, osm.jp) estan descartados: o no mandan
 * cabeceras CORS, o solo tienen datos de su pais.
 */
const FAST = 'https://lz4.overpass-api.de/api/interpreter';
const BACKUP = 'https://overpass-api.de/api/interpreter';

const ATTEMPTS: Array<{ url: string; wait: number }> = [
  { url: FAST, wait: 0 },
  { url: BACKUP, wait: 0 },
  { url: FAST, wait: 1500 },
];

/**
 * Dos cupos separados: en el centro de una ciudad hay tantas tiendas que, si
 * compartieran cupo con el resto, dejarian fuera museos y monumentos.
 */
const MAX_PLACES = 1200;
const MAX_DENSE = 900;

const QUERY_TIMEOUT_S = 25;

interface OverpassElement {
  type: OsmType;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Junta los filtros de todas las categorias en un bloque por clave OSM. Pedirlo
 * todo de golpe y repartirlo despues por categorias en el movil sale mucho
 * mejor: activar o desactivar un filtro deja de costar una consulta entera.
 */
function mergeFilters(dense: boolean): string[] {
  const byKey = new Map<string, Set<string>>();
  const anyValue = new Set<string>();

  for (const category of CATEGORIES) {
    for (const filter of category.filters) {
      if (!!filter.dense !== dense) continue;
      if (!filter.values) {
        anyValue.add(filter.key);
        continue;
      }
      const values = byKey.get(filter.key) ?? new Set<string>();
      for (const value of filter.values) values.add(value);
      byKey.set(filter.key, values);
    }
  }

  return [
    ...[...anyValue].map((key) => `["${key}"]`),
    ...[...byKey]
      .filter(([key]) => !anyValue.has(key))
      .map(([key, values]) => `["${key}"~"^(${[...values].join('|')})$"]`),
  ];
}

const SELECTORS = mergeFilters(false);
const DENSE_SELECTORS = mergeFilters(true);

function group(selectors: string[], box: string, limit: number): string[] {
  if (!selectors.length) return [];
  return [
    '(',
    ...selectors.map((selector) => `  nwr${selector}["name"](${box});`),
    ');',
    `out center qt ${limit};`,
  ];
}

export function buildQuery(bbox: BBox): string {
  const box = bbox.map((n) => n.toFixed(6)).join(',');
  return [
    `[out:json][timeout:${QUERY_TIMEOUT_S}];`,
    ...group(SELECTORS, box, MAX_PLACES),
    ...group(DENSE_SELECTORS, box, MAX_DENSE),
  ].join('\n');
}

/** Puntua un sitio para decidir cuales sobreviven al recorte de chinchetas. */
function scorePlace(tags: Record<string, string>, category: CategoryId): number {
  let score = CATEGORY_BY_ID.get(category)?.weight ?? 10;
  if (tags.wikidata) score += 55;
  if (tags.wikipedia) score += 45;
  if (tags.tourism === 'attraction') score += 30;
  if (tags.heritage || tags['heritage:operator']) score += 25;
  if (tags.website || tags['contact:website']) score += 6;
  if (tags.stars) score += 5;
  // Los nombres muy cortos suelen ser ruido (portales, quioscos sin datos).
  if (tags.name && tags.name.length < 3) score -= 20;
  return score;
}

/**
 * Solo se conservan las etiquetas que usan la ficha o la busqueda en Wikipedia.
 * Una tesela guarda mas de mil sitios: el resto de etiquetas multiplicaria por
 * cuatro lo que ocupa en el movil sin que se llegue a mirar nunca.
 */
const KEEP_TAGS = new Set([
  'name',
  'wikidata',
  'wikipedia',
  'opening_hours',
  'phone',
  'website',
  'url',
  'cuisine',
  'stars',
  'fee',
  'wheelchair',
  'outdoor_seating',
  'operator',
]);
const KEEP_PREFIXES = ['addr:', 'contact:', 'description', 'wikipedia:'];

function pruneTags(tags: Record<string, string>): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (KEEP_TAGS.has(key) || KEEP_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      kept[key] = value;
    }
  }
  return kept;
}

function toPlace(element: OverpassElement): Place | null {
  const tags = element.tags;
  if (!tags?.name) return null;
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const { category, label, glyph } = classify(tags);
  return {
    id: `${element.type}/${element.id}`,
    osmType: element.type,
    osmId: element.id,
    lat,
    lon,
    name: tags.name,
    category,
    typeLabel: label,
    glyph,
    tags: pruneTags(tags),
    score: scorePlace(tags, category),
  };
}

/** Quita duplicados nodo/via que representan el mismo sitio. */
function dedupe(places: Place[]): Place[] {
  const seen = new Map<string, Place>();
  for (const place of places) {
    const key = `${place.name.toLowerCase()}|${place.lat.toFixed(4)}|${place.lon.toFixed(4)}`;
    const previous = seen.get(key);
    if (!previous || place.score > previous.score) seen.set(key, place);
  }
  return [...seen.values()];
}

export type OverpassErrorKind = 'network' | 'busy';

export class OverpassError extends Error {
  readonly kind: OverpassErrorKind;

  constructor(message: string, kind: OverpassErrorKind) {
    super(message);
    this.name = 'OverpassError';
    this.kind = kind;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Descarga los sitios de un area. No admite cancelacion a proposito: si el
 * usuario se mueve mientras llega, la respuesta se guarda igual en la cache y
 * volver a ese sitio sale gratis.
 */
export async function fetchPlaces(bbox: BBox): Promise<Place[]> {
  const query = buildQuery(bbox);
  let lastError: OverpassError | null = null;

  for (const attempt of ATTEMPTS) {
    if (attempt.wait) await delay(attempt.wait);
    try {
      const response = await fetch(attempt.url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (response.status === 429 || response.status === 502 || response.status === 504) {
        lastError = new OverpassError('Servidor de sitios saturado', 'busy');
        continue;
      }
      if (!response.ok) {
        lastError = new OverpassError(`Overpass respondió ${response.status}`, 'network');
        continue;
      }
      const data = (await response.json()) as { elements?: OverpassElement[] };
      const places = (data.elements ?? []).map(toPlace).filter((p): p is Place => p !== null);
      return dedupe(places);
    } catch (error) {
      lastError = new OverpassError(
        error instanceof Error ? error.message : 'Fallo de red',
        'network',
      );
    }
  }

  throw lastError ?? new OverpassError('No se pudo conectar con el servidor de sitios', 'network');
}
