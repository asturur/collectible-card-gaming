import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { paths } from '../../router';
import { supabase } from '../../services/supabase';
import SpeedDial, { type SpeedDialItem } from '../ui/SpeedDial';
import { cx } from '../ui/styles';
import { BarsIcon, CardsIcon, DotsIcon, ICON_PROPS } from '../ui/NavIcons';

export type NavTab = 'games' | 'decks' | 'new' | 'stats' | 'more';

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
    icon: <CardsIcon />,
  },
  {
    id: 'stats',
    label: 'Statistiche',
    icon: <BarsIcon />,
  },
  {
    id: 'more',
    label: 'Altro',
    icon: <DotsIcon />,
  },
];

/** Voci del menu rapido: Statistiche e Altro non aprono una pagina intermedia con tre tasti. */
const DIALS: Record<'stats' | 'more', { label: string; items: SpeedDialItem[] }> = {
  stats: {
    label: 'Statistiche',
    items: [
      { id: 'decks', label: 'Mazzi', icon: '📊', to: paths.deckStats },
      { id: 'players', label: 'Giocatori', icon: '🏆', to: paths.playerStats },
      { id: 'matchups', label: 'Per Sfida', icon: '⚔️', to: paths.matchups },
    ],
  },
  more: {
    label: 'Altro',
    items: [
      { id: 'roster', label: 'Gestisci Giocatori', icon: '👥', to: paths.players },
      { id: 'zaff', label: 'Vai a ZAFF', icon: '🎮', to: paths.zaff },
      { id: 'logout', label: 'Esci', icon: '🚪', onSelect: () => { void supabase?.auth.signOut(); } },
    ],
  },
};

function CloseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * Barra di navigazione fissa in fondo allo schermo (come le app sul telefono):
 * Partite, Mazzi, il "+" al centro per una nuova partita, Statistiche e Altro.
 * Le sezioni sono pagine; solo i dialoghi di lavoro e il segna-punti la coprono.
 */
export default function BottomNav() {
  const location = useLocation();
  const [dial, setDial] = useState<'stats' | 'more' | null>(null);
  const pathname = location.pathname.replace(/\/+$/, '') || paths.home;
  const active: NavTab | null = pathname === paths.newGame || /^\/games\/[^/]+\/(edit|rematch)$/.test(pathname) ? 'new'
    : pathname === paths.games || pathname.startsWith(`${paths.games}/`) ? 'games'
    : pathname === paths.decks || pathname.startsWith(`${paths.decks}/`) ? 'decks'
    : pathname === paths.stats || pathname.startsWith(`${paths.stats}/`) ? 'stats'
    : pathname === paths.players || pathname === paths.more ? 'more' : null;
  // Cambiando pagina il menu rapido si chiude; Esc lo chiude da tastiera.
  useEffect(() => { setDial(null); }, [location.pathname]);
  useEffect(() => {
    if (!dial) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDial(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dial]);

  function tabButton(tab: (typeof TABS)[number]) {
    const on = active === tab.id;
    const dialId = tab.id === 'stats' || tab.id === 'more' ? tab.id : null;
    const hasDial = dialId !== null;
    const open = dialId !== null && dial === dialId;
    // Il link resta vero (href, apri in nuova scheda); il tocco normale apre il menu rapido.
    function handleClick(e: MouseEvent<HTMLAnchorElement>) {
      if (!dialId) { setDial(null); return; }
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      setDial((current) => (current === dialId ? null : dialId));
    }
    return (
      <Link
        key={tab.id}
        to={paths[tab.id]}
        aria-current={on ? 'page' : undefined}
        aria-haspopup={hasDial ? 'true' : undefined}
        aria-expanded={hasDial ? open : undefined}
        onClick={handleClick}
        className={cx(
          'flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition active:scale-95',
          on || open ? 'text-zaff-accent' : 'text-zaff-muted'
        )}
      >
        {open ? <CloseIcon /> : tab.icon}
        {tab.label}
      </Link>
    );
  }

  return (
    <>
    {dial && <SpeedDial open label={DIALS[dial].label} items={DIALS[dial].items} onClose={() => setDial(null)} />}
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-[25] border-t border-zaff-border bg-zaff-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.4)]"
    >
      <div className="mx-auto grid max-w-[680px] grid-cols-5 items-center">
        {tabButton(TABS[0])}
        {tabButton(TABS[1])}
        <Link
          to={paths.newGame}
          aria-label="Nuova partita"
          aria-current={active === 'new' ? 'page' : undefined}
          onClick={() => setDial(null)}
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
        </Link>
        {tabButton(TABS[2])}
        {tabButton(TABS[3])}
      </div>
    </nav>
    </>
  );
}
