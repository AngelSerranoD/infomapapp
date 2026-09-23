/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { categoryColor } from '../lib/categories';
import { directionsAppName, openDirections } from '../lib/directions';
import { formatDistance } from '../lib/geo';
import { formatOpeningHours, isOpenNow } from '../lib/openingHours';
import { speechSupported } from '../lib/speech';
import type { Place } from '../lib/types';
import { useWikiInfo } from '../lib/useWikiInfo';
import {
  ClockIcon,
  CloseIcon,
  EuroIcon,
  ExternalIcon,
  GlobeIcon,
  PhoneIcon,
  PinIcon,
  RouteIcon,
  SpeakerIcon,
  StarFilledIcon,
  StarIcon,
  StopIcon,
} from './Icons';
import Sheet from './Sheet';

interface Props {
  place: Place;
  open: boolean;
  distance: number | null;
  isFavorite: boolean;
  speaking: boolean;
  autoSpeak: boolean;
  onToggleFavorite: () => void;
  onSpeak: (text: string, lang: string) => void;
  onStopSpeaking: () => void;
  onClose: () => void;
  onExited: () => void;
  onVisibleHeight: (height: number) => void;
}

interface Fact {
  key: string;
  icon: ReactNode;
  value: ReactNode;
}

function buildFacts(place: Place): Fact[] {
  const tags = place.tags;
  const facts: Fact[] = [];

  const hours = tags.opening_hours;
  if (hours) {
    const open = isOpenNow(hours);
    facts.push({
      key: 'hours',
      icon: <ClockIcon size={17} />,
      value: (
        <>
          {open !== null && (
            <span className={open ? 'open-now' : 'open-closed'}>
              {open ? 'Abierto ahora' : 'Cerrado ahora'}
            </span>
          )}
          {open !== null && ' · '}
          {formatOpeningHours(hours)}
        </>
      ),
    });
  }

  const phone = tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'];
  if (phone) {
    facts.push({
      key: 'phone',
      icon: <PhoneIcon size={17} />,
      value: <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>,
    });
  }

  const website = tags.website ?? tags['contact:website'] ?? tags.url;
  if (website) {
    const href = website.startsWith('http') ? website : `https://${website}`;
    facts.push({
      key: 'web',
      icon: <GlobeIcon size={17} />,
      value: (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {href.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </a>
      ),
    });
  }

  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const address = [street, city].filter(Boolean).join(', ');
  if (address) {
    facts.push({ key: 'addr', icon: <PinIcon size={17} />, value: address });
  }

  const extras: string[] = [];
  if (tags.cuisine) extras.push(`Cocina: ${tags.cuisine.replace(/[_;]/g, ' ').trim()}`);
  if (tags.stars) extras.push(`${tags.stars} estrellas`);
  if (tags.fee === 'yes') extras.push('Entrada de pago');
  if (tags.fee === 'no') extras.push('Entrada gratuita');
  if (tags.wheelchair === 'yes') extras.push('Accesible en silla de ruedas');
  if (tags.outdoor_seating === 'yes') extras.push('Con terraza');
  if (tags.operator) extras.push(`Gestionado por ${tags.operator}`);
  if (extras.length) {
    facts.push({ key: 'extras', icon: <EuroIcon size={17} />, value: extras.join(' · ') });
  }

  return facts;
}

export default function PlaceSheet({
  place,
  open,
  distance,
  isFavorite,
  speaking,
  autoSpeak,
  onToggleFavorite,
  onSpeak,
  onStopSpeaking,
  onClose,
  onExited,
  onVisibleHeight,
}: Props) {
  const { summary, status, intro, introLoading, loadIntro } = useWikiInfo(place);
  const facts = useMemo(() => buildFacts(place), [place]);
  const osmDescription = place.tags['description:es'] ?? place.tags.description;

  const spokenText = summary
    ? `${summary.title}. ${(intro ?? [summary.extract]).join(' ')}`
    : osmDescription
      ? `${place.name}. ${osmDescription}`
      : '';
  const spokenLang = summary?.lang ?? 'es';

  // Lectura automática: una sola vez por sitio, cuando ya hay texto que leer.
  const spokenFor = useRef<string | null>(null);
  useEffect(() => {
    if (!autoSpeak || !spokenText) return;
    if (status !== 'ready' && status !== 'none') return;
    if (spokenFor.current === place.id) return;
    spokenFor.current = place.id;
    onSpeak(spokenText, spokenLang);
  }, [autoSpeak, spokenText, spokenLang, status, place.id, onSpeak]);

  const header = (
    <>
      <div className="sheet-head">
        <div
          className="h-ico"
          style={{ background: categoryColor(place.category), color: '#16293d' }}
        >
          <span>{place.glyph}</span>
        </div>
        <div className="h-txt">
          <h2 className="sheet-title">{place.name}</h2>
          <div className="sheet-sub">
            <span>{place.typeLabel}</span>
            {distance !== null && (
              <>
                <span className="sep">·</span>
                <span className="dist">a {formatDistance(distance)}</span>
              </>
            )}
            {summary?.description && (
              <>
                <span className="sep">·</span>
                <span>{summary.description}</span>
              </>
            )}
          </div>
        </div>
        <button className="sheet-close" onClick={onClose} aria-label="Cerrar ficha">
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="sheet-actions">
        <button
          className="act primary"
          onClick={() => openDirections(place)}
          title={`Abrir la ruta en ${directionsAppName}`}
        >
          <RouteIcon size={16} />
          Cómo llegar
        </button>
        <button
          className={'act' + (isFavorite ? ' is-on' : '')}
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
        >
          {isFavorite ? <StarFilledIcon size={16} /> : <StarIcon size={16} />}
          {isFavorite ? 'Guardado' : 'Guardar'}
        </button>
        {speechSupported && spokenText && (
          <button
            className={'act' + (speaking ? ' is-on' : '')}
            onClick={() => (speaking ? onStopSpeaking() : onSpeak(spokenText, spokenLang))}
          >
            {speaking ? <StopIcon size={16} /> : <SpeakerIcon size={16} />}
            {speaking ? 'Parar' : 'Escuchar'}
          </button>
        )}
        {summary && (
          <a
            className="act"
            href={summary.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalIcon size={16} />
            Wikipedia
          </a>
        )}
      </div>
    </>
  );

  return (
    <Sheet
      open={open}
      header={header}
      onClose={onClose}
      onExited={onExited}
      onVisibleHeight={onVisibleHeight}
    >
      <div className="sheet-body">
        {status === 'loading' && (
          <div className="sheet-state">
            <span className="spinner" />
            Buscando la información del sitio...
          </div>
        )}

        {status === 'error' && (
          <div className="sheet-empty">
            No se ha podido consultar Wikipedia. Comprueba la conexión y vuelve a tocar el sitio.
          </div>
        )}

        {status === 'ready' && summary && (
          <>
            {summary.thumbnail && (
              <figure className="wiki-figure">
                <img src={summary.thumbnail} alt={summary.title} loading="lazy" />
              </figure>
            )}

            {(intro ?? [summary.extract]).map((paragraph, index) => (
              <p className="wiki-extract" key={index}>
                {paragraph}
              </p>
            ))}

            {!intro && (
              <button className="more-btn" onClick={loadIntro} disabled={introLoading}>
                {introLoading ? <span className="spinner" /> : null}
                {introLoading ? 'Cargando...' : 'Leer más'}
              </button>
            )}

            <p className="wiki-src">
              <span className="lang-tag">{summary.lang}</span>
              Resumen de Wikipedia
              {summary.match === 'geo' || summary.match === 'search'
                ? ' (artículo encontrado por cercanía y nombre)'
                : ''}
            </p>
          </>
        )}

        {status === 'none' && (
          <div className="sheet-empty">
            {osmDescription ? (
              <p className="wiki-extract">{osmDescription}</p>
            ) : (
              <>
                <strong>Este sitio no tiene artículo en Wikipedia.</strong> Suele pasar con bares,
                tiendas y sitios pequeños. Abajo tienes lo que sí se sabe de el.
              </>
            )}
          </div>
        )}

        {facts.length > 0 && (
          <div className="facts">
            <h3>Datos del sitio</h3>
            {facts.map((fact) => (
              <div className="fact" key={fact.key}>
                <span className="f-ico">{fact.icon}</span>
                <span className="f-val">{fact.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
