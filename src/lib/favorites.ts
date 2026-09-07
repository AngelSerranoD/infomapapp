import { useCallback, useSyncExternalStore } from 'react';
import type { Place } from './types';

const KEY = 'infomap.favorites.v1';

export interface Favorite {
  place: Place;
  savedAt: number;
}

let favorites: Favorite[] = load();
const listeners = new Set<() => void>();

function load(): Favorite[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Favorite[];
    if (!Array.isArray(raw)) return [];
    return raw.filter((f) => f?.place?.id && Number.isFinite(f.place.lat));
  } catch {
    return [];
  }
}

function commit(next: Favorite[]) {
  favorites = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sin espacio: al menos sigue en memoria durante la sesión */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return favorites;
}

export function useFavorites() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);

  const isFavorite = useCallback((id: string) => list.some((f) => f.place.id === id), [list]);

  const toggle = useCallback((place: Place) => {
    const exists = favorites.some((f) => f.place.id === place.id);
    commit(
      exists
        ? favorites.filter((f) => f.place.id !== place.id)
        : [{ place, savedAt: Date.now() }, ...favorites],
    );
    return !exists;
  }, []);

  const remove = useCallback((id: string) => {
    commit(favorites.filter((f) => f.place.id !== id));
  }, []);

  return { favorites: list, isFavorite, toggle, remove };
}
