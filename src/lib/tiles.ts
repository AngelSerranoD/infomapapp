/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import type { BBox } from './types';

/**
 * Los sitios se piden y se guardan por teselas fijas, no por lo que se ve en
 * pantalla: asi el mismo trozo de ciudad se descarga una sola vez y volver a el
 * es instantaneo. Se usa la misma cuadricula que las teselas del mapa.
 *
 * A zoom 14 cada tesela mide unos 1,9 km de lado, que es lo que cabe en una
 * pantalla de movil con un margen alrededor.
 */
export const TILE_ZOOM = 14;

export interface Tile {
  x: number;
  y: number;
}

export function tileKey(tile: Tile): string {
  return `${TILE_ZOOM}/${tile.x}/${tile.y}`;
}

const SIDE = 2 ** TILE_ZOOM;

function lonToX(lon: number): number {
  return Math.floor(((lon + 180) / 360) * SIDE);
}

function latToY(lat: number): number {
  const clamped = Math.max(-85.05, Math.min(85.05, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * SIDE,
  );
}

function yToLat(y: number): number {
  const n = Math.PI - (2 * Math.PI * y) / SIDE;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tileBBox(tile: Tile): BBox {
  return [
    yToLat(tile.y + 1),
    (tile.x / SIDE) * 360 - 180,
    yToLat(tile.y),
    ((tile.x + 1) / SIDE) * 360 - 180,
  ];
}

export function tileCenter(tile: Tile): { lat: number; lon: number } {
  const [south, west, north, east] = tileBBox(tile);
  return { lat: (south + north) / 2, lon: (west + east) / 2 };
}

/** Teselas que toca el area visible, las del centro primero. */
export function tilesForBBox(bbox: BBox, limit: number): Tile[] {
  const [south, west, north, east] = bbox;
  const centerLat = (south + north) / 2;
  const centerLon = (west + east) / 2;

  const tiles: Tile[] = [];
  for (let x = lonToX(west); x <= lonToX(east); x++) {
    for (let y = latToY(north); y <= latToY(south); y++) {
      tiles.push({ x, y });
    }
  }

  // Si hay mas de las que se pueden pedir, se quedan las del centro de la
  // pantalla, que es donde esta mirando el usuario.
  if (tiles.length > limit) {
    tiles.sort((a, b) => {
      const ca = tileCenter(a);
      const cb = tileCenter(b);
      const da = (ca.lat - centerLat) ** 2 + (ca.lon - centerLon) ** 2;
      const db = (cb.lat - centerLat) ** 2 + (cb.lon - centerLon) ** 2;
      return da - db;
    });
    return tiles.slice(0, limit);
  }
  return tiles;
}
