import { useEffect, useMemo, useState } from 'react';
import { subscribeToTable, supabase, TABLE_DECKS, TABLE_GAMES } from '../../services/supabase';
import type { Game } from './GameList';

interface GameStatsProps {
  onBack: () => void;
}

interface DeckSourceRow {
  name: string;
  source: string;
}

interface TallyRow {
  name: string;
  g: number;
  w: number;
}

interface DeckStatRow {
  deck: string;
  g: number;
  w: number;
  pct: number;
  source: string;
}

const PIE_COLORS = ['#9E7A31', '#2C6FA8', '#AF3A2C', '#2E7A4E', '#4B3F57', '#8B857A', '#6B4E9E', '#C9762E'];

function computeTally(list: Game[]): TallyRow[] {
  const tally: Record<string, TallyRow> = {};
  list.forEach((g) =>
    g.players.forEach((p) => {
      tally[p.name] = tally[p.name] || { name: p.name, g: 0, w: 0 };
      tally[p.name].g++;
      if (p.winner) tally[p.name].w++;
    })
  );
  return Object.values(tally).sort((a, b) => b.w - a.w || b.g - a.g);
}

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

function pctColor(pct: number, min: number, max: number): string {
  const t = max === min ? 1 : (pct - min) / (max - min);
  const hue = Math.round(t * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

function pieSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toXY = (deg: number): [number, number] => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x1, y1] = toXY(startDeg);
  const [x2, y2] = toXY(endDeg);
  const big = endDeg - startDeg > 180 ? 1 : 0;
  if (endDeg - startDeg >= 359.9) {
    return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} Z`;
  }
  return `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${big},1 ${x2},${y2} Z`;
}

const SOURCE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'brew', label: 'Homebrew' },
  { value: 'precon', label: 'Precon' },
  { value: 'unclassified', label: 'Non classificato' },
];

type DeckSort = 'winrate' | 'games' | 'name';

/** Statistiche e classifica: percentuale vittorie per mazzo (Homebrew/Precon),
 *  classifica giocatori con mini grafico a torta per gruppo. */
export default function GameStats({ onBack }: GameStatsProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [decks, setDecks] = useState<DeckSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [deckSourceFilter, setDeckSourceFilter] = useState('all');
  const [deckSort, setDeckSort] = useState<DeckSort>('winrate');

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
    setGames(
      (gameRows ?? []).map((row) => ({
        id: row.id,
        date: row.date,
        format: row.format ?? '',
        notes: row.notes ?? '',
        players: row.players ?? [],
        group: row.gruppo ?? 'Generale',
        createdBy: row.created_by ?? null,
      }))
    );
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

  const groups = useMemo(() => [...new Set(games.map((g) => g.group))].sort((a, b) => a.localeCompare(b)), [games]);

  useEffect(() => {
    if (groupFilter !== 'all' && !groups.includes(groupFilter)) setGroupFilter('all');
  }, [groups, groupFilter]);

  const visibleGames = groupFilter === 'all' ? games : games.filter((g) => g.group === groupFilter);
  const standings = useMemo(() => computeTally(visibleGames), [visibleGames]);
  const topWins = standings.length ? standings[0].w : 0;
  const pcts = standings.map((t) => (t.g ? (t.w / t.g) * 100 : 0));
  const minPct = pcts.length ? Math.min(...pcts) : 0;
  const maxPct = pcts.length ? Math.max(...pcts) : 0;

  const totalWins = standings.reduce((s, t) => s + t.w, 0);
  const pieRows = standings.filter((t) => t.w > 0);

  const deckStats = useMemo(() => computeDeckStats(games, decks), [games, decks]);
  const sourceSummary = useMemo(() => {
    const groupsSum: Record<string, { g: number; w: number; n: number }> = {
      brew: { g: 0, w: 0, n: 0 },
      precon: { g: 0, w: 0, n: 0 },
      '': { g: 0, w: 0, n: 0 },
    };
    deckStats.forEach((r) => {
      const key = groupsSum[r.source] !== undefined ? r.source : '';
      groupsSum[key].g += r.g;
      groupsSum[key].w += r.w;
      groupsSum[key].n++;
    });
    return groupsSum;
  }, [deckStats]);

  const filteredDeckStats = deckStats.filter((r) => {
    if (deckSourceFilter === 'all') return true;
    if (deckSourceFilter === 'unclassified') return !r.source;
    return r.source === deckSourceFilter;
  });
  const sortedDeckStats = [...filteredDeckStats].sort((a, b) => {
    if (deckSort === 'games') return b.g - a.g || b.pct - a.pct;
    if (deckSort === 'name') return a.deck.localeCompare(b.deck);
    return b.pct - a.pct || b.g - a.g;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
        <p className="text-zaff-muted">Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-zaff-primary">Statistiche e classifica</h1>

        {groups.length >= 2 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setGroupFilter('all')}
              aria-pressed={groupFilter === 'all'}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                groupFilter === 'all'
                  ? 'border-zaff-primary bg-zaff-primary text-white'
                  : 'border-zaff-border text-zaff-muted hover:bg-zaff-bg'
              }`}
            >
              Tutti i gruppi
            </button>
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupFilter(g)}
                aria-pressed={groupFilter === g}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  groupFilter === g
                    ? 'border-zaff-primary bg-zaff-primary text-white'
                    : 'border-zaff-border text-zaff-muted hover:bg-zaff-bg'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        <h2 className="mb-2 text-sm font-semibold text-zaff-text">Classifica giocatori</h2>
        {standings.length === 0 ? (
          <p className="mb-6 text-sm text-zaff-muted">Ancora nessuna partita qui: la classifica compare da qui.</p>
        ) : (
          <ul className="mb-6 space-y-2">
            {standings.map((t, i) => {
              const pct = pcts[i];
              const color = pctColor(pct, minPct, maxPct);
              const slice = pct > 0 ? pieSlicePath(15, 15, 13, 0, Math.min(pct * 3.6, 359.9)) : '';
              return (
                <li
                  key={t.name}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                    t.w === topWins && topWins > 0 ? 'border-zaff-primary' : 'border-zaff-border'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-zaff-text">{t.name}</p>
                    <p className="text-xs text-zaff-muted">
                      {t.w} vinte su {t.g}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <svg viewBox="0 0 30 30" width="30" height="30">
                      <circle cx="15" cy="15" r="13" fill="none" stroke={color} strokeWidth="2" />
                      {slice && <path d={slice} fill={color} />}
                    </svg>
                    <span className="text-[10px] text-zaff-muted">Win rate</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {groupFilter !== 'all' && totalWins > 0 && (
          <div className="mb-6 flex flex-col items-center gap-3 rounded-lg border border-zaff-border p-4">
            <svg viewBox="0 0 140 140" width="140" height="140">
              {(() => {
                let angle = 0;
                return pieRows.map((t, i) => {
                  const share = (t.w / totalWins) * 360;
                  const path = pieSlicePath(70, 70, 68, angle, angle + share);
                  angle += share;
                  return <path key={t.name} d={path} fill={PIE_COLORS[i % PIE_COLORS.length]} />;
                });
              })()}
            </svg>
            <div className="w-full space-y-1">
              {pieRows.map((t, i) => (
                <div key={t.name} className="flex items-center gap-2 text-xs text-zaff-muted">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {t.name} — {Math.round((t.w / totalWins) * 100)}% ({t.w}/{totalWins})
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="mb-2 text-sm font-semibold text-zaff-text">Statistiche mazzi</h2>

        {(sourceSummary.brew.n > 0 || sourceSummary.precon.n > 0 || sourceSummary[''].n > 0) && (
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                ['Homebrew', 'brew'],
                ['Precon', 'precon'],
                ['Non classificato', ''],
              ] as const
            ).map(([label, key]) => {
              const s = sourceSummary[key];
              if (!s.n) return null;
              const pct = s.g ? Math.round((s.w / s.g) * 100) : 0;
              return (
                <div key={key || 'none'} className="rounded-lg border border-zaff-border p-2 text-center">
                  <p className="text-xs font-semibold text-zaff-text">{label}</p>
                  <p className="text-[11px] text-zaff-muted">
                    {s.n} mazzi · {s.g} partite · {pct}% vittorie
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setDeckSourceFilter(f.value)}
              aria-pressed={deckSourceFilter === f.value}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                deckSourceFilter === f.value
                  ? 'border-zaff-primary bg-zaff-primary text-white'
                  : 'border-zaff-border text-zaff-muted hover:bg-zaff-bg'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={deckSort}
          onChange={(e) => setDeckSort(e.target.value as DeckSort)}
          className="mb-3 w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-sm text-zaff-text"
        >
          <option value="winrate">Ordina per % vittorie</option>
          <option value="games">Ordina per partite giocate</option>
          <option value="name">Ordina per nome</option>
        </select>

        {sortedDeckStats.length === 0 ? (
          <p className="mb-6 text-sm text-zaff-muted">Nessun mazzo in questa categoria.</p>
        ) : (
          <ul className="mb-6 space-y-2">
            {sortedDeckStats.map((r) => (
              <li key={r.deck} className="rounded-lg border border-zaff-border p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zaff-text">
                    {r.deck}
                    {r.source && (
                      <span className="ml-1 text-xs font-normal text-zaff-muted">
                        ({r.source === 'brew' ? 'Homebrew' : 'Precon'})
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-zaff-muted">
                    {r.g} partite · {r.w} vittorie · {r.pct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zaff-bg">
                  <div className="h-full rounded-full bg-zaff-primary" style={{ width: `${r.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mb-3 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          Torna indietro
        </button>
      </div>
    </div>
  );
}
