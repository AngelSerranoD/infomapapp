/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import type { Place } from './types';

/**
 * Las teselas descargadas se guardan en IndexedDB, no en localStorage: una
 * tesela de una ciudad densa pasa de los 300 KB y guardarla con localStorage
 * bloquearia la pantalla en cada descarga.
 *
 * Todo esto es un lujo, no un requisito: si el navegador no deja abrir la base
 * (modo privado, permisos), la app sigue funcionando y solo pierde el arranque
 * en caliente.
 */

const DB_NAME = 'infomap';
const STORE = 'tiles';
const DB_VERSION = 1;

/** Un mes: los sitios de OpenStreetMap cambian despacio. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TILES = 120;

/**
 * Cada tesela guarda los sitios ya clasificados (categoría, etiqueta traducida,
 * icono y puntuación). Al cambiar esa lógica hay que **subir este número**, o
 * las zonas ya descargadas se quedarían para siempre con la versión antigua.
 */
const SCHEMA = 2;

export interface StoredTile {
  key: string;
  at: number;
  v: number;
  places: Place[];
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' }).createIndex('at', 'at');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

export async function readTiles(keys: string[]): Promise<StoredTile[]> {
  const db = await openDb();
  if (!db || !keys.length) return [];
  return new Promise((resolve) => {
    const found: StoredTile[] = [];
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(STORE, 'readonly');
    } catch {
      resolve([]);
      return;
    }
    const store = transaction.objectStore(STORE);
    for (const key of keys) {
      const request = store.get(key);
      request.onsuccess = () => {
        const tile = request.result as StoredTile | undefined;
        if (tile && tile.v === SCHEMA && Date.now() - tile.at < MAX_AGE_MS) found.push(tile);
      };
    }
    transaction.oncomplete = () => resolve(found);
    transaction.onerror = () => resolve(found);
    transaction.onabort = () => resolve(found);
  });
}

export async function writeTile(key: string, places: Place[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction
      .objectStore(STORE)
      .put({ key, at: Date.now(), v: SCHEMA, places } satisfies StoredTile);
  } catch {
    /* la base puede estar llena o cerrada: no es motivo para romper nada */
  }
}

/** Tira las teselas viejas o sobrantes. Se llama una vez al arrancar. */
export async function pruneTiles(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const request = store.index('at').openCursor();
    let total = 0;
    const stale: string[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const tile = cursor.value as StoredTile;
        if (tile.v !== SCHEMA || Date.now() - tile.at > MAX_AGE_MS) stale.push(tile.key);
        total++;
        cursor.continue();
        return;
      }
      // El cursor va de mas vieja a mas nueva: las primeras son las que sobran.
      const excess = Math.max(0, total - stale.length - MAX_TILES);
      const request2 = store.index('at').openCursor();
      let seen = 0;
      request2.onsuccess = () => {
        const cursor2 = request2.result;
        if (!cursor2) return;
        const tile = cursor2.value as StoredTile;
        if (stale.includes(tile.key) || seen < excess) {
          if (!stale.includes(tile.key)) seen++;
          cursor2.delete();
        }
        cursor2.continue();
      };
    };
  } catch {
    /* si falla, la base se queda como estaba */
  }
}
