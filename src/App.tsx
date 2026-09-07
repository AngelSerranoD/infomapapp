import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FavoritesSheet from './components/FavoritesSheet';
import HelpSheet from './components/HelpSheet';
import { CompassIcon, InstallIcon, LocateIcon, WarningIcon } from './components/Icons';
import MapView, { type Focus } from './components/MapView';
import PlaceSheet from './components/PlaceSheet';
import TopBar from './components/TopBar';
import { CATEGORIES, type CategoryId } from './lib/categories';
import { useFavorites } from './lib/favorites';
import { distanceMeters } from './lib/geo';
import { reverseLookup, type SearchHit } from './lib/nominatim';
import { startPlaceStore } from './lib/placeStore';
import { speak, stopSpeaking } from './lib/speech';
import type { BBox, Place } from './lib/types';
import { useGeolocation } from './lib/useGeolocation';
import { useHeading } from './lib/useHeading';
import { usePlaces, MIN_ZOOM_FOR_PLACES } from './lib/usePlaces';
import { useSettings } from './lib/useSettings';

type SheetKind = 'place' | 'favorites' | 'help';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const ALL_CATEGORIES = CATEGORIES.map((c) => c.id);

/** Tope de chinchetas en pantalla: más que esto no se lee ni va fluido. */
const MAX_PINS = 260;

