import type { ReactNode } from 'react';
import { cx } from './styles';

/** Griglia a colonne di uguale larghezza (niente tessere che si "allargano"
 *  da sole quando restano sole sull'ultima riga, come capita con flex-wrap):
 *  stessa disposizione ovunque nel sito ci sia una fila di tasti o tessere
 *  principali (home, statistiche per sfida…). */
export const TILE_GRID = 'grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-5';

interface GridTileProps {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
}

/** Tessera standard dell'app: stessa misura e forma per tutte (altezza fissa,
 *  larghezza data dalla griglia) a prescindere dal testo dentro — icona sopra,
 *  etichetta sotto, come le icone di un'app sul telefono. Usata sia per i
 *  tasti principali della home sia per le tessere di "Statistiche per sfida". */
export function GridTile({ icon, label, sublabel, onClick }: GridTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-zaff-border bg-zaff-surface px-2 text-center text-zaff-text transition hover:border-zaff-primary active:scale-[0.97]'
      )}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[13px] font-medium leading-tight">{label}</span>
      {sublabel && <span className="text-[11px] text-zaff-muted">{sublabel}</span>}
    </button>
  );
}
