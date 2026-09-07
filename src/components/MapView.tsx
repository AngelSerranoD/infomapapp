import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { categoryColor } from '../lib/categories';
import type { BBox, Fix, Place } from '../lib/types';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  'Sitios y mapa: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export interface Focus {
  lat: number;
  lon: number;
  zoom?: number;
  /** Cambia en cada petición para poder repetir el mismo destino. */
  nonce: number;
}

interface Props {
  places: Place[];
  selectedId: string | null;
  favoriteIds: Set<string>;
  fix: Fix | null;
  fixIsStale: boolean;
  heading: number | null;
  follow: boolean;
  focus: Focus | null;
  /** Etiqueta con el nombre bajo cada chincheta cuando el zoom lo permite. */
  showLabels: boolean;
  /** Alto ocupado por la ficha, para centrar sobre la parte visible del mapa. */
  bottomInset: number;
  onSelect: (place: Place) => void;
  onMapTap: (lat: number, lon: number) => void;
  onViewChange: (bbox: BBox, zoom: number) => void;
  onUserGesture: () => void;
}

/** Tamaño de chincheta según el zoom: lejos pequeñas, cerca legibles. */
function pinSize(zoom: number): number {
  if (zoom >= 17) return 30;
  if (zoom >= 16) return 26;
  return 22;
}

/** Identifica el aspecto actual de las chinchetas: si cambia, hay que rehacerlas. */
function iconBucket(zoom: number, showLabels: boolean): number {
  return pinSize(zoom) * 10 + (showLabels && zoom >= 16 ? 1 : 0);
}

