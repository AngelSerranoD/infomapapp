/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import { useCallback, useSyncExternalStore } from 'react';

export interface Settings {
  /** Tocar cualquier punto del mapa consulta qué hay ahí. */
  tapAnywhere: boolean;
  /** Leer la ficha en voz alta en cuanto se abre. */
  autoSpeak: boolean;
  /** Etiquetas con el nombre junto a cada chincheta. */
  showLabels: boolean;
}

const KEY = 'infomap.settings.v1';

const DEFAULTS: Settings = {
  tapAnywhere: true,
  autoSpeak: false,
  showLabels: true,
};

let settings: Settings = load();
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings() {
  const value = useSyncExternalStore(
    subscribe,
    () => settings,
    () => settings,
  );

  const update = useCallback(<K extends keyof Settings>(key: K, next: Settings[K]) => {
    settings = { ...settings, [key]: next };
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* sin espacio: se pierde al recargar, no es critico */
    }
    for (const listener of listeners) listener();
  }, []);

  return { settings: value, update };
}
