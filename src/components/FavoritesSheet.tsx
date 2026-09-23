/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import { categoryColor } from '../lib/categories';
import { useFavorites } from '../lib/favorites';
import { formatDistance } from '../lib/geo';
import type { Fix, Place } from '../lib/types';
import { distanceMeters } from '../lib/geo';
import { CloseIcon, StarIcon, TrashIcon } from './Icons';
import Sheet from './Sheet';

interface Props {
  open: boolean;
  fix: Fix | null;
  onPick: (place: Place) => void;
  onClose: () => void;
  onExited: () => void;
  onVisibleHeight: (height: number) => void;
}

export default function FavoritesSheet({
  open,
  fix,
  onPick,
  onClose,
  onExited,
  onVisibleHeight,
}: Props) {
  const { favorites, remove } = useFavorites();

  const sorted = fix
    ? [...favorites].sort(
        (a, b) =>
          distanceMeters(fix.lat, fix.lon, a.place.lat, a.place.lon) -
          distanceMeters(fix.lat, fix.lon, b.place.lat, b.place.lon),
      )
    : favorites;

  const header = (
    <div className="sheet-head">
      <div className="h-ico" style={{ background: 'var(--sand)', color: '#16293d' }}>
        <StarIcon size={19} />
      </div>
      <div className="h-txt">
        <h2 className="sheet-title">Guardados</h2>
        <div className="sheet-sub">
          <span>
            {favorites.length === 0
              ? 'Todavía no has guardado nada'
              : `${favorites.length} ${favorites.length === 1 ? 'sitio' : 'sitios'}`}
          </span>
        </div>
      </div>
      <button className="sheet-close" onClick={onClose} aria-label="Cerrar">
        <CloseIcon size={16} />
      </button>
    </div>
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
        {favorites.length === 0 ? (
          <div className="sheet-empty">
            Toca un sitio en el mapa y pulsa <strong>Guardar</strong> para tenerlo aquí. Los sitios
            guardados se quedan en este móvil y funcionan sin conexión.
          </div>
        ) : (
          <div className="fav-list">
            {sorted.map(({ place }) => (
              <div className="fav-row" key={place.id}>
                <button
                  className="f-ico"
                  style={{ background: categoryColor(place.category), color: '#16293d' }}
                  onClick={() => onPick(place)}
                  aria-label={`Ir a ${place.name}`}
                >
                  <span>{place.glyph}</span>
                </button>
                <button className="f-txt" onClick={() => onPick(place)}>
                  <div className="f-name">{place.name}</div>
                  <div className="f-sub">
                    {place.typeLabel}
                    {fix
                      ? ` · a ${formatDistance(
                          distanceMeters(fix.lat, fix.lon, place.lat, place.lon),
                        )}`
                      : ''}
                  </div>
                </button>
                <button
                  className="f-del"
                  onClick={() => remove(place.id)}
                  aria-label={`Quitar ${place.name} de guardados`}
                >
                  <TrashIcon size={17} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
