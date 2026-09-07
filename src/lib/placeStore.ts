import { fetchPlaces, OverpassError } from './overpass';
import { tileBBox, tileKey, type Tile } from './tiles';
import { pruneTiles, readTiles, writeTile } from './tileDb';
import type { Place } from './types';

/**
 * Almacen de sitios por teselas. Todo lo que ya se ha descargado alguna vez sale
 * de aqui sin tocar la red, que es lo que hace que moverse por el mapa y activar
 * o desactivar filtros sea instantaneo.
 */

const memory = new Map<string, Place[]>();
const inflight = new Map<string, Promise<Place[]>>();
const failed = new Map<string, number>();

/**
 * De una en una. Medido: dos consultas a la vez desde la misma IP hacen que
 * Overpass las encole y acabe devolviendo 429 a las dos tras 14 s, mientras que
 * en serie cada una tarda unos 2 s. Ademas, al ir por orden desde el centro de
 * la pantalla, las primeras chinchetas salen enseguida.
 */
const MAX_CONCURRENT = 1;
/** Tras un fallo se espera antes de volver a intentar la misma tesela. */
const RETRY_AFTER_MS = 20000;

let active = 0;
const queue: Array<() => void> = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    // La cola se atiende por el final: lo ultimo que ha pedido el usuario es lo
    // que esta mirando ahora mismo.
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active++;
  try {
    return await task();
  } finally {
    active--;
    queue.pop()?.();
  }
}

export function isLoaded(key: string): boolean {
  return memory.has(key);
}

export function canRetry(key: string): boolean {
  const at = failed.get(key);
  return at === undefined || Date.now() - at > RETRY_AFTER_MS;
}

export function clearFailures(): void {
  failed.clear();
}

/** Sitios ya disponibles en memoria para esas teselas. */
export function collect(keys: string[]): Place[] {
  const places: Place[] = [];
  for (const key of keys) {
    const tile = memory.get(key);
    if (tile) places.push(...tile);
  }
  return places;
}

/**
 * Sube a memoria las teselas que ya estaban guardadas en el movil.
 * Devuelve true si ha entrado alguna, para saber si hay que repintar.
 */
export async function warmFromDisk(keys: string[]): Promise<boolean> {
  const missing = keys.filter((key) => !memory.has(key));
  if (!missing.length) return false;
  const stored = await readTiles(missing);
  for (const tile of stored) memory.set(tile.key, tile.places);
  return stored.length > 0;
}

export async function loadTile(tile: Tile): Promise<Place[]> {
  const key = tileKey(tile);
  const cached = memory.get(key);
  if (cached) return cached;

  const running = inflight.get(key);
  if (running) return running;

  const request = withSlot(() => fetchPlaces(tileBBox(tile)))
    .then((places) => {
      memory.set(key, places);
      failed.delete(key);
      void writeTile(key, places);
      return places;
    })
    .catch((error: unknown) => {
      failed.set(key, Date.now());
      throw error instanceof OverpassError
        ? error
        : new OverpassError('No se pudieron cargar los sitios', 'network');
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

/** Limpieza de teselas viejas, una vez por arranque. */
export function startPlaceStore(): void {
  void pruneTiles();
}
