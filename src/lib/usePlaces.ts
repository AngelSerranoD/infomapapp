import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { padBBox } from './geo';
import { OverpassError } from './overpass';
import {
  canRetry,
  clearFailures,
  collect,
  isLoaded,
  loadTile,
  warmFromDisk,
} from './placeStore';
import { tileKey, tilesForBBox } from './tiles';
import type { BBox, Place } from './types';

/** Por debajo de este zoom hay demasiada superficie para pedir sitios. */
export const MIN_ZOOM_FOR_PLACES = 14;

/**
 * Teselas que se piden por vista. Mas de cuatro solo pasa con el zoom al minimo,
 * y ahi se quedan las del centro de la pantalla.
 */
const MAX_TILES = 4;

/**
 * Espera antes de pedir a la red, para que arrastrar el mapa de un tiron no
 * dispare una consulta por cada parada. Lo que ya esta descargado se pinta al
 * momento, sin pasar por aqui.
 */
const NETWORK_DEBOUNCE_MS = 250;

export type PlacesState = 'idle' | 'zoom-out' | 'loading' | 'ready' | 'error';

export function usePlaces(bbox: BBox | null, zoom: number) {
  const [loaded, setLoaded] = useState<Place[]>([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tooFar, setTooFar] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Cada cambio de vista invalida las respuestas de la anterior.
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;
    const current = () => generation.current === mine;

    if (!bbox) return;
    if (zoom < MIN_ZOOM_FOR_PLACES) {
      setTooFar(true);
      setLoaded([]);
      setPending(0);
      return;
    }
    setTooFar(false);

    const tiles = tilesForBBox(bbox, MAX_TILES);
    const keys = tiles.map(tileKey);

    /**
     * Se recalcula en vez de descontar un contador: si el usuario se mueve
     * mientras hay teselas en vuelo, el aviso de "cargando" no se queda colgado.
     * Una tesela que ha fallado deja de contar hasta que se pueda reintentar.
     */
    const refresh = () => {
      if (!current()) return;
      setLoaded(collect(keys));
      setPending(keys.filter((key) => !isLoaded(key) && canRetry(key)).length);
    };

    // 1. Lo que ya está en memoria se pinta en este mismo render.
    refresh();

    let debounce: number | undefined;
    void (async () => {
      // 2. Lo guardado de otras sesiones tarda milisegundos en subir a memoria.
      if ((await warmFromDisk(keys)) && current()) refresh();

      const missing = tiles.filter((tile) => !isLoaded(tileKey(tile)) && canRetry(tileKey(tile)));
      if (!missing.length || !current()) return;

      debounce = window.setTimeout(() => {
        if (!current()) return;
        setError(null);

        for (const tile of missing) {
          loadTile(tile)
            .catch((caught: unknown) => {
              if (!current()) return;
              setError(
                caught instanceof OverpassError && caught.kind === 'busy'
                  ? 'El servidor de sitios va saturado. Reinténtalo en unos segundos.'
                  : 'No se han podido cargar los sitios. Revisa la conexión.',
              );
            })
            // 3. Cada tesela se pinta en cuanto llega, sin esperar al resto.
            .finally(refresh);
        }
      }, NETWORK_DEBOUNCE_MS);
    })();

    return () => {
      if (debounce) window.clearTimeout(debounce);
    };
  }, [bbox, zoom, attempt]);

  /**
   * Las teselas van mas alla de lo que se ve. Se recorta a la pantalla con un
   * margen para que el tope de chinchetas no se gaste en sitios de fuera.
   */
  const places = useMemo(() => {
    if (!bbox || !loaded.length) return loaded;
    const [south, west, north, east] = padBBox(bbox, 0.15);
    return loaded.filter(
      (place) =>
        place.lat >= south && place.lat <= north && place.lon >= west && place.lon <= east,
    );
  }, [loaded, bbox]);

  const state: PlacesState = tooFar
    ? 'zoom-out'
    : pending > 0
      ? 'loading'
      : error
        ? 'error'
        : bbox
          ? 'ready'
          : 'idle';

  const retry = useCallback(() => {
    clearFailures();
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { places, state, error, retry };
}
