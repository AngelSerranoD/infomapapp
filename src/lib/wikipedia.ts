/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import type { Place, WikiSummary } from './types';

/** Idiomas por orden de preferencia al buscar el artículo. */
const LANGS = ['es', 'en'] as const;

const CACHE_KEY = 'infomap.wiki.v1';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 300;

interface CacheEntry {
  at: number;
  data: WikiSummary | null;
}

let cache: Record<string, CacheEntry> | null = null;

function loadCache(): Record<string, CacheEntry> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, CacheEntry>;
  } catch {
    cache = {};
  }
  return cache;
}

function saveCache() {
  if (!cache) return;
  const entries = Object.entries(cache);
  if (entries.length > CACHE_MAX) {
    entries.sort((a, b) => b[1].at - a[1].at);
    cache = Object.fromEntries(entries.slice(0, CACHE_MAX));
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* cuota llena: la cache es prescindible */
  }
}

function readCache(id: string): CacheEntry | undefined {
  const entry = loadCache()[id];
  if (!entry) return undefined;
  if (Date.now() - entry.at > CACHE_TTL_MS) return undefined;
  return entry;
}

function writeCache(id: string, data: WikiSummary | null) {
  loadCache()[id] = { at: Date.now(), data };
  saveCache();
}

// ---------------------------------------------------------------- utilidades

/** Normaliza para comparar nombres: sin acentos, sin artículos, sin puntuación. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(el|la|los|las|lo|de|del|the|a|an|of|il|le)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 0..1 — cuanto se parecen dos nombres de sitio. */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    return Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
  }
  const wa = new Set(na.split(' '));
  const wb = new Set(nb.split(' '));
  let shared = 0;
  for (const word of wa) if (wb.has(word)) shared++;
  return shared / new Set([...wa, ...wb]).size;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    if (signal.aborted) throw error;
    return null;
  }
}

// ---------------------------------------------------------- resumen (REST v1)

interface RestSummary {
  type?: string;
  title: string;
  description?: string;
  extract?: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string }; mobile?: { page?: string } };
}

async function fetchSummary(
  lang: string,
  title: string,
  match: WikiSummary['match'],
  signal: AbortSignal,
): Promise<WikiSummary | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, '_'),
  )}?redirect=true`;
  const data = await getJson<RestSummary>(url, signal);
  if (!data?.extract) return null;
  // Las paginas de desambiguación no describen ningún sitio concreto.
  if (data.type === 'disambiguation' || data.type === 'no-extract') return null;

  return {
    title: data.title,
    lang,
    description: data.description,
    extract: data.extract.trim(),
    thumbnail: data.thumbnail?.source,
    url:
      data.content_urls?.mobile?.page ??
      data.content_urls?.desktop?.page ??
      `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(data.title.replace(/ /g, '_'))}`,
    match,
  };
}

// ----------------------------------------------------------- vias de búsqueda

/** 1. La etiqueta wikipedia=* del propio sitio en OpenStreetMap. */
function titleFromTags(tags: Record<string, string>): { lang: string; title: string } | null {
  const direct = tags.wikipedia;
  if (direct) {
    const match = /^([a-z-]{2,12}):(.+)$/.exec(direct);
    if (match) return { lang: match[1], title: match[2] };
    return { lang: 'es', title: direct };
  }
  for (const lang of LANGS) {
    const value = tags[`wikipedia:${lang}`];
    if (value) return { lang, title: value };
  }
  return null;
}

/** 2. La etiqueta wikidata=* -> artículo en el idioma preferido. */
async function titleFromWikidata(
  qid: string,
  signal: AbortSignal,
): Promise<{ lang: string; title: string } | null> {
  const url =
    'https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks' +
    `&ids=${encodeURIComponent(qid)}&format=json&origin=*`;
  const data = await getJson<{
    entities?: Record<string, { sitelinks?: Record<string, { title: string }> }>;
  }>(url, signal);
  const sitelinks = data?.entities?.[qid]?.sitelinks;
  if (!sitelinks) return null;
  for (const lang of LANGS) {
    const link = sitelinks[`${lang}wiki`];
    if (link?.title) return { lang, title: link.title };
  }
  return null;
}

/** 3. Articulos geolocalizados alrededor del punto, filtrados por nombre. */
async function titleFromGeosearch(
  place: Place,
  signal: AbortSignal,
): Promise<{ lang: string; title: string } | null> {
  for (const lang of LANGS) {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch` +
      `&gscoord=${place.lat}%7C${place.lon}&gsradius=800&gslimit=20&format=json&origin=*`;
    const data = await getJson<{
      query?: { geosearch?: Array<{ title: string; dist: number }> };
    }>(url, signal);
    const results = data?.query?.geosearch ?? [];

    let best: { title: string; score: number } | null = null;
    for (const result of results) {
      const score = similarity(place.name, result.title);
      // Cuanto más lejos, más exigente hay que ser con el nombre.
      const needed = result.dist < 60 ? 0.5 : result.dist < 250 ? 0.68 : 0.85;
      if (score >= needed && (!best || score > best.score)) {
        best = { title: result.title, score };
      }
    }
    if (best) return { lang, title: best.title };
  }
  return null;
}

