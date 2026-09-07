# InfoMap

Mapa con GPS en tiempo real que ensena los sitios de interes que tienes
alrededor. Al tocar uno, sale su ficha con el resumen de Wikipedia, los datos de
OpenStreetMap (horario, teléfono, dirección) y un botón para abrir el artículo
completo si quieres más.

Es una **PWA**: se instala en el iPhone y en Android desde el propio navegador,
sin tiendas de aplicaciones.

## Que hace

- **GPS en directo.** Punto azul con su margen de error, seguimiento continuo y
  brújula (el mapa gira hacia donde miras).
- **Sitios en el mapa.** Museos, restaurantes, parques, hoteles, tiendas,
  servicios y transporte, sacados de OpenStreetMap según la zona que estás
  mirando.
- **Información al tocar.** Resumen del sitio desde Wikipedia, en español si
  existe y en inglés si no. Si tocas un punto sin chincheta, se mira qué hay ahí.
- **Filtros por categoría**, buscador de sitios y direcciones, sitios guardados,
  botón de "como llegar" (Apple Maps o Google Maps) y lectura en voz alta.
- **Sin conexión**: los sitios guardados, sus fichas y los trozos de mapa ya
  vistos siguen funcionando.

No usa ninguna clave de API ni ningún servicio de pago.

## Arrancarla

```bash
npm install
npm run dev
```

Se abre en `http://localhost:5173`. El servidor escucha también en la red local,
así que sale una dirección tipo `http://192.168.0.26:5173` para abrirla desde el
móvil **en la misma wifi**.

Aviso: por esa dirección el GPS **no** funciona. Los navegadores solo dan la
ubicación en `https` o en `localhost`. Para probarla de verdad en el móvil hay
que publicarla (más abajo).

Otros comandos:

```bash
npm run build      # compila a dist/
npm run preview    # sirve dist/ para comprobar la versión final
npm run lint       # oxlint
```

Los iconos se regeneran con Python y Pillow:

```bash
python tool/make_icons.py
```

## Publicarla e instalarla en el móvil

Es una web estatica: vale cualquier hosting que de `https`. Lo más rápido es
subir la carpeta `dist/` a **Netlify**, **Vercel** o **Cloudflare Pages** (los
tres tienen plan gratuito y dan certificado solos).

```bash
npm run build
# y arrastrar la carpeta dist/ a app.netlify.com/drop
```

Despues, en el móvil:

- **iPhone**: abrir la dirección en **Safari** (en Chrome de iOS no se puede
  instalar), botón Compartir y **Añadir a pantalla de inicio**.
- **Android**: abrir en Chrome, menu de tres puntos y **Instalar aplicación**.
  Tambien aparece un botón de instalar dentro de la propia app.

Si la publicas en un subdirectorio (por ejemplo GitHub Pages en
`usuario.github.io/infomap/`), hay que poner `base: '/infomap/'` en
`vite.config.ts` y cambiar `start_url` y `scope` en
`public/manifest.webmanifest`. En la raiz del dominio no hace falta tocar nada.

## Como esta montado

| Carpeta | Que hay |
| --- | --- |
| `src/components/` | Mapa (Leaflet a pelo), panel deslizante, ficha del sitio, barra superior |
| `src/lib/` | Datos y logica: Overpass, Wikipedia, Nominatim, GPS, brújula, favoritos, ajustes |
| `src/styles/` | Paleta y estilos del panel |
| `public/` | Manifest, service worker e iconos |
| `tool/` | Generador de iconos |

De dónde salen los datos:

- **Sitios y sus datos**: [Overpass API](https://overpass-api.de) sobre
  OpenStreetMap. Se consulta la zona visible con un margen, solo a partir de
  zoom 14, y se limita a 260 chinchetas para que el mapa vaya fluido.
- **Resumen de cada sitio**: Wikipedia. Se busca en este orden: etiqueta
  `wikipedia` del sitio, etiqueta `wikidata`, artículos geolocalizados a menos de
  800 m con nombre parecido, y por último el buscador de Wikipedia acotado a
  5 km. Cuando el artículo se encuentra por los dos últimos caminos, la ficha lo
  advierte.
- **Buscador y "que hay en este punto"**:
  [Nominatim](https://nominatim.openstreetmap.org), con una petición por segundo
  como máximo, que es lo que piden en sus condiciones de uso.
- **Teselas del mapa**: `tile.openstreetmap.org`.

## Detalles que conviene saber

- **La paleta** son los cuatro colores Ocean (`#345DA7`, `#3B8AC4`, `#4BB4DE`,
  `#EFDBCB`) sobre el azul marino del muestrario. Los tonos de fondo y los siete
  colores de categoría estan **derivados** de esos cuatro: con cuatro no se
  separan capas ni se distinguen siete tipos de sitio.
- **El GPS filtra posiciones malas**: una lectura mucho peor que la anterior
  suele venir de la antena de telefonía y se descarta, salvo que la buena ya sea
  vieja o el movimiento sea real.
- **La brújula en iPhone** necesita permiso explicito, y solo se puede pedir
  desde un toque del usuario: por eso se activa con el segundo toque en el botón
  de la diana.
- **Los horarios** de OpenStreetMap solo se interpretan en su forma habitual
  (`Mo-Fr 09:00-14:00; Sa 10:00-14:00`, `24/7`). Si el horario trae algo raro, se
  ensena el texto tal cual sin decir si esta abierto: es preferible callar a
  mentir.
- **Nada se envía a ningún servidor propio.** Favoritos, ajustes, fichas de
  Wikipedia y la última posición del mapa se guardan en `localStorage`; los
  sitios descargados, en IndexedDB.

- **Velocidad.** Medido en Sevilla centro: zona nueva, primeras chinchetas a los
  2,6 s; zona ya vista, cero peticiones de red; cambiar un filtro, 150 ms. Tres
  cosas lo consiguen y conviene no deshacerlas: el servidor `lz4.overpass-api.de`
  (el genérico cae en nodos saturados que tardan 14 s y acaban en 429), **una
  sola consulta a la vez** (dos en paralelo desde la misma IP hacen que Overpass
  las encole y las rechace) y la caché por teselas.

- **Al tocar la clasificación de sitios** (`classify`, etiquetas, puntuación) hay
  que subir `SCHEMA` en `src/lib/tileDb.ts`: las teselas guardan esos datos ya
  calculados y, si no, las zonas descargadas se quedan con la versión antigua.
