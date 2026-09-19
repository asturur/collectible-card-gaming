import { useEffect, useMemo, useState } from 'react';
import { subscribeToTable, supabase, TABLE_DECKS, TABLE_GAMES } from '../../services/supabase';
import type { Game } from './GameList';
import { rowToGame } from './stats';
import { LABEL, tabClass } from './ui';

interface DeckSourceRow {
  name: string;
  source: string;
}

interface DeckStatRow {
  deck: string;
  g: number;
  w: number;
  pct: number;
  source: string;
}

/** Percentuale di vittoria per mazzo, volutamente su TUTTE le partite di tutti
 *  i gruppi: le statistiche di un mazzo non dipendono da con chi l'hai giocato. */
function computeDeckStats(games: Game[], decks: DeckSourceRow[]): DeckStatRow[] {
  const sourceByName = new Map(decks.map((d) => [d.name, d.source || '']));
  const tally: Record<string, { g: number; w: number }> = {};
  games.forEach((g) =>
    g.players.forEach((p) => {
      const deck = (p.deck || '').trim();
      if (!deck) return;
      tally[deck] = tally[deck] || { g: 0, w: 0 };
      tally[deck].g++;
      if (p.winner) tally[deck].w++;
    })
  );
  return Object.entries(tally).map(([deck, t]) => ({
    deck,
    g: t.g,
    w: t.w,
    pct: t.g ? Math.round((t.w / t.g) * 100) : 0,
    source: sourceByName.get(deck) || '',
  }));
}

const SOURCE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'brew', label: 'Homebrew' },
  { value: 'precon', label: 'Precon' },
  { value: 'unclassified', label: 'Non classificato' },
];

type DeckSort = 'winrate' | 'games' | 'name';

/**
 * Statistiche mazzi: riepilogo Homebrew/Precon, filtro per origine, ordinamento
 * e barra della percentuale di vittoria per ogni mazzo.
 * Va mostrata dentro un `Modal` (la classifica giocatori sta in testata).
 */
export default function GameStats() {
  const [games, setGames] = useState<Game[]>([]);
  const [decks, setDecks] = useState<DeckSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sort, setSort] = useState<DeckSort>('winrate');

  async function loadData() {
    if (!supabase) return;
    const [{ data: gameRows, error: gameError }, { data: deckRows, error: deckError }] = await Promise.all([
      supabase.from(TABLE_GAMES).select('*'),
      supabase.from(TABLE_DECKS).select('name, source'),
    ]);
    if (gameError || deckError) {
      setError('Non riesco a leggere le statistiche: ' + (gameError?.message || deckError?.message));
      return;
    }
    setGames((gameRows ?? []).map(rowToGame));
    setDecks((deckRows ?? []).map((row) => ({ name: row.name, source: row.source ?? '' })));
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    loadData().finally(() => setLoading(false));
    const unsubGames = subscribeToTable(TABLE_GAMES, loadData);
    const unsubDecks = subscribeToTable(TABLE_DECKS, loadData);
    return () => {
      unsubGames();
      unsubDecks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deckStats = useMemo(() => computeDeckStats(games, decks), [games, decks]);

  const summary = useMemo(() => {
    const totals: Record<string, { g: number; w: number; n: number }> = {
      brew: { g: 0, w: 0, n: 0 },
      precon: { g: 0, w: 0, n: 0 },
      '': { g: 0, w: 0, n: 0 },
    };
    deckStats.forEach((r) => {
      const key = totals[r.source] !== undefined ? r.source : '';
      totals[key].g += r.g;
      totals[key].w += r.w;
      totals[key].n++;
    });
    return totals;
  }, [deckStats]);

  const rows = [...deckStats]
    .filter((r) => {
      if (sourceFilter === 'all') return true;
      if (sourceFilter === 'unclassified') return !r.source;
      return r.source === sourceFilter;
    })
    .sort((a, b) => {
      if (sort === 'games') return b.g - a.g || b.pct - a.pct;
      if (sort === 'name') return a.deck.localeCompare(b.deck);
      return b.pct - a.pct || b.g - a.g;
    });

  if (loading) {
    return <p className="text-zaff-muted">Caricamento…</p>;
  }

  return (
    <>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        {(
          [
            ['Homebrew', 'brew', 'border-green-400'],
            ['Precon', 'precon', 'border-cyan-400'],
            ['Non classificato', '', 'border-zaff-border'],
          ] as const
        ).map(([label, key, border]) => {
          const s = summary[key];
          if (!s.n) return null;
          const pct = s.g ? Math.round((s.w / s.g) * 100) : 0;
          return (
            <div key={key || 'none'} className={`min-w-[140px] flex-1 rounded-lg border bg-zaff-bg px-3.5 py-2.5 ${border}`}>
              <b className="mb-0.5 block font-serif text-sm text-zaff-text">{label}</b>
              <span className="text-[13px] text-zaff-muted">
                {s.n} mazzi · {s.g} partite · {pct}% vittorie
              </span>
            </div>
          );
        })}
      </div>

      <div className="my-3.5 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setSourceFilter(f.value)}
              aria-pressed={sourceFilter === f.value}
              className={tabClass(sourceFilter === f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <label className={`${LABEL} mb-0 whitespace-nowrap`} htmlFor="deckStatsSort">
            Ordina per
          </label>
          <select
            id="deckStatsSort"
            value={sort}
            onChange={(e) => setSort(e.target.value as DeckSort)}
            className="rounded-lg border border-zaff-border bg-zaff-bg px-2.5 py-1.5 text-sm text-zaff-text"
          >
            <option value="winrate">Percentuale di vittoria</option>
            <option value="games">Partite giocate</option>
            <option value="name">Nome del mazzo</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-zaff-muted">Nessun mazzo in questa categoria.</p>
      ) : (
        <div>
          {rows.map((r) => (
            <div key={r.deck} className="border-b border-zaff-border py-2.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-2.5">
                <b className="min-w-0 truncate font-serif text-[15px] text-zaff-text">
                  {r.deck}
                  {r.source && (
                    <span
                      className={`ml-2 rounded-full border px-2 py-px text-[11px] font-normal ${
                        r.source === 'brew' ? 'border-green-400 text-green-400' : 'border-cyan-400 text-cyan-400'
                      }`}
                    >
                      {r.source === 'brew' ? 'Homebrew' : 'Precon'}
                    </span>
                  )}
                </b>
                <span className="shrink-0 whitespace-nowrap text-[13px] text-zaff-muted">
                  {r.g} partite · {r.w} vittorie · {r.pct}%
                </span>
              </div>
              <div className="mt-1.5 h-[7px] overflow-hidden rounded bg-zaff-bg">
                <div className="h-full rounded bg-zaff-gold" style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
