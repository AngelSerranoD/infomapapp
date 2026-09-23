/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import { isApplePlatform } from '../lib/directions';
import { useSettings, type Settings } from '../lib/useSettings';
import { CloseIcon, InfoIcon } from './Icons';
import Sheet from './Sheet';

interface Props {
  open: boolean;
  installable: boolean;
  onInstall: () => void;
  onClose: () => void;
  onExited: () => void;
  onVisibleHeight: (height: number) => void;
}

const TOGGLES: Array<{ key: keyof Settings; name: string; description: string }> = [
  {
    key: 'tapAnywhere',
    name: 'Tocar el mapa busca el sitio',
    description: 'Al tocar cualquier punto, InfoMap mira qué hay ahí aunque no tenga chincheta.',
  },
  {
    key: 'showLabels',
    name: 'Nombres sobre el mapa',
    description: 'Muestra el nombre debajo de cada chincheta cuando estás cerca.',
  },
  {
    key: 'autoSpeak',
    name: 'Leer la ficha al abrirla',
    description: 'Empieza a leer en voz alta en cuanto se carga la información del sitio.',
  },
];

export default function HelpSheet({
  open,
  installable,
  onInstall,
  onClose,
  onExited,
  onVisibleHeight,
}: Props) {
  const { settings, update } = useSettings();

  const header = (
    <div className="sheet-head">
      <div className="h-ico" style={{ background: 'var(--sky)', color: '#16293d' }}>
        <InfoIcon size={19} />
      </div>
      <div className="h-txt">
        <h2 className="sheet-title">Ajustes y ayuda</h2>
        <div className="sheet-sub">
          <span>InfoMap 1.0</span>
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
        {TOGGLES.map((toggle) => (
          <div className="setting-row" key={toggle.key}>
            <div className="s-txt">
              <div className="s-name">{toggle.name}</div>
              <div className="s-desc">{toggle.description}</div>
            </div>
            <button
              className={'switch' + (settings[toggle.key] ? ' is-on' : '')}
              role="switch"
              aria-checked={settings[toggle.key]}
              aria-label={toggle.name}
              onClick={() => update(toggle.key, !settings[toggle.key])}
            >
              <i />
            </button>
          </div>
        ))}

        <div className="info-block">
          <h3>Instalarla en el móvil</h3>
          {isApplePlatform ? (
            <ol>
              <li>Abre InfoMap en Safari (en Chrome de iPhone no se puede instalar).</li>
              <li>
                Toca el botón <strong>Compartir</strong>, el cuadrado con la flecha hacia arriba.
              </li>
              <li>
                Elige <strong>Añadir a pantalla de inicio</strong>.
              </li>
            </ol>
          ) : (
            <ol>
              <li>Abre InfoMap en Chrome.</li>
              <li>
                Menú de los tres puntos y luego <strong>Instalar aplicación</strong>.
              </li>
            </ol>
          )}
          {installable && (
            <p>
              <button className="act primary" onClick={onInstall}>
                Instalar ahora
              </button>
            </p>
          )}

          <h3>El GPS</h3>
          <p>
            El botón de la diana sigue tu posición en tiempo real. Pulsándolo otra vez se activa la
            brújula y el mapa gira hacia donde miras. El círculo azul alrededor del punto es el
            margen de error: cuanto más pequeño, mejor señal.
          </p>
          <p>
            La posición solo funciona con <code>https</code>, y en iPhone hay que darle permiso la
            primera vez. Si dijiste que no, se cambia en Ajustes del sistema, en Safari, Ubicación.
          </p>

          <h3>De dónde sale la información</h3>
          <p>
            Los sitios y sus datos (horarios, teléfono, dirección) vienen de{' '}
            <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>
            . El resumen de cada sitio es la entradilla de su artículo de{' '}
            <a href="https://es.wikipedia.org" target="_blank" rel="noopener noreferrer">
              Wikipedia
            </a>
            , en español siempre que exista, y en inglés si no. Ningún sitio pequeño tiene artículo:
            en esos casos verás solo los datos de OpenStreetMap.
          </p>

          <h3>Sin conexión</h3>
          <p>
            Los sitios guardados, sus fichas y los trozos de mapa que ya has visto se quedan en el
            móvil. Para buscar sitios nuevos sí hace falta internet.
          </p>
        </div>
      </div>
    </Sheet>
  );
}