/** 4. Ultimo recurso: buscador de Wikipedia acotado a 5 km del punto. */
async function titleFromSearch(
  place: Place,
  signal: AbortSignal,
): Promise<{ lang: string; title: string } | null> {
  for (const lang of LANGS) {
    const query = `${place.name} nearcoord:5km,${place.lat},${place.lon}`;
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
    const data = await getJson<{ query?: { search?: Array<{ title: string }> } }>(url, signal);
    for (const result of data?.query?.search ?? []) {
      if (similarity(place.name, result.title) >= 0.72) return { lang, title: result.title };
    }
  }
  return null;
}

// --------------------------------------------------------------------- publico

/**
 * Busca la ficha de Wikipedia del sitio. Devuelve null si no existe artículo,
 * que es lo normal en bares, tiendas y sitios pequeños.
 */
export async function lookupWikipedia(
  place: Place,
  signal: AbortSignal,
): Promise<WikiSummary | null> {
  const cached = readCache(place.id);
  if (cached) return cached.data;

  const tagged = titleFromTags(place.tags);
  if (tagged) {
    const summary = await fetchSummary(tagged.lang, tagged.title, 'wikipedia-tag', signal);
    if (summary) {
      writeCache(place.id, summary);
      return summary;
    }
  }

  if (place.tags.wikidata) {
    const fromWikidata = await titleFromWikidata(place.tags.wikidata, signal);
    if (fromWikidata) {
      const summary = await fetchSummary(fromWikidata.lang, fromWikidata.title, 'wikidata', signal);
      if (summary) {
        writeCache(place.id, summary);
        return summary;
      }
    }
  }

  const fromGeo = await titleFromGeosearch(place, signal);
  if (fromGeo) {
    const summary = await fetchSummary(fromGeo.lang, fromGeo.title, 'geo', signal);
    if (summary) {
      writeCache(place.id, summary);
      return summary;
    }
  }

  const fromSearch = await titleFromSearch(place, signal);
  if (fromSearch) {
    const summary = await fetchSummary(fromSearch.lang, fromSearch.title, 'search', signal);
    if (summary) {
      writeCache(place.id, summary);
      return summary;
    }
  }

  writeCache(place.id, null);
  return null;
}

/** Texto completo de la entradilla, para el botón "Leer más". */
export async function fetchIntro(
  lang: string,
  title: string,
  signal: AbortSignal,
): Promise<string[]> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts` +
    `&exintro=1&explaintext=1&redirects=1&format=json&origin=*` +
    `&titles=${encodeURIComponent(title)}`;
  const data = await getJson<{
    query?: { pages?: Record<string, { extract?: string }> };
  }>(url, signal);
  const pages = data?.query?.pages ?? {};
  const first = Object.values(pages)[0];
  if (!first?.extract) return [];
  return first.extract
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
