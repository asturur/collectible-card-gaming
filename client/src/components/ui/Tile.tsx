import type { ReactNode } from 'react';
import { cx } from './styles';

/** Griglia a colonne di uguale larghezza (niente tessere che si "allargano"
 *  da sole quando restano sole sull'ultima riga, come capita con flex-wrap):
 *  stessa disposizione ovunque nel sito ci sia una fila di tasti o tessere
 *  principali (home, statistiche per sfida…). */
export const TILE_GRID = 'grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:grid-cols-5';

interface GridTileProps {
  /** Emoji o piccola icona, centrata nella zona superiore. Ignorata se è
   *  passato anche `graphic`. */
  icon?: ReactNode;
  /** Illustrazione decorativa a tutta larghezza per la zona superiore (es.
   *  `DeckBackArt`): sostituisce `icon` e riempie tutta quella zona, con una
   *  sfumatura verso il basso che la fonde con la fascia del testo. */
  graphic?: ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
}

/** Tessera standard dell'app: stessa misura e forma per tutte (altezza fissa,
 *  larghezza data dalla griglia) a prescindere dal testo dentro. Due zone
 *  nette: sopra l'icona/illustrazione, sotto l'etichetta su sfondo blu scuro
 *  pieno (sempre leggibile, anche quando sopra c'è una grafica elaborata) —
 *  come le icone di un'app sul telefono. Usata sia per i tasti principali
 *  della home sia per le tessere di "Statistiche per sfida". */
export function GridTile({ icon, graphic, label, sublabel, onClick }: GridTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-28 flex-col overflow-hidden rounded-lg border border-zaff-border bg-zaff-surface text-center text-zaff-text transition hover:border-zaff-primary active:scale-[0.97]"
    >
      <span className="relative flex flex-1 items-center justify-center overflow-hidden">
        {graphic ?? <span className="text-2xl leading-none">{icon}</span>}
      </span>
      <span
        className={cx(
          'relative z-10 flex shrink-0 flex-col items-center gap-0.5 bg-zaff-surface px-2 py-1.5',
          graphic ? '-mt-3' : undefined
        )}
      >
        <span className="text-[13px] font-medium leading-tight">{label}</span>
        {sublabel && <span className="text-[11px] text-zaff-muted">{sublabel}</span>}
      </span>
    </button>
  );
}

/**
 * Sfondo scuro condiviso da tutte le illustrazioni dei tasti principali:
 * bagliore viola/nero al centro e sfumatura finale verso `--color-zaff-surface`,
 * che la fonde visivamente con la fascia del testo sotto — stessa "cornice"
 * per ogni tasto, cambia solo il soggetto in primo piano. `seed` rende unici
 * gli id dei gradienti quando più illustrazioni compaiono insieme in pagina.
 */
function TileArtBackdrop({ seed, children }: { seed: string; children: ReactNode }) {
  const glow = `tileGlow-${seed}`;
  const fade = `tileFade-${seed}`;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={glow} cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#4B3F7A" />
          <stop offset="55%" stopColor="#241B3E" />
          <stop offset="100%" stopColor="#120E20" />
        </radialGradient>
        <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="0" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${glow})`} />
      {children}
      <rect x="0" y="0" width="100" height="100" fill={`url(#${fade})`} />
    </svg>
  );
}

/**
 * Illustrazione decorativa originale per la tessera "Gestisci mazzi": NON è
 * il dorso ufficiale delle carte Magic né la sua scritta/logo (materiali
 * protetti da copyright/marchio) — è uno stemma arcano generico, inventato
 * per questa app.
 */
export function DeckBackArt() {
  return (
    <TileArtBackdrop seed="deck">
      <defs>
        <linearGradient id="deckGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8CA7E" />
          <stop offset="100%" stopColor="#9E7A31" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="40" r="26" fill="none" stroke="url(#deckGold)" strokeWidth="1.4" opacity="0.85" />
      <circle cx="50" cy="40" r="19" fill="none" stroke="url(#deckGold)" strokeWidth="0.8" opacity="0.55" />
      <g transform="translate(50,40)" fill="url(#deckGold)" opacity="0.9">
        {Array.from({ length: 8 }).map((_, i) => (
          <polygon key={i} points="0,-24 3,-6 0,0 -3,-6" transform={`rotate(${i * 45})`} />
        ))}
        <circle r="4.5" fill="#120E20" stroke="url(#deckGold)" strokeWidth="1" />
      </g>
    </TileArtBackdrop>
  );
}

/**
 * Due guantoni stilizzati che si scontrano, per il tasto "Nuova Partita":
 * forma geometrica semplice (niente personaggi o loghi di terzi), pensata
 * per restare leggibile anche piccola su schermo di telefono.
 */
export function ClashIcon() {
  return (
    <TileArtBackdrop seed="clash">
      <defs>
        <linearGradient id="clashGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3D48A" />
          <stop offset="100%" stopColor="#B4842F" />
        </linearGradient>
      </defs>
      <g>
        <rect x="10" y="34" width="16" height="18" rx="6" fill="url(#clashGold)" transform="rotate(-12 18 43)" />
        <ellipse cx="33" cy="40" rx="13" ry="11" fill="url(#clashGold)" />
        <circle cx="41" cy="33" r="5.5" fill="url(#clashGold)" />
      </g>
      <g>
        <rect x="74" y="34" width="16" height="18" rx="6" fill="url(#clashGold)" transform="rotate(12 82 43)" />
        <ellipse cx="67" cy="40" rx="13" ry="11" fill="url(#clashGold)" />
        <circle cx="59" cy="33" r="5.5" fill="url(#clashGold)" />
      </g>
      <polygon
        points="50,28 52.5,35.5 60,38 52.5,40.5 50,48 47.5,40.5 40,38 47.5,35.5"
        fill="#FDF6E3"
      />
    </TileArtBackdrop>
  );
}

/**
 * Libro aperto stilizzato per il tasto "Partite salvate": pagine, dorso e un
 * piccolo segnalibro, nei toni oro/pergamena già usati nelle altre illustrazioni.
 */
export function OpenBookIcon() {
  return (
    <TileArtBackdrop seed="book">
      <defs>
        <linearGradient id="bookPage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3E7C9" />
          <stop offset="100%" stopColor="#CBB994" />
        </linearGradient>
        <linearGradient id="bookGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8CA7E" />
          <stop offset="100%" stopColor="#9E7A31" />
        </linearGradient>
      </defs>
      <path d="M50,28 C38,23 22,24 13,31 L13,57 C22,51 38,51 50,57 Z" fill="url(#bookPage)" />
      <path d="M50,28 C62,23 78,24 87,31 L87,57 C78,51 62,51 50,57 Z" fill="url(#bookPage)" />
      <line x1="50" y1="28" x2="50" y2="57" stroke="url(#bookGold)" strokeWidth="1.6" />
      <g stroke="#9E7A31" strokeWidth="1" opacity="0.55" strokeLinecap="round">
        <line x1="19" y1="36" x2="40" y2="34" />
        <line x1="19" y1="42" x2="40" y2="40" />
        <line x1="19" y1="48" x2="40" y2="46" />
        <line x1="60" y1="34" x2="81" y2="36" />
        <line x1="60" y1="40" x2="81" y2="42" />
        <line x1="60" y1="46" x2="81" y2="48" />
      </g>
      <path d="M45,22 L55,22 L55,34 L50,30 L45,34 Z" fill="url(#bookGold)" />
    </TileArtBackdrop>
  );
}
