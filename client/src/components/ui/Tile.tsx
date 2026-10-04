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
  const edgeTop = `tileEdgeTop-${seed}`;
  const edgeBottom = `tileEdgeBottom-${seed}`;
  const edgeLeft = `tileEdgeLeft-${seed}`;
  const edgeRight = `tileEdgeRight-${seed}`;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <radialGradient id={glow} cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#4B3F7A" />
          <stop offset="55%" stopColor="#241B3E" />
          <stop offset="100%" stopColor="#120E20" />
        </radialGradient>
        {/* Una sfumatura per lato (non una sola radiale al centro, che
            schiariva solo gli angoli e lasciava i bordi dritti netti):
            insieme fondono tutto il contorno dell'illustrazione nello
            sfondo del bottone — più marcata sopra e sotto, verso la
            scritta, come richiesto. */}
        <linearGradient id={edgeTop} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="1" />
          <stop offset="36%" stopColor="#1e293b" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={edgeBottom} x1="0" y1="0" x2="0" y2="1">
          <stop offset="55%" stopColor="#1e293b" stopOpacity="0" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={edgeLeft} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="1" />
          <stop offset="26%" stopColor="#1e293b" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={edgeRight} x1="0" y1="0" x2="1" y2="0">
          <stop offset="74%" stopColor="#1e293b" stopOpacity="0" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${glow})`} />
      {/* "meet" invece di "slice": l'illustrazione resta sempre tutta visibile
          (mai tagliata dal bottone), anche quando il rapporto larghezza/altezza
          della tessera cambia molto (desktop molto più largo che smartphone). */}
      <g transform="translate(50,40) scale(0.8) translate(-50,-40)">{children}</g>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${edgeTop})`} />
      <rect x="0" y="0" width="100" height="100" fill={`url(#${edgeBottom})`} />
      <rect x="0" y="0" width="100" height="100" fill={`url(#${edgeLeft})`} />
      <rect x="0" y="0" width="100" height="100" fill={`url(#${edgeRight})`} />
    </svg>
  );
}

/**
 * Illustrazione decorativa originale per la tessera "Gestisci mazzi": i 5
 * colori del mana stilizzati come gemme, disposti a pentagono (nessun
 * simbolo ufficiale riprodotto — solo cerchi colorati con bordo dorato).
 */
export function DeckBackArt() {
  const pips: { x: number; y: number; color: string }[] = [
    { x: 50, y: 18, color: '#EDE6CC' }, // bianco
    { x: 70.9, y: 33.2, color: '#5B9BD9' }, // blu
    { x: 62.9, y: 57.8, color: '#3B2A4A' }, // nero
    { x: 37.1, y: 57.8, color: '#C9453B' }, // rosso
    { x: 29.1, y: 33.2, color: '#4C8A5B' }, // verde
  ];
  return (
    <TileArtBackdrop seed="deck">
      <defs>
        <linearGradient id="deckGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8CA7E" />
          <stop offset="100%" stopColor="#9E7A31" />
        </linearGradient>
      </defs>
      {pips.map((p) => (
        <circle key={p.color} cx={p.x} cy={p.y} r="9" fill={p.color} stroke="url(#deckGold)" strokeWidth="1.4" />
      ))}
    </TileArtBackdrop>
  );
}

/**
 * Una spada che colpisce uno scudo, per il tasto "Nuova Partita": forma
 * geometrica semplice (niente personaggi o loghi di terzi, e diversa dalle
 * due spade incrociate di "Statistiche per sfida"), pensata per restare
 * leggibile anche piccola su schermo di telefono.
 */
export function SwordShieldIcon() {
  return (
    <TileArtBackdrop seed="duel">
      <defs>
        <linearGradient id="duelGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3D48A" />
          <stop offset="100%" stopColor="#9E7A31" />
        </linearGradient>
        <linearGradient id="duelSteel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E7ECF2" />
          <stop offset="100%" stopColor="#97A5B3" />
        </linearGradient>
      </defs>
      <path
        d="M50,16 L75,25 L75,48 C75,64 61,74 50,79 C39,74 25,64 25,48 L25,25 Z"
        fill="#241B3E"
        stroke="url(#duelGold)"
        strokeWidth="2.5"
      />
      <line x1="50" y1="25" x2="50" y2="70" stroke="url(#duelGold)" strokeWidth="1.4" opacity="0.5" />
      <line x1="33" y1="40" x2="67" y2="40" stroke="url(#duelGold)" strokeWidth="1.4" opacity="0.5" />
      <g transform="translate(36,26) rotate(38)">
        {/* lama appuntita, più larga di un punteruolo */}
        <polygon points="0,0 5,-3 30,-6.5 30,6.5 5,3" fill="url(#duelSteel)" />
        <line x1="6" y1="0" x2="29" y2="0" stroke="#5B6672" strokeWidth="0.8" opacity="0.6" />
        {/* elsa, perpendicolare alla lama — questo è ciò che la rende "una spada" */}
        <rect x="29" y="-11" width="5" height="22" rx="2" fill="url(#duelGold)" />
        {/* impugnatura e pomo */}
        <rect x="34" y="-3.5" width="13" height="7" rx="2.5" fill="url(#duelGold)" />
        <circle cx="50" cy="0" r="5" fill="url(#duelGold)" />
      </g>
      <polygon points="36,18 38,24 44,26 38,28 36,34 34,28 28,26 34,24" fill="#FDF6E3" />
    </TileArtBackdrop>
  );
}

/**
 * Anello diviso in tre archi colorati, per il tasto "Statistiche mazzi":
 * richiama i grafici a torta già usati nelle pagine di statistica dell'app
 * (stessi colori della palette `PIE_COLORS`).
 */
export function StatsRingIcon() {
  const r = 20;
  const cx = 50;
  const cy = 40;
  const circumference = 2 * Math.PI * r;
  const segments = [
    { frac: 0.4, color: '#E8CA7E' },
    { frac: 0.32, color: '#B4842F' },
    { frac: 0.28, color: '#6B4E9E' },
  ];
  let offset = 0;
  return (
    <TileArtBackdrop seed="stats">
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {segments.map((s) => {
          const len = s.frac * circumference;
          const dashoffset = -offset;
          offset += len;
          return (
            <circle
              key={s.color}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="9"
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </g>
      <circle cx={cx} cy={cy} r="9" fill="#120E20" />
    </TileArtBackdrop>
  );
}

/**
 * Due figure stilizzate (testa + spalle), per il tasto "Gestisci giocatori":
 * stessa tavolozza oro delle altre illustrazioni.
 */
export function PlayersIcon() {
  return (
    <TileArtBackdrop seed="players">
      <defs>
        <linearGradient id="playersGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3D48A" />
          <stop offset="100%" stopColor="#9E7A31" />
        </linearGradient>
      </defs>
      <g opacity="0.85">
        <circle cx="38" cy="30" r="9" fill="url(#playersGold)" />
        <path d="M20,58 C20,44 26,38 38,38 C50,38 56,44 56,58 Z" fill="url(#playersGold)" />
      </g>
      <g>
        <circle cx="64" cy="33" r="9" fill="url(#playersGold)" />
        <path d="M46,60 C46,46 52,40 64,40 C76,40 82,46 82,60 Z" fill="url(#playersGold)" />
      </g>
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
