import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { cx, NO_SCROLLBAR } from './styles';

/** Fino a quante voci si prova il selettore a larghezza uguale. */
const SEGMENTED_MAX = 4;
/** Spazio tra le voci (gap-2) e margine attorno alla voce attiva quando la riga scorre (oltre la sfumatura). */
const GAP_PX = 8;
const EDGE_PX = 32;
/** Sfumatura sul bordo che ha altre voci nascoste. */
const FADE = '1.5rem';

interface ChipRowProps {
  /** Le voci: pulsanti o link, quello attivo marcato con aria-pressed o aria-current. */
  children: ReactNode[];
  /** Elemento contenitore: `nav` per le sotto-pagine, `div` per i filtri. */
  as?: 'div' | 'nav';
  label?: string;
  className?: string;
}

const isActive = (el: Element) => el.getAttribute('aria-pressed') === 'true' || el.hasAttribute('aria-current');

/**
 * Fila di voci comune a `FilterTabs` e `NavTabs`, come nelle app più diffuse:
 * - poche voci (fino a 4) che ci stanno → selettore a larghezza uguale;
 * - altrimenti una sola riga che si scorre col dito, con una sfumatura sul lato
 *   che ha altre voci e la voce attiva sempre portata in vista.
 * La scelta si rifà a ogni cambio di larghezza (rotazione, finestra più stretta).
 */
export default function ChipRow({ children, as: Tag = 'div', label, className }: ChipRowProps) {
  const ref = useRef<HTMLElement>(null);
  const count = children.length;
  const [segmented, setSegmented] = useState(count <= SEGMENTED_MAX);
  const [fade, setFade] = useState({ start: false, end: false });

  // Selettore solo se ogni voce ci sta intera nella sua colonna.
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row || count > SEGMENTED_MAX) return;
    const check = () => {
      const items = [...row.children] as HTMLElement[];
      const natural = Math.max(0, ...items.map((el) => el.scrollWidth));
      const column = (row.clientWidth - GAP_PX * (count - 1)) / count;
      setSegmented(natural <= column);
    };
    check();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(check) : null;
    observer?.observe(row);
    return () => observer?.disconnect();
  }, [count, children]);

  // Riga che scorre: sfumature sui lati con altre voci e voce attiva in vista.
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row || segmented) return;
    const update = () => {
      const max = row.scrollWidth - row.clientWidth;
      setFade({ start: row.scrollLeft > 1, end: row.scrollLeft < max - 1 });
    };
    const active = [...row.children].find(isActive) as HTMLElement | undefined;
    if (active) {
      const left = active.offsetLeft;
      const right = left + active.offsetWidth;
      // Solo in orizzontale: scrollIntoView sposterebbe anche la pagina.
      if (left - EDGE_PX < row.scrollLeft) row.scrollLeft = Math.max(0, left - EDGE_PX);
      else if (right + EDGE_PX > row.scrollLeft + row.clientWidth) row.scrollLeft = right + EDGE_PX - row.clientWidth;
    }
    update();
    row.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(row);
    return () => {
      row.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [segmented, children]);

  const mask = segmented || (!fade.start && !fade.end) ? undefined
    : `linear-gradient(to right, ${fade.start ? `transparent, #000 ${FADE}` : '#000'}, ${fade.end ? `#000 calc(100% - ${FADE}), transparent` : '#000'})`;
  const style: CSSProperties = segmented
    ? { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }
    : { maskImage: mask, WebkitMaskImage: mask };

  return (
    <Tag
      ref={ref as RefObject<HTMLDivElement>}
      aria-label={label}
      data-layout={segmented ? 'segmented' : 'scroll'}
      style={style}
      className={cx(
        // relative: le posizioni delle voci si misurano dalla riga.
        'relative gap-2 [&>*]:whitespace-nowrap',
        segmented ? 'grid [&>*]:w-full [&>*]:min-w-0' : cx('flex overflow-x-auto overscroll-x-contain [&>*]:shrink-0', NO_SCROLLBAR),
        className
      )}
    >
      {children}
    </Tag>
  );
}
