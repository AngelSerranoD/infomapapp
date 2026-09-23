/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import type { CategoryId } from './categories';

export type OsmType = 'node' | 'way' | 'relation';

export interface Place {
  /** "node/240109189" — identificador estable de OpenStreetMap. */
  id: string;
  osmType: OsmType;
  osmId: number;
  lat: number;
  lon: number;
  name: string;
  category: CategoryId;
  /** Tipo concreto ya traducido: "Museo", "Cafetería"... */
  typeLabel: string;
  glyph: string;
  tags: Record<string, string>;
  /** Prioridad al recortar chinchetas cuando hay demasiadas. */
  score: number;
}

/** [sur, oeste, norte, este] */
export type BBox = [number, number, number, number];

export interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface WikiSummary {
  title: string;
  lang: string;
  description?: string;
  extract: string;
  thumbnail?: string;
  url: string;
  /** Como se encontro el artículo, para saber cuanto fiarse. */
  match: 'wikidata' | 'wikipedia-tag' | 'geo' | 'search';
}
