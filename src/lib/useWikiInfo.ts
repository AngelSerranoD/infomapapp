import { useCallback, useEffect, useRef, useState } from 'react';
import type { Place, WikiSummary } from './types';
import { fetchIntro, lookupWikipedia } from './wikipedia';

export type WikiStatus = 'idle' | 'loading' | 'ready' | 'none' | 'error';

export function useWikiInfo(place: Place | null) {
  const [summary, setSummary] = useState<WikiSummary | null>(null);
  const [status, setStatus] = useState<WikiStatus>('idle');
  const [intro, setIntro] = useState<string[] | null>(null);
  const [introLoading, setIntroLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    setSummary(null);
    setIntro(null);
    setIntroLoading(false);

    if (!place) {
      setStatus('idle');
      return;
    }

    const ac = new AbortController();
    controller.current = ac;
    setStatus('loading');

    lookupWikipedia(place, ac.signal)
      .then((found) => {
        if (ac.signal.aborted) return;
        setSummary(found);
        setStatus(found ? 'ready' : 'none');
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setStatus('error');
      });

    return () => ac.abort();
  }, [place]);

  const loadIntro = useCallback(() => {
    if (!summary || intro || introLoading) return;
    const ac = new AbortController();
    setIntroLoading(true);
    fetchIntro(summary.lang, summary.title, ac.signal)
      .then((paragraphs) => setIntro(paragraphs.length ? paragraphs : [summary.extract]))
      .catch(() => setIntro([summary.extract]))
      .finally(() => setIntroLoading(false));
  }, [summary, intro, introLoading]);

  return { summary, status, intro, introLoading, loadIntro };
}
