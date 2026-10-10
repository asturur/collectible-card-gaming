import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { paths } from '../../router';
import { ManaIcons } from './ManaIcon';
import { computeTally, dateLabel } from './stats';
import type { Game } from './GameList';
import Badge from '../ui/Badge';
import { cx } from '../ui/styles';
import { makeDeckResolver, type DeckRef } from './deckRefs';

interface HomeOverviewProps {
  games: Game[];
  /** Mazzi salvati (da Supabase). */
  deckCount: number;
  /** Mazzi salvati (ID e nome), per mostrare il nome attuale dei mazzi giocati. */
  decks?: DeckRef[];
  /** Partite di altri non ancora viste nell'elenco Partite. */
  newGames?: number;
}

/** Quante voci mostrare nelle liste della pagina iniziale. */
const SHOWN = 3;

function Section({ title, to, badge, children }: { title: string; to: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zaff-muted">
        {title}
        {badge}
      </h2>
      {/* Tutta l'area è un unico tasto: porta alla sezione completa. */}
      <Link
        to={to}
        className="flex w-full items-center gap-3 rounded-lg border border-zaff-border bg-zaff-bg px-3.5 py-3 text-left transition hover:border-zaff-primary active:border-zaff-primary"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-2">{children}</span>
        <span className="shrink-0 text-2xl leading-none text-zaff-muted" aria-hidden="true">
          ›
        </span>
      </Link>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <span className="text-sm text-zaff-muted">{children}</span>;
}

/**
 * Pagina iniziale: tasto Nuova Partita, tre numeri, ultime partite, mazzi
 * giocati di recente e mini-classifica. Tutto è calcolato dalle partite già
 * caricate; ogni blocco è un solo grande tasto verso la sezione completa.
 */
export default function HomeOverview({
  games,
  deckCount,
  decks = [],
  newGames = 0,
}: HomeOverviewProps) {
  // Dalla più recente: data, poi orario di inizio, poi id.
  const sorted = [...games].sort(
    (x, y) =>
      y.date.localeCompare(x.date) ||
      (y.startedAt ?? '').localeCompare(x.startedAt ?? '') ||
      y.id.localeCompare(x.id)
  );
  const latest = sorted.slice(0, SHOWN);

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonth = games.filter((g) => g.date.startsWith(monthPrefix)).length;

  // Mazzi giocati di recente: nell'ordine delle partite, senza ripetizioni.
  const resolveDeck = makeDeckResolver(decks);
  const recentDecks: { key: string; name: string; colors: string[] }[] = [];
  for (const g of sorted) {
    for (const p of g.players) {
      const deck = resolveDeck(p);
      if (deck && !recentDecks.some((d) => d.key === deck.key)) recentDecks.push({ key: deck.key, name: deck.name, colors: p.colors ?? [] });
      if (recentDecks.length >= SHOWN) break;
    }
    if (recentDecks.length >= SHOWN) break;
  }

  const top = computeTally(games).slice(0, SHOWN);
  const medals = ['🥇', '🥈', '🥉'];

  const stats: { label: string; value: number }[] = [
    { label: 'Partite totali', value: games.length },
    { label: 'Questo mese', value: thisMonth },
    { label: 'Mazzi salvati', value: deckCount },
  ];

  return (
    <>
      <Link
        to={paths.newGame}
        className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-zaff-primary to-zaff-accent px-4 py-3 text-left text-zaff-bg shadow-lg transition active:scale-[0.98] md:w-fit md:px-6"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/20 text-3xl font-light leading-none md:h-10 md:w-10">
          +
        </span>
        <span className="min-w-0">
          <span className="block text-xl font-bold leading-tight">Nuova Partita</span>
          <span className="block text-sm font-medium opacity-80">Segna-punti e risultato</span>
        </span>
      </Link>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-zaff-border bg-zaff-bg px-2 py-2.5 text-center">
            <div className="bg-gradient-to-r from-zaff-primary to-zaff-accent bg-clip-text text-2xl font-bold leading-none text-transparent">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] leading-tight text-zaff-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <Section
        title="Ultime partite"
        to={paths.games}
        badge={newGames > 0 ? <Badge tone="warning">{newGames === 1 ? '1 nuova' : `${newGames} nuove`}</Badge> : undefined}
      >
        {latest.length === 0 ? (
          <Empty>Ancora nessuna partita: tocca &quot;Nuova Partita&quot; per iniziare.</Empty>
        ) : (
          latest.map((g) => (
            <span key={g.id} className="flex items-center gap-3">
              <span className="shrink-0 whitespace-nowrap border-r border-zaff-border pr-3 text-sm text-zaff-muted">
                {dateLabel(g.date)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {[...g.players]
                  .sort((a, b) => Number(b.winner) - Number(a.winner))
                  .map((p, i) => (
                    <span key={i} className={cx(p.winner ? 'font-bold text-zaff-text' : 'text-zaff-muted')}>
                      {i > 0 && <span className="text-zaff-muted"> · </span>}
                      {p.winner && '🎉 '}
                      {p.name}
                    </span>
                  ))}
              </span>
            </span>
          ))
        )}
      </Section>

      <Section title="Mazzi giocati di recente" to={paths.decks}>
        {recentDecks.length === 0 ? (
          <Empty>Qui compariranno i mazzi usati nelle ultime partite.</Empty>
        ) : (
          recentDecks.map((d) => (
            <span key={d.key} className="flex items-center gap-2 text-sm text-zaff-text">
              <span className="min-w-0 truncate">{d.name}</span>
              <ManaIcons colors={d.colors} className="shrink-0 text-[15px]" />
            </span>
          ))
        )}
      </Section>

      <Section title="Classifica" to={paths.playerStats}>
        {top.length === 0 ? (
          <Empty>La classifica compare dopo la prima partita.</Empty>
        ) : (
          top.map((r, i) => (
            <span key={r.name} className="flex items-center gap-2 text-sm">
              <span className="w-6 shrink-0 text-center" aria-hidden="true">
                {medals[i]}
              </span>
              <span className="min-w-0 flex-1 truncate text-zaff-text">{r.name}</span>
              <span className="shrink-0 whitespace-nowrap text-zaff-muted">
                {r.w} vittorie · {r.g > 0 ? Math.round((r.w / r.g) * 100) : 0}%
              </span>
            </span>
          ))
        )}
      </Section>
    </>
  );
}
