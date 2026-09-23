/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

/* InfoMap — service worker.
   Guarda la app y los trozos de mapa ya vistos para que funcione sin cobertura. */

const VERSION = 'v1';
const APP_CACHE = `infomap-app-${VERSION}`;
const TILE_CACHE = `infomap-tiles-${VERSION}`;
const WIKI_CACHE = `infomap-wiki-${VERSION}`;

/** Lo minimo para que arranque estando sin conexion. */
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg'];

/** Tope de teselas guardadas (~40 MB en el peor caso). */
const MAX_TILES = 700;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('infomap-') && !name.endsWith(VERSION))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/** Borra las teselas mas antiguas cuando la cache se pasa del tope. */
async function trimTiles() {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_TILES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((key) => cache.delete(key)));
}

let tilePuts = 0;

async function cacheFirstTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
    if (++tilePuts % 40 === 0) await trimTiles();
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (hit) {
    network.catch(() => {});
    return hit;
  }
  const response = await network;
  if (response) return response;
  return new Response('{}', { status: 504, headers: { 'Content-Type': 'application/json' } });
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(APP_CACHE);
    cache.put('/index.html', response.clone());
    return response;
  } catch {
    const cache = await caches.open(APP_CACHE);
    return (await cache.match('/index.html')) ?? (await cache.match('/')) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(cacheFirstTile(request));
    return;
  }

  // Fichas de Wikipedia: se sirven al momento desde cache y se refrescan detras.
  if (url.hostname.endsWith('wikipedia.org') || url.hostname.endsWith('wikimedia.org')) {
    event.respondWith(staleWhileRevalidate(request, WIKI_CACHE));
    return;
  }

  // Overpass, Nominatim y Wikidata siempre en directo: son consultas vivas.
  if (url.origin !== self.location.origin) return;

  event.respondWith(cacheFirstAsset(request));
});