function buildIcon(
  place: Place,
  zoom: number,
  showLabels: boolean,
  isFavorite: boolean,
  isSelected: boolean,
): L.DivIcon {
  const size = pinSize(zoom);
  const withLabel = showLabels && zoom >= 16;
  const classes = ['pin-wrap'];
  if (isFavorite) classes.push('is-fav');
  if (isSelected) classes.push('is-selected');

  const label = withLabel
    ? `<div class="pin-label">${escapeHtml(place.name)}</div>`
    : '';

  return L.divIcon({
    className: classes.join(' '),
    html:
      `<div class="pin" style="width:${size}px;height:${size}px;background:${categoryColor(
        place.category,
      )}">` +
      `<span style="font-size:${Math.round(size * 0.5)}px">${place.glyph}</span></div>${label}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toBBox(bounds: L.LatLngBounds): BBox {
  return [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()];
}

const VIEW_KEY = 'infomap.view.v1';
const DEFAULT_VIEW = { lat: 40.4168, lon: -3.7038, zoom: 13 };

/**
 * Vista inicial: primero la de la URL (#zoom/lat/lon, útil para compartir un
 * sitio), luego la última que se estaba mirando, y si no Madrid. Asi la app
 * abre en algo reconocible mientras el GPS todavía está enganchando.
 */
function initialView(): { lat: number; lon: number; zoom: number } {
  const hash = /^#(\d{1,2}(?:\.\d+)?)\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)$/.exec(
    window.location.hash,
  );
  if (hash) {
    return { zoom: Number(hash[1]), lat: Number(hash[2]), lon: Number(hash[3]) };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null');
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) return saved;
  } catch {
    /* dato corrupto: se ignora y se abre en el sitio por defecto */
  }
  return DEFAULT_VIEW;
}

function rememberView(map: L.Map) {
  const center = map.getCenter();
  try {
    localStorage.setItem(
      VIEW_KEY,
      JSON.stringify({ lat: center.lat, lon: center.lng, zoom: map.getZoom() }),
    );
  } catch {
    /* sin espacio: se abrirá donde diga el GPS */
  }
}

export default function MapView({
  places,
  selectedId,
  favoriteIds,
  fix,
  fixIsStale,
  heading,
  follow,
  focus,
  showLabels,
  bottomInset,
  onSelect,
  onMapTap,
  onViewChange,
  onUserGesture,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const meMarkerRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const zoomBucketRef = useRef(0);
  const programmatic = useRef(false);

  // Los callbacks se guardan en refs para que el mapa se cree una sola vez.
  const handlers = useRef({ onSelect, onMapTap, onViewChange, onUserGesture });
  handlers.current = { onSelect, onMapTap, onViewChange, onUserGesture };
  const insetRef = useRef(bottomInset);
  insetRef.current = bottomInset;

  /**
   * Centra dejando el punto por encima de la ficha, no debajo.
   * `pan` es para el seguimiento del GPS: desplaza sin tocar el zoom, que se
   * repite cada segundo y un vuelo completo marearía.
   */
  const centerOn = (lat: number, lon: number, zoom?: number, mode: 'fly' | 'pan' = 'fly') => {
    const map = mapRef.current;
    if (!map) return;
    const targetZoom = mode === 'pan' ? map.getZoom() : (zoom ?? map.getZoom());
    const point = map.project([lat, lon], targetZoom);
    const shifted = point.add([0, insetRef.current / 2]);
    const latlng = map.unproject(shifted, targetZoom);
    programmatic.current = true;
    if (mode === 'pan') map.panTo(latlng, { duration: 0.4 });
    else map.flyTo(latlng, targetZoom, { duration: 0.7 });
  };

  // ------------------------------------------------------------- crear mapa
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const view = initialView();
    const map = L.map(container, {
      center: [view.lat, view.lon],
      zoom: view.zoom,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
      maxZoom: 19,
    });

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Atajo para inspeccionar el mapa desde la consola mientras se desarrolla.
    if (import.meta.env.DEV) (window as unknown as { __map?: L.Map }).__map = map;

    const emitView = () => {
      handlers.current.onViewChange(toBBox(map.getBounds()), map.getZoom());
    };
    // El zoom también lo dispara la propia app, así que hay que distinguirlo.
    const onZoomGesture = () => {
      if (programmatic.current) return;
      handlers.current.onUserGesture();
    };

    map.on('moveend zoomend', () => {
      programmatic.current = false;
      emitView();
      rememberView(map);
    });
    // Arrastrar solo lo hace el usuario: nunca lo provoca setView ni flyTo.
    map.on('dragstart', () => handlers.current.onUserGesture());
    map.on('zoomstart', onZoomGesture);
    map.on('resize', emitView);

    map.on('click', (event: L.LeafletMouseEvent) => {
      // Los toques sobre una chincheta ya los gestiona el propio marcador.
      const target = event.originalEvent?.target as HTMLElement | null;
      if (target?.closest?.('.pin-wrap')) return;
      handlers.current.onMapTap(event.latlng.lat, event.latlng.lng);
    });

    emitView();

    // Leaflet mide el contenedor al crearse y se queda con ese tamaño. Hay que
    // avisarle cuando cambia: al montar (el CSS puede llegar después), al girar
    // el móvil y cuando la barra del navegador aparece o desaparece.
    const invalidate = () => map.invalidateSize({ animate: false });
    const frame = requestAnimationFrame(invalidate);
    const observer = new ResizeObserver(invalidate);
    observer.observe(container);
    window.addEventListener('orientationchange', invalidate);

    const markers = markersRef.current;
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('orientationchange', invalidate);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markers.clear();
      meMarkerRef.current = null;
      accuracyRef.current = null;
    };
  }, []);

  // ------------------------------------------------------ chinchetas de sitios
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    const zoom = map.getZoom();
    const bucket = iconBucket(zoom, showLabels);
    const bucketChanged = bucket !== zoomBucketRef.current;
    zoomBucketRef.current = bucket;

    const markers = markersRef.current;
    const wanted = new Set(places.map((p) => p.id));

    for (const [id, marker] of markers) {
      if (!wanted.has(id)) {
        layer.removeLayer(marker);
        markers.delete(id);
      }
    }

    for (const place of places) {
      const isSelected = place.id === selectedId;
      const isFavorite = favoriteIds.has(place.id);
      const existing = markers.get(place.id);

      if (existing) {
        if (bucketChanged) {
          existing.setIcon(buildIcon(place, zoom, showLabels, isFavorite, isSelected));
        } else {
          const element = existing.getElement();
          element?.classList.toggle('is-selected', isSelected);
          element?.classList.toggle('is-fav', isFavorite);
        }
        continue;
      }

      const marker = L.marker([place.lat, place.lon], {
        icon: buildIcon(place, zoom, showLabels, isFavorite, isSelected),
        riseOnHover: true,
        keyboard: false,
        zIndexOffset: Math.round(place.score),
      });
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event as unknown as Event);
        handlers.current.onSelect(place);
      });
      marker.addTo(layer);
      markers.set(place.id, marker);
    }
  }, [places, selectedId, favoriteIds, showLabels]);

  // Al cambiar de zoom hay que rehacer los iconos (tamaño y etiqueta).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onZoom = () => {
      const zoom = map.getZoom();
      const bucket = iconBucket(zoom, showLabels);
      if (bucket === zoomBucketRef.current) return;
      zoomBucketRef.current = bucket;
      for (const place of places) {
        const marker = markersRef.current.get(place.id);
        marker?.setIcon(
          buildIcon(place, zoom, showLabels, favoriteIds.has(place.id), place.id === selectedId),
        );
      }
    };
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [places, favoriteIds, selectedId, showLabels]);

  // ------------------------------------------------------------- posición GPS
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!fix) {
      meMarkerRef.current?.remove();
      accuracyRef.current?.remove();
      meMarkerRef.current = null;
      accuracyRef.current = null;
      return;
    }

    const latlng: L.LatLngExpression = [fix.lat, fix.lon];

    if (!meMarkerRef.current) {
      meMarkerRef.current = L.marker(latlng, {
        icon: L.divIcon({
          className: 'me-wrap',
          html: '<div class="me-cone"></div><div class="me-dot"><div class="me-pulse"></div></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1200,
      }).addTo(map);
    } else {
      meMarkerRef.current.setLatLng(latlng);
    }

    if (!accuracyRef.current) {
      accuracyRef.current = L.circle(latlng, {
        radius: fix.accuracy,
        color: '#4bb4de',
        weight: 1,
        opacity: 0.5,
        fillColor: '#4bb4de',
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(map);
    } else {
      accuracyRef.current.setLatLng(latlng);
      accuracyRef.current.setRadius(fix.accuracy);
    }

    if (follow) centerOn(fix.lat, fix.lon, undefined, 'pan');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix, follow]);

  // Rumbo y estado del punto: se tocan los nodos directamente, sin repintar Leaflet.
  useEffect(() => {
    const element = meMarkerRef.current?.getElement();
    if (!element) return;
    const cone = element.querySelector<HTMLElement>('.me-cone');
    const dot = element.querySelector<HTMLElement>('.me-dot');
    const value = heading ?? (fix?.speed && fix.speed > 0.6 ? fix.heading : null);
    if (cone) {
      cone.style.display = value === null ? 'none' : 'block';
      if (value !== null) cone.style.transform = `rotate(${value}deg)`;
    }
    dot?.classList.toggle('is-stale', fixIsStale);
  }, [heading, fix, fixIsStale]);

  // --------------------------------------------------------- destino puntual
  useEffect(() => {
    if (!focus) return;
    centerOn(focus.lat, focus.lon, focus.zoom, 'fly');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  return <div className="map" ref={containerRef} />;
}
