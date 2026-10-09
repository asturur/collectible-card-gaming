import type { ReactNode } from 'react';
import Button, { ButtonRouteLink } from './Button';

export interface SpeedDialItem {
  id: string;
  label: string;
  /** Emoji o icona davanti all'etichetta. */
  icon?: ReactNode;
  /** Destinazione: è un link vero del router. Senza `to` è un'azione (`onSelect`). */
  to?: string;
  onSelect?: () => void;
}

interface SpeedDialProps {
  open: boolean;
  /** Nome accessibile del gruppo di voci (es. "Statistiche"). */
  label: string;
  items: readonly SpeedDialItem[];
  onClose: () => void;
}

/**
 * Menu rapido sopra la barra di navigazione: una pila di voci con etichetta
 * (come il "speed dial" delle app), al posto di una pagina intermedia con tre
 * tasti. Il tocco sullo sfondo chiude. Le voci con `to` restano link del router.
 * Il comando che lo apre sta nella barra (vedi `BottomNav`), che resta sopra lo sfondo.
 */
export default function SpeedDial({ open, label, items, onClose }: SpeedDialProps) {
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-[24] cursor-default bg-black/60"
      />
      <div
        role="group"
        aria-label={label}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-[26] flex w-60 max-w-[calc(100vw-1.5rem)] flex-col gap-2.5"
      >
        {items.map((item) =>
          item.to ? (
            <ButtonRouteLink key={item.id} to={item.to} variant="neutral" size="lg" fullWidth className="justify-start shadow-lg" onClick={onClose}>
              {item.icon}
              {item.label}
            </ButtonRouteLink>
          ) : (
            <Button
              key={item.id}
              variant="neutral"
              size="lg"
              fullWidth
              className="justify-start shadow-lg"
              onClick={() => {
                onClose();
                item.onSelect?.();
              }}
            >
              {item.icon}
              {item.label}
            </Button>
          )
        )}
      </div>
    </>
  );
}