export default function App() {
  const { settings } = useSettings();
  const { favorites, isFavorite, toggle } = useFavorites();

  const [categories, setCategories] = useState<CategoryId[]>(ALL_CATEGORIES);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [zoom, setZoom] = useState(13);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);

  const [selected, setSelected] = useState<Place | null>(null);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);

  const [focus, setFocus] = useState<Focus | null>(null);
  const [follow, setFollow] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeFailed, setProbeFailed] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  const geo = useGeolocation();
  const compass = useHeading();
  const {
    places: nearby,
    state: placesState,
    error: placesError,
    retry,
  } = usePlaces(bbox, zoom);

  const probeController = useRef<AbortController | null>(null);
  const focusNonce = useRef(0);

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.place.id)), [favorites]);

  // Los filtros se aplican aquí, sobre lo ya descargado: activar o desactivar
  // una categoría es instantáneo y no cuesta ninguna consulta.
  const places = useMemo(() => {
    const active = new Set(categories);
    const shown = nearby.filter((place) => active.has(place.category));
    if (shown.length <= MAX_PINS) return shown;
    return [...shown].sort((a, b) => b.score - a.score).slice(0, MAX_PINS);
  }, [nearby, categories]);

  // El sitio elegido puede no estar entre las chinchetas cargadas (buscador,
  // favoritos o un toque en el mapa): se añade para que se vea marcado.
  const pins = useMemo(() => {
    if (!selected || places.some((p) => p.id === selected.id)) return places;
    return [...places, selected];
  }, [places, selected]);

  const distance = useMemo(() => {
    if (!geo.fix || !selected) return null;
    return distanceMeters(geo.fix.lat, geo.fix.lon, selected.lat, selected.lon);
  }, [geo.fix, selected]);

  // ------------------------------------------------------------------ efectos

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // Al arrancar se pide la posición: es un mapa, sin ella no sirve de mucho.
  useEffect(() => {
    startPlaceStore();
    geo.start();
    setFollow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El primer arreglo del GPS centra el mapa donde esta el usuario.
  const centeredOnce = useRef(false);
  useEffect(() => {
    if (!geo.fix || centeredOnce.current) return;
    centeredOnce.current = true;
    focusNonce.current += 1;
    setFocus({ lat: geo.fix.lat, lon: geo.fix.lon, zoom: 16, nonce: focusNonce.current });
  }, [geo.fix]);

  useEffect(() => () => stopSpeaking(), []);

  // El aviso de "no hay nada en ese punto" se retira solo: no hay nada que hacer
  // con el más que volver a tocar.
  useEffect(() => {
    if (!probeFailed) return;
    const timer = window.setTimeout(() => setProbeFailed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [probeFailed]);

  // ----------------------------------------------------------------- acciones

  const openSheet = useCallback((kind: SheetKind) => {
    setSheet(kind);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    stopSpeaking();
    setSpeaking(false);
  }, []);

  const onSheetExited = useCallback(() => {
    setSheet(null);
    setSheetHeight(0);
    setSelected(null);
  }, []);

  const selectPlace = useCallback(
    (place: Place, zoomTo?: number) => {
      stopSpeaking();
      setSpeaking(false);
      setProbeFailed(false);
      setSelected(place);
      setSheet('place');
      setSheetOpen(true);
      setFollow(false);
      focusNonce.current += 1;
      setFocus({ lat: place.lat, lon: place.lon, zoom: zoomTo, nonce: focusNonce.current });
    },
    [],
  );

  const onMapTap = useCallback(
    (lat: number, lon: number) => {
      if (!settings.tapAnywhere) return;

      // Si el toque cae al lado de un sitio ya cargado, se abre ese: es más
      // exacto que preguntar por coordenadas y no gasta una consulta.
      let nearest: Place | null = null;
      let closest = 45;
      for (const place of places) {
        const gap = distanceMeters(lat, lon, place.lat, place.lon);
        if (gap < closest) {
          closest = gap;
          nearest = place;
        }
      }
      if (nearest) {
        selectPlace(nearest);
        return;
      }

      probeController.current?.abort();
      const ac = new AbortController();
      probeController.current = ac;
      setProbing(true);
      setProbeFailed(false);

      reverseLookup(lat, lon, ac.signal)
        .then((hit: SearchHit | null) => {
          if (ac.signal.aborted) return;
          if (!hit) {
            setProbeFailed(true);
            return;
          }
          selectPlace(hit.place);
        })
        .catch(() => {
          if (!ac.signal.aborted) setProbeFailed(true);
        })
        .finally(() => {
          if (!ac.signal.aborted) setProbing(false);
        });
    },
    [settings.tapAnywhere, selectPlace, places],
  );

  const onViewChange = useCallback((nextBbox: BBox, nextZoom: number) => {
    setBbox(nextBbox);
    setZoom(nextZoom);
    setCenter({
      lat: (nextBbox[0] + nextBbox[2]) / 2,
      lon: (nextBbox[1] + nextBbox[3]) / 2,
    });
  }, []);

  const onUserGesture = useCallback(() => setFollow(false), []);

  /** La diana recorre: apagado -> seguir -> seguir con brújula -> apagado. */
  const onLocate = useCallback(async () => {
    if (geo.status === 'idle' || geo.status === 'denied' || geo.status === 'error') {
      geo.start();
      setFollow(true);
      centeredOnce.current = false;
      return;
    }
    if (!follow) {
      setFollow(true);
      if (geo.fix) {
        focusNonce.current += 1;
        setFocus({
          lat: geo.fix.lat,
          lon: geo.fix.lon,
          zoom: Math.max(zoom, 16),
          nonce: focusNonce.current,
        });
      }
      return;
    }
    if (!compass.enabled) {
      const ok = await compass.enable();
      if (!ok) setFollow(false);
      return;
    }
    compass.disable();
    setFollow(false);
  }, [compass, follow, geo, zoom]);

  const onSpeak = useCallback((text: string, lang: string) => {
    setSpeaking(true);
    speak(text, lang, () => setSpeaking(false));
  }, []);

  const onStopSpeaking = useCallback(() => {
    stopSpeaking();
    setSpeaking(false);
  }, []);

  const toggleCategory = useCallback((id: CategoryId) => {
    setCategories((previous) =>
      previous.includes(id) ? previous.filter((c) => c !== id) : [...previous, id],
    );
  }, []);

  const toggleAll = useCallback(() => {
    setCategories((previous) => (previous.length === ALL_CATEGORIES.length ? [] : ALL_CATEGORIES));
  }, []);

  const onInstall = useCallback(() => {
    installEvent?.prompt();
    setInstallEvent(null);
  }, [installEvent]);

  // ------------------------------------------------------------------ avisos

  // Primero lo que acaba de pasar y el usuario puede resolver; los avisos del
  // GPS van al final porque son estados que duran toda la sesión y taparian el
  // resto.
  const banner = (() => {
    if (!online) {
      return { tone: 'warn' as const, text: 'Sin conexión. Se ven los sitios ya descargados.' };
    }
    if (probing) {
      return { tone: 'busy' as const, text: 'Mirando qué hay en ese punto...' };
    }
    if (probeFailed) {
      return { tone: 'warn' as const, text: 'No hay nada identificado en ese punto del mapa.' };
    }
    if (placesState === 'zoom-out') {
      return { tone: 'info' as const, text: 'Acércate un poco más para ver los sitios.' };
    }
    if (placesState === 'loading') {
      return { tone: 'busy' as const, text: 'Cargando sitios...' };
    }
    if (placesState === 'error' && placesError) {
      return { tone: 'warn' as const, text: placesError, action: retry };
    }
    if (categories.length === 0) {
      return { tone: 'info' as const, text: 'No hay ninguna categoría activa.' };
    }
    if (geo.status === 'insecure') {
      return { tone: 'warn' as const, text: 'Para usar el GPS hay que abrir InfoMap con https.' };
    }
    if (geo.status === 'denied') {
      return {
        tone: 'warn' as const,
        text: 'No hay permiso de ubicación. Actívalo en los ajustes del navegador.',
      };
    }
    if (geo.status === 'unavailable') {
      return { tone: 'warn' as const, text: 'Este dispositivo no da la ubicación.' };
    }
    if (geo.status === 'locating') {
      return { tone: 'busy' as const, text: 'Buscando tu posición...' };
    }
    return null;
  })();

  const locateClass =
    'fab' +
    (follow ? ' is-on' : '') +
    (geo.status === 'locating' ? ' is-locating' : '') +
    (geo.status === 'denied' || geo.status === 'insecure' ? ' is-warn' : '');

  return (
    <>
      <MapView
        places={pins}
        selectedId={sheet === 'place' && sheetOpen ? (selected?.id ?? null) : null}
        favoriteIds={favoriteIds}
        fix={geo.fix}
        fixIsStale={geo.isStale}
        heading={compass.heading}
        follow={follow}
        focus={focus}
        showLabels={settings.showLabels}
        bottomInset={sheetHeight}
        onSelect={selectPlace}
        onMapTap={onMapTap}
        onViewChange={onViewChange}
        onUserGesture={onUserGesture}
      />

      <TopBar
        center={center}
        active={new Set(categories)}
        onToggleCategory={toggleCategory}
        onToggleAll={toggleAll}
        onPick={(hit) => selectPlace(hit.place, Math.max(zoom, MIN_ZOOM_FOR_PLACES + 1))}
        onOpenFavorites={() => openSheet('favorites')}
        onOpenHelp={() => openSheet('help')}
        favoritesCount={favorites.length}
      />

      {banner && (
        <div
          className={'banner' + (banner.tone === 'warn' ? ' is-warn' : '')}
          style={{ top: 'calc(var(--safe-top) + 116px)' }}
          role="status"
        >
          {banner.tone === 'busy' && <span className="spinner" />}
          {banner.tone === 'warn' && <WarningIcon size={16} />}
          <span>{banner.text}</span>
          {'action' in banner && banner.action && (
            <button onClick={banner.action}>Reintentar</button>
          )}
        </div>
      )}

      <div className="fabs" style={{ bottom: `calc(${sheetHeight + 16}px + var(--safe-bottom))` }}>
        {installEvent && (
          <button className="fab" onClick={onInstall} aria-label="Instalar InfoMap">
            <InstallIcon size={21} />
          </button>
        )}
        <button
          className={locateClass}
          onClick={() => void onLocate()}
          aria-label="Centrar en mi posición"
          aria-pressed={follow}
        >
          {compass.enabled ? <CompassIcon size={21} /> : <LocateIcon size={21} />}
        </button>
      </div>

      {sheet === 'place' && selected && (
        <PlaceSheet
          place={selected}
          open={sheetOpen}
          distance={distance}
          isFavorite={isFavorite(selected.id)}
          speaking={speaking}
          autoSpeak={settings.autoSpeak}
          onToggleFavorite={() => toggle(selected)}
          onSpeak={onSpeak}
          onStopSpeaking={onStopSpeaking}
          onClose={closeSheet}
          onExited={onSheetExited}
          onVisibleHeight={setSheetHeight}
        />
      )}

      {sheet === 'favorites' && (
        <FavoritesSheet
          open={sheetOpen}
          fix={geo.fix}
          onPick={(place) => selectPlace(place, Math.max(zoom, 16))}
          onClose={closeSheet}
          onExited={onSheetExited}
          onVisibleHeight={setSheetHeight}
        />
      )}

      {sheet === 'help' && (
        <HelpSheet
          open={sheetOpen}
          installable={!!installEvent}
          onInstall={onInstall}
          onClose={closeSheet}
          onExited={onSheetExited}
          onVisibleHeight={setSheetHeight}
        />
      )}
    </>
  );
}
