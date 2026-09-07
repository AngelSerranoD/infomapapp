import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  open: boolean;
  /** Cabecera fija: es la zona por la que se arrastra el panel. */
  header: ReactNode;
  children: ReactNode;
  onClose: () => void;
  /** Se llama cuando el panel ha terminado de salir de pantalla. */
  onExited?: () => void;
  /** Alto visible del panel, para subir el mapa y los botones flotantes. */
  onVisibleHeight?: (height: number) => void;
}

const ANIMATION_MS = 300;

export default function Sheet({
  open,
  header,
  children,
  onClose,
  onExited,
  onVisibleHeight,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState(0);
  const [visible, setVisible] = useState(0);
  const [animating, setAnimating] = useState(true);

  const drag = useRef<{ startY: number; startVisible: number; lastY: number; lastAt: number } | null>(
    null,
  );
  /** Escalon elegido por el usuario, para no moverlo cuando crece el contenido. */
  const snap = useRef<'peek' | 'full'>('peek');
  const entered = useRef(false);

  const peek = useCallback(
    (height: number) => Math.min(height, Math.round(window.innerHeight * 0.5)),
    [],
  );

  // Alto real del contenido, para saber donde estan los topes.
  useLayoutEffect(() => {
    const element = sheetRef.current;
    if (!element) return;
    const measure = () => {
      const height = element.offsetHeight;
      setNatural((previous) => (Math.abs(previous - height) > 1 ? height : previous));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Entrada, salida y crecimiento del contenido.
  useEffect(() => {
    if (!natural) return;
    setAnimating(true);

    if (open) {
      if (entered.current) {
        // La ficha ha crecido (por ejemplo al llegar el texto de Wikipedia):
        // se respeta el escalon en el que la había dejado el usuario.
        setVisible(snap.current === 'full' ? natural : peek(natural));
        return;
      }
      entered.current = true;
      snap.current = 'peek';
      const id = requestAnimationFrame(() => setVisible(peek(natural)));
      return () => cancelAnimationFrame(id);
    }

    entered.current = false;
    setVisible(0);
    const timer = window.setTimeout(() => onExited?.(), ANIMATION_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, natural]);

  useEffect(() => {
    onVisibleHeight?.(visible);
  }, [visible, onVisibleHeight]);

  useEffect(() => () => onVisibleHeight?.(0), [onVisibleHeight]);

  const onPointerDown = (event: React.PointerEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input')) return;
    drag.current = {
      startY: event.clientY,
      startVisible: visible,
      lastY: event.clientY,
      lastAt: performance.now(),
    };
    setAnimating(false);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const delta = state.startY - event.clientY;
    let next = state.startVisible + delta;
    // Resistencia al tirar por encima del tope.
    if (next > natural) next = natural + (next - natural) * 0.25;
    setVisible(Math.max(0, next));
    state.lastY = event.clientY;
    state.lastAt = performance.now();
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    setAnimating(true);

    const elapsed = Math.max(1, performance.now() - state.lastAt);
    const velocity = (state.lastY - event.clientY) / elapsed; // px/ms, positivo = hacia arriba
    const peekHeight = peek(natural);

    const goPeek = () => {
      snap.current = 'peek';
      setVisible(peekHeight);
    };
    const goFull = () => {
      snap.current = 'full';
      setVisible(natural);
    };

    if (velocity < -0.6) {
      // Golpe hacia abajo: bajar un escalon o cerrar.
      if (visible > peekHeight + 8) goPeek();
      else onClose();
      return;
    }
    if (velocity > 0.6) {
      goFull();
      return;
    }

    if (visible < peekHeight * 0.55) onClose();
    else if (visible < (peekHeight + natural) / 2) goPeek();
    else goFull();
  };

  const translate = natural ? natural - visible : 0;

  return (
    <div
      className={'sheet' + (animating ? ' is-animating' : '')}
      ref={sheetRef}
      style={{ transform: `translate3d(0, ${translate}px, 0)` }}
      role="dialog"
      aria-modal="false"
    >
      <div
        className="sheet-drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet-grip">
          <i />
        </div>
        {header}
      </div>
      {children}
    </div>
  );
}
