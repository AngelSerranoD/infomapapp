/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Place, WikiSummary } from './types';
import { fetchIntro, lookupWikipedia } from './wikipedia';

export type WikiStatus = 'idle' | 'loading' | 'ready' | 'none' | 'error';

interface Lookup {
  place: Place;
  summary: WikiSummary | null;
  status: Exclude<WikiStatus, 'idle' | 'loading'>;
}

interface Intro {
  summary: WikiSummary;
  paragraphs: string[] | null;
}

/**
 * Cada resultado se guarda junto al sitio (o resumen) al que pertenece, y lo
 * que se devuelve se deriva en el render: si el sitio ha cambiado y aún no hay
 * respuesta, está cargando. Así no hay que vaciar el estado dentro del efecto
 * al cambiar de sitio, que obligaba a un render de más.
 */
export function useWikiInfo(place: Place | null) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [introState, setIntroState] = useState<Intro | null>(null);

  useEffect(() => {
    if (!place) return;
    const ac = new AbortController();
    lookupWikipedia(place, ac.signal)
      .then((found) => {
        if (ac.signal.aborted) return;
        setLookup({ place, summary: found, status: found ? 'ready' : 'none' });
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setLookup({ place, summary: null, status: 'error' });
      });
    // Cambiar de sitio (o cerrar la ficha) cancela la búsqueda anterior.
    return () => ac.abort();
  }, [place]);

  const current = place !== null && lookup?.place === place ? lookup : null;
  const summary = current?.summary ?? null;
  const status: WikiStatus = !place ? 'idle' : (current?.status ?? 'loading');

  const mine = summary !== null && introState?.summary === summary ? introState : null;
  const intro = mine?.paragraphs ?? null;
  const introLoading = mine !== null && mine.paragraphs === null;

  const loadIntro = useCallback(() => {
    if (!summary || intro || introLoading) return;
    setIntroState({ summary, paragraphs: null });
    const done = (paragraphs: string[]) =>
      // Solo si sigue siendo el mismo resumen: la ficha puede haber cambiado.
      setIntroState((prev) => (prev?.summary === summary ? { summary, paragraphs } : prev));
    fetchIntro(summary.lang, summary.title, new AbortController().signal)
      .then((paragraphs) => done(paragraphs.length ? paragraphs : [summary.extract]))
      .catch(() => done([summary.extract]));
  }, [summary, intro, introLoading]);

  return { summary, status, intro, introLoading, loadIntro };
}
