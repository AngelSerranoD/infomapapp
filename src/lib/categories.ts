/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

export type CategoryId =
  | 'culture'
  | 'food'
  | 'nature'
  | 'sleep'
  | 'shop'
  | 'services'
  | 'transport';

/**
 * Que etiquetas de OpenStreetMap forman la categoria. Se declaran como datos,
 * no como texto de consulta, para que Overpass pueda juntar en un solo bloque
 * todas las categorias que comparten clave.
 */
export interface TagFilter {
  key: string;
  /** Si no se indican, vale cualquier valor de esa clave. */
  values?: string[];
  /** Etiquetas tan abundantes que necesitan su propio cupo de resultados. */
  dense?: boolean;
}

export interface Category {
  id: CategoryId;
  label: string;
  glyph: string;
  color: string;
  filters: TagFilter[];
  /** Peso al recortar la lista de chinchetas: más alto = se conserva antes. */
  weight: number;
}

export const CATEGORIES: Category[] = [
  {
    id: 'culture',
    label: 'Cultura',
    glyph: '\u{1F3DB}️',
    color: '#345da7',
    weight: 100,
    filters: [
      { key: 'tourism', values: ['museum', 'gallery', 'artwork', 'attraction', 'theme_park', 'zoo', 'aquarium'] },
      { key: 'historic', values: ['castle', 'monument', 'memorial', 'ruins', 'archaeological_site', 'church', 'fort', 'city_gate', 'tower', 'manor', 'monastery', 'aqueduct', 'wayside_cross'] },
      { key: 'amenity', values: ['theatre', 'arts_centre', 'library', 'cinema', 'place_of_worship'] },
    ],
  },
  {
    id: 'food',
    label: 'Comer',
    glyph: '\u{1F37D}️',
    color: '#efdbcb',
    weight: 60,
    filters: [{ key: 'amenity', values: ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'biergarten', 'ice_cream', 'food_court'] }],
  },
  {
    id: 'nature',
    label: 'Naturaleza',
    glyph: '\u{1F333}',
    color: '#4bb4de',
    weight: 90,
    filters: [
      { key: 'leisure', values: ['park', 'garden', 'nature_reserve'] },
      { key: 'natural', values: ['beach', 'peak', 'spring', 'cave_entrance', 'volcano', 'waterfall', 'glacier'] },
      { key: 'tourism', values: ['viewpoint', 'picnic_site'] },
    ],
  },
  {
    id: 'sleep',
    label: 'Dormir',
    glyph: '\u{1F6CF}️',
    color: '#3b8ac4',
    weight: 50,
    filters: [
      { key: 'tourism', values: ['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'chalet', 'camp_site', 'caravan_site', 'alpine_hut'] },
    ],
  },
  {
    id: 'shop',
    label: 'Tiendas',
    glyph: '\u{1F6CD}️',
    color: '#d9bda2',
    weight: 30,
    filters: [{ key: 'shop', dense: true }, { key: 'amenity', values: ['marketplace'] }],
  },
  {
    id: 'services',
    label: 'Servicios',
    glyph: '\u{1F3E5}',
    color: '#74cbe8',
    weight: 40,
    filters: [
      { key: 'amenity', values: ['pharmacy', 'hospital', 'clinic', 'doctors', 'dentist', 'bank', 'atm', 'fuel', 'police', 'post_office', 'toilets', 'charging_station', 'veterinary', 'fire_station', 'townhall', 'courthouse', 'embassy'] },
      { key: 'tourism', values: ['information'] },
    ],
  },
  {
    id: 'transport',
    label: 'Transporte',
    glyph: '\u{1F686}',
    color: '#2b4a86',
    weight: 70,
    filters: [
      { key: 'railway', values: ['station', 'halt', 'tram_stop', 'subway_entrance'] },
      { key: 'amenity', values: ['bus_station', 'taxi', 'bicycle_rental', 'car_rental', 'ferry_terminal', 'parking'] },
      { key: 'aeroway', values: ['aerodrome', 'terminal'] },
    ],
  },
];

export const CATEGORY_BY_ID = new Map<CategoryId, Category>(CATEGORIES.map((c) => [c.id, c]));

export function categoryColor(id: CategoryId): string {
  return CATEGORY_BY_ID.get(id)?.color ?? '#3b8ac4';
}

/** Etiqueta legible en español por tipo concreto de sitio. */
const SUBTYPE_LABELS: Record<string, string> = {
  // Cultura
  'tourism=museum': 'Museo',
  'tourism=gallery': 'Galería de arte',
  'tourism=artwork': 'Obra de arte',
  'tourism=attraction': 'Atracción turística',
  'tourism=theme_park': 'Parque de atracciones',
  'tourism=zoo': 'Zoo',
  'tourism=aquarium': 'Acuario',
  'tourism=viewpoint': 'Mirador',
  'tourism=picnic_site': 'Área de picnic',
  'tourism=information': 'Oficina de información',
  'historic=castle': 'Castillo',
  'historic=monument': 'Monumento',
  'historic=memorial': 'Memorial',
  'historic=ruins': 'Ruinas',
  'historic=archaeological_site': 'Yacimiento arqueológico',
  'historic=church': 'Iglesia histórica',
  'historic=fort': 'Fortaleza',
  'historic=city_gate': 'Puerta de la muralla',
  'historic=tower': 'Torre',
  'historic=manor': 'Casa señorial',
  'historic=monastery': 'Monasterio',
  'historic=aqueduct': 'Acueducto',
  'historic=wayside_cross': 'Crucero',
  'historic=tomb': 'Tumba',
  'historic=wayside_shrine': 'Ermita',
  'historic=battlefield': 'Campo de batalla',
  'historic=building': 'Edificio histórico',
  'historic=house': 'Casa histórica',
  'historic=ship': 'Barco museo',
  'historic=gate': 'Puerta histórica',
  'historic=milestone': 'Hito',
  'historic=boundary_stone': 'Mojón',
  'amenity=theatre': 'Teatro',
  'amenity=arts_centre': 'Centro cultural',
  'amenity=library': 'Biblioteca',
  'amenity=cinema': 'Cine',
  'amenity=place_of_worship': 'Lugar de culto',
  // Comer
  'amenity=restaurant': 'Restaurante',
  'amenity=cafe': 'Cafetería',
  'amenity=fast_food': 'Comida rápida',
  'amenity=bar': 'Bar de copas',
  'amenity=pub': 'Pub',
  'amenity=biergarten': 'Terraza cervecera',
  'amenity=ice_cream': 'Heladería',
  'amenity=food_court': 'Zona de restauración',
  // Naturaleza
  'leisure=park': 'Parque',
  'leisure=garden': 'Jardín',
  'leisure=nature_reserve': 'Reserva natural',
  'natural=beach': 'Playa',
  'natural=peak': 'Cima',
  'natural=spring': 'Manantial',
  'natural=cave_entrance': 'Cueva',
  'natural=volcano': 'Volcán',
  'natural=waterfall': 'Cascada',
  'natural=glacier': 'Glaciar',
  // Dormir
  'tourism=hotel': 'Hotel',
  'tourism=hostel': 'Albergue',
  'tourism=guest_house': 'Casa de huéspedes',
  'tourism=motel': 'Motel',
  'tourism=apartment': 'Apartamento turístico',
  'tourism=chalet': 'Casa rural',
  'tourism=camp_site': 'Camping',
  'tourism=caravan_site': 'Área de caravanas',
  'tourism=alpine_hut': 'Refugio de montaña',
  // Servicios
  'amenity=pharmacy': 'Farmacia',
  'amenity=hospital': 'Hospital',
  'amenity=clinic': 'Clínica',
  'amenity=doctors': 'Consulta médica',
  'amenity=dentist': 'Dentista',
  'amenity=bank': 'Banco',
  'amenity=atm': 'Cajero',
  'amenity=fuel': 'Gasolinera',
  'amenity=police': 'Policía',
  'amenity=post_office': 'Oficina de correos',
  'amenity=toilets': 'Aseos públicos',
  'amenity=charging_station': 'Punto de recarga',
  'amenity=veterinary': 'Veterinario',
  'amenity=fire_station': 'Parque de bomberos',
  'amenity=townhall': 'Ayuntamiento',
  'amenity=courthouse': 'Juzgado',
  'amenity=embassy': 'Embajada',
  'amenity=marketplace': 'Mercado',
  // Transporte
  'railway=station': 'Estación de tren',
  'railway=halt': 'Apeadero',
  'railway=tram_stop': 'Parada de tranvía',
  'railway=subway_entrance': 'Boca de metro',
  'amenity=bus_station': 'Estación de autobuses',
  'amenity=taxi': 'Parada de taxis',
  'amenity=bicycle_rental': 'Bicis de alquiler',
  'amenity=car_rental': 'Alquiler de coches',
  'amenity=ferry_terminal': 'Terminal de ferry',
  'amenity=parking': 'Aparcamiento',
  'aeroway=aerodrome': 'Aeropuerto',
  'aeroway=terminal': 'Terminal de aeropuerto',
  // Tiendas
  'shop=supermarket': 'Supermercado',
  'shop=convenience': 'Tienda de barrio',
  'shop=bakery': 'Panadería',
  'shop=butcher': 'Carnicería',
  'shop=greengrocer': 'Frutería',
  'shop=clothes': 'Ropa',
  'shop=shoes': 'Zapatería',
  'shop=books': 'Librería',
  'shop=florist': 'Floristería',
  'shop=hairdresser': 'Peluquería',
  'shop=jewelry': 'Joyería',
  'shop=optician': 'Óptica',
  'shop=bicycle': 'Tienda de bicis',
  'shop=hardware': 'Ferretería',
  'shop=doityourself': 'Bricolaje',
  'shop=furniture': 'Muebles',
  'shop=electronics': 'Electrónica',
  'shop=mobile_phone': 'Telefonía',
  'shop=alcohol': 'Bodega',
  'shop=wine': 'Vinoteca',
  'shop=gift': 'Regalos',
  'shop=toys': 'Juguetería',
  'shop=sports': 'Deportes',
  'shop=department_store': 'Grandes almacenes',
  'shop=mall': 'Centro comercial',
  'shop=kiosk': 'Quiosco',
  'shop=chemist': 'Droguería',
  'shop=cheese': 'Quesería',
  'shop=pastry': 'Pastelería',
  'shop=seafood': 'Pescadería',
  'shop=deli': 'Delicatessen',
  'shop=coffee': 'Cafés y tés',
  'shop=car': 'Concesionario',
  'shop=car_repair': 'Taller',
  'shop=laundry': 'Lavandería',
  'shop=copyshop': 'Copistería',
  'shop=travel_agency': 'Agencia de viajes',
  'shop=beauty': 'Centro de belleza',
  'shop=tattoo': 'Estudio de tatuajes',
  'shop=pet': 'Tienda de mascotas',
  'shop=photo': 'Fotografía',
  'shop=music': 'Tienda de música',
  'shop=video_games': 'Videojuegos',
  'shop=second_hand': 'Segunda mano',
  'shop=variety_store': 'Bazar',
};

const SUBTYPE_GLYPHS: Record<string, string> = {
  'tourism=museum': '\u{1F3DB}️',
  'tourism=gallery': '\u{1F5BC}️',
  'tourism=artwork': '\u{1F3A8}',
  'tourism=attraction': '⭐',
  'tourism=theme_park': '\u{1F3A1}',
  'tourism=zoo': '\u{1F981}',
  'tourism=aquarium': '\u{1F420}',
  'tourism=viewpoint': '\u{1F52D}',
  'tourism=picnic_site': '\u{1F9FA}',
  'tourism=information': 'ℹ️',
  'historic=castle': '\u{1F3F0}',
  'historic=monument': '\u{1F5FF}',
  'historic=memorial': '\u{1F5FF}',
  'historic=ruins': '\u{1F3DA}️',
  'historic=archaeological_site': '\u{1F3FA}',
  'historic=church': '⛪',
  'historic=fort': '\u{1F3F0}',
  'historic=city_gate': '\u{1F6AA}',
  'historic=tower': '\u{1F5FC}',
  'historic=monastery': '⛪',
  'historic=aqueduct': '\u{1F309}',
  'amenity=theatre': '\u{1F3AD}',
  'amenity=arts_centre': '\u{1F3A8}',
  'amenity=library': '\u{1F4DA}',
  'amenity=cinema': '\u{1F3AC}',
  'amenity=place_of_worship': '⛪',
  'amenity=restaurant': '\u{1F37D}️',
  'amenity=cafe': '☕',
  'amenity=fast_food': '\u{1F354}',
  'amenity=bar': '\u{1F378}',
  'amenity=pub': '\u{1F37A}',
  'amenity=biergarten': '\u{1F37A}',
  'amenity=ice_cream': '\u{1F366}',
  'amenity=food_court': '\u{1F374}',
  'leisure=park': '\u{1F333}',
  'leisure=garden': '\u{1F338}',
  'leisure=nature_reserve': '\u{1F332}',
  'natural=beach': '\u{1F3D6}️',
  'natural=peak': '⛰️',
  'natural=spring': '\u{1F4A7}',
  'natural=cave_entrance': '\u{1F573}️',
  'natural=volcano': '\u{1F30B}',
  'natural=waterfall': '\u{1F30A}',
  'natural=glacier': '\u{1F9CA}',
  'tourism=hotel': '\u{1F6CF}️',
  'tourism=hostel': '\u{1F392}',
  'tourism=guest_house': '\u{1F3E1}',
  'tourism=motel': '\u{1F3E8}',
  'tourism=apartment': '\u{1F3E2}',
  'tourism=chalet': '\u{1F3E1}',
  'tourism=camp_site': '⛺',
  'tourism=caravan_site': '\u{1F69A}',
  'tourism=alpine_hut': '\u{1F3D4}️',
  'amenity=pharmacy': '\u{1F48A}',
  'amenity=hospital': '\u{1F3E5}',
  'amenity=clinic': '\u{1FA7A}',
  'amenity=doctors': '\u{1FA7A}',
  'amenity=dentist': '\u{1F9B7}',
  'amenity=bank': '\u{1F3E6}',
  'amenity=atm': '\u{1F4B5}',
  'amenity=fuel': '⛽',
  'amenity=police': '\u{1F693}',
  'amenity=post_office': '✉️',
  'amenity=toilets': '\u{1F6BB}',
  'amenity=charging_station': '\u{1F50C}',
  'amenity=veterinary': '\u{1F43E}',
  'amenity=fire_station': '\u{1F692}',
  'amenity=townhall': '\u{1F3DB}️',
  'amenity=courthouse': '⚖️',
  'amenity=embassy': '\u{1F3F3}️',
  'amenity=marketplace': '\u{1F9FA}',
  'railway=station': '\u{1F686}',
  'railway=halt': '\u{1F686}',
  'railway=tram_stop': '\u{1F68A}',
  'railway=subway_entrance': '\u{1F687}',
  'amenity=bus_station': '\u{1F68C}',
  'amenity=taxi': '\u{1F695}',
  'amenity=bicycle_rental': '\u{1F6B2}',
  'amenity=car_rental': '\u{1F697}',
  'amenity=ferry_terminal': '⛴️',
  'amenity=parking': '\u{1F17F}️',
  'aeroway=aerodrome': '✈️',
  'aeroway=terminal': '✈️',
  'shop=supermarket': '\u{1F6D2}',
  'shop=convenience': '\u{1F3EA}',
  'shop=bakery': '\u{1F956}',
  'shop=butcher': '\u{1F969}',
  'shop=greengrocer': '\u{1F34E}',
  'shop=clothes': '\u{1F457}',
  'shop=shoes': '\u{1F45F}',
  'shop=books': '\u{1F4D6}',
  'shop=florist': '\u{1F490}',
  'shop=hairdresser': '\u{1F487}',
  'shop=jewelry': '\u{1F48E}',
  'shop=optician': '\u{1F453}',
  'shop=bicycle': '\u{1F6B2}',
  'shop=hardware': '\u{1F527}',
  'shop=doityourself': '\u{1F528}',
  'shop=furniture': '\u{1F6CB}️',
  'shop=electronics': '\u{1F4FA}',
  'shop=mobile_phone': '\u{1F4F1}',
  'shop=alcohol': '\u{1F377}',
  'shop=wine': '\u{1F377}',
  'shop=gift': '\u{1F381}',
  'shop=toys': '\u{1F9F8}',
  'shop=sports': '⚽',
  'shop=department_store': '\u{1F3EC}',
  'shop=mall': '\u{1F3EC}',
  'shop=kiosk': '\u{1F5DE}️',
  'shop=chemist': '\u{1F9F4}',
  'shop=cheese': '\u{1F9C0}',
  'shop=pastry': '\u{1F370}',
  'shop=seafood': '\u{1F41F}',
  'shop=deli': '\u{1F9C6}',
  'shop=coffee': '☕',
  'shop=car': '\u{1F697}',
  'shop=car_repair': '\u{1F6E0}️',
  'shop=laundry': '\u{1F9FA}',
  'shop=travel_agency': '\u{1F9F3}',
  'shop=beauty': '\u{1F485}',
  'shop=pet': '\u{1F436}',
  'shop=music': '\u{1F3B5}',
  'shop=video_games': '\u{1F3AE}',
};

/** Claves OSM que deciden la categoría, en orden de prioridad. */
const CLASSIFY_ORDER: Array<[string, CategoryId | ((v: string) => CategoryId | null)]> = [
  ['historic', () => 'culture'],
  [
    'tourism',
    (v) => {
      if (['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'chalet', 'camp_site', 'caravan_site', 'alpine_hut'].includes(v)) return 'sleep';
      if (['viewpoint', 'picnic_site'].includes(v)) return 'nature';
      if (v === 'information') return 'services';
      if (['museum', 'gallery', 'artwork', 'attraction', 'theme_park', 'zoo', 'aquarium'].includes(v)) return 'culture';
      return null;
    },
  ],
  ['leisure', (v) => (['park', 'garden', 'nature_reserve'].includes(v) ? 'nature' : null)],
  ['natural', () => 'nature'],
  ['railway', () => 'transport'],
  ['aeroway', () => 'transport'],
  [
    'amenity',
    (v) => {
      if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'biergarten', 'ice_cream', 'food_court'].includes(v)) return 'food';
      if (['theatre', 'arts_centre', 'library', 'cinema', 'place_of_worship'].includes(v)) return 'culture';
      if (['bus_station', 'taxi', 'bicycle_rental', 'car_rental', 'ferry_terminal', 'parking'].includes(v)) return 'transport';
      if (v === 'marketplace') return 'shop';
      return 'services';
    },
  ],
  ['shop', () => 'shop'],
];

export interface Classification {
  category: CategoryId;
  label: string;
  glyph: string;
}

/** Convierte las etiquetas OSM en categoría + nombre del tipo + icono. */
export function classify(tags: Record<string, string>): Classification {
  for (const [key, resolver] of CLASSIFY_ORDER) {
    const value = tags[key];
    if (!value) continue;
    const category = typeof resolver === 'function' ? resolver(value) : resolver;
    if (!category) continue;
    const pair = key + '=' + value;
    return {
      category,
      // Sin traducción se usa el nombre de la categoría: los valores de
      // OpenStreetMap están en inglés y no deben acabar en pantalla.
      label: SUBTYPE_LABELS[pair] ?? CATEGORY_BY_ID.get(category)!.label,
      glyph: SUBTYPE_GLYPHS[pair] ?? CATEGORY_BY_ID.get(category)!.glyph,
    };
  }
  return { category: 'culture', label: 'Sitio', glyph: '\u{1F4CD}' };
}
