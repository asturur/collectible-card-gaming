import type { ReactNode } from 'react';
import { cx } from '../ui/styles';

export type NavTab = 'games' | 'decks' | 'new' | 'stats' | 'more';

interface BottomNavProps {
  /** Sezione aperta in questo momento (evidenziata); `null` = pagina iniziale. */
  active: NavTab | null;
  onSelect: (tab: NavTab) => void;
}

const ICON_PROPS = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const TABS: { id: Exclude<NavTab, 'new'>; label: string; icon: ReactNode }[] = [
  {
    id: 'games',
    label: 'Partite',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" />
        <path d="M12 6v13.5" />
      </svg>
    ),
  },
  {
    id: 'decks',
    label: 'Mazzi',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="7" y="4" width="12" height="16" rx="2" />
        <path d="M4.5 7.5V17a2 2 0 0 0 1.5 1.9" />
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'Statistiche',
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M5 20V11M12 20V4M19 20v-6" />
      </svg>
    ),
  },
  {
    id: 'more',
    label: 'Altro',
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="5" cy="12" r="1.2" fill="currentColor" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        <circle cx="19" cy="12" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
];

/**
 * Barra di navigazione fissa in fondo allo schermo (come le app sul telefono):
 * Partite, Mazzi, il "+" al centro per una nuova partita, Statistiche e Altro.
 * Resta sopra i riquadri principali, quindi si cambia sezione senza dover
 * prima chiudere quella aperta; i riquadri annidati (livello 2) e il
 * segna-punti a tutto schermo la coprono.
 */
export default function BottomNav({ active, onSelect }: BottomNavProps) {
  function tabButton(tab: (typeof TABS)[number]) {
    const on = active === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => onSelect(tab.id)}
        aria-current={on ? 'page' : undefined}
        className={cx(
          'flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition active:scale-95',
          on ? 'text-zaff-accent' : 'text-zaff-muted'
        )}
      >
        {tab.icon}
        {tab.label}
      </button>
    );
  }

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-[25] border-t border-zaff-border bg-zaff-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.4)]"
    >
      <div className="mx-auto grid max-w-[680px] grid-cols-5 items-center">
        {tabButton(TABS[0])}
        {tabButton(TABS[1])}
        <button
          type="button"
          onClick={() => onSelect('new')}
          aria-label="Nuova partita"
          aria-current={active === 'new' ? 'page' : undefined}
          className="flex h-16 items-center justify-center"
        >
          <span
            className={cx(
              'flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-zaff-primary to-zaff-accent text-3xl font-light leading-none text-zaff-bg shadow-lg transition active:scale-95',
              active === 'new' && 'ring-2 ring-white/70'
            )}
          >
            +
          </span>
        </button>
        {tabButton(TABS[2])}
        {tabButton(TABS[3])}
      </div>
    </nav>
  );
}
