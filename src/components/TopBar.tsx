/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import { useEffect, useRef, useState } from 'react';
import { searchPlaces, type SearchHit } from '../lib/nominatim';
import { CATEGORIES, type CategoryId } from '../lib/categories';
import { CloseIcon, InfoIcon, ListIcon, SearchIcon } from './Icons';

interface Props {
  center: { lat: number; lon: number } | null;
  active: Set<CategoryId>;
  onToggleCategory: (id: CategoryId) => void;
  onToggleAll: () => void;
  onPick: (hit: SearchHit) => void;
  onOpenFavorites: () => void;
  onOpenHelp: () => void;
  favoritesCount: number;
}

export default function TopBar({
  center,
  active,
  onToggleCategory,
  onToggleAll,
  onPick,
  onOpenFavorites,
  onOpenHelp,
  favoritesCount,
}: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    controller.current?.abort();
    const text = query.trim();
    if (text.length < 3) {
      setHits(null);
      setSearching(false);
      return;
    }

    const ac = new AbortController();
    controller.current = ac;
    setSearching(true);

    const timer = window.setTimeout(() => {
      searchPlaces(text, center, ac.signal)
        .then((results) => {
          if (ac.signal.aborted) return;
          setHits(results);
        })
        .catch(() => {
          if (!ac.signal.aborted) setHits([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setSearching(false);
        });
    }, 400);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
    // El centro solo sirve para priorizar: no reactiva la búsqueda al mover el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const allOn = active.size === CATEGORIES.length;
  const showResults = focused && query.trim().length >= 3;

  const clear = () => {
    setQuery('');
    setHits(null);
    inputRef.current?.focus();
  };

  return (
    <div className="top">
      <div className="searchbar">
        <span className="brand">
          Info<em>Map</em>
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 180)}
          placeholder="Buscar sitio o dirección"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Buscar sitio o dirección"
        />
        {query ? (
          <button className="icon-btn" onClick={clear} aria-label="Borrar búsqueda">
            <CloseIcon size={18} />
          </button>
        ) : (
          <span className="icon-btn" aria-hidden="true">
            <SearchIcon size={18} />
          </span>
        )}
        <button
          className={'icon-btn' + (favoritesCount ? ' has-items' : '')}
          onClick={onOpenFavorites}
          aria-label={`Favoritos (${favoritesCount})`}
        >
          <ListIcon size={18} />
        </button>
        <button className="icon-btn" onClick={onOpenHelp} aria-label="Ayuda y ajustes">
          <InfoIcon size={18} />
        </button>
      </div>

      {showResults && (
        <div className="results">
          {searching && (
            <div className="r-empty">
              <span className="spinner" />
              Buscando...
            </div>
          )}
          {!searching && hits?.length === 0 && (
            <div className="r-empty">Sin resultados para esa búsqueda.</div>
          )}
          {!searching &&
            hits?.map((hit) => (
              <button
                key={`${hit.place.id}-${hit.place.lat}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery('');
                  setHits(null);
                  setFocused(false);
                  onPick(hit);
                }}
              >
                <span className="r-ico">{hit.place.glyph}</span>
                <span className="r-body">
                  <span className="r-name">{hit.place.name}</span>
                  <span className="r-sub">{hit.address}</span>
                </span>
              </button>
            ))}
        </div>
      )}

      <div className="chips" role="group" aria-label="Filtrar por categoría">
        <button
          className={'chip is-all' + (allOn ? ' is-on' : '')}
          onClick={onToggleAll}
          aria-pressed={allOn}
        >
          {allOn ? 'Todo' : 'Ver todo'}
        </button>
        {CATEGORIES.map((category) => {
          const on = active.has(category.id);
          return (
            <button
              key={category.id}
              className={'chip' + (on ? ' is-on' : '')}
              style={on ? { background: category.color } : undefined}
              onClick={() => onToggleCategory(category.id)}
              aria-pressed={on}
            >
              <span
                className="dot"
                style={{ background: on ? 'rgba(22,41,61,.55)' : category.color }}
              />
              {category.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
