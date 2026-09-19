import { useEffect, useMemo, useState } from 'react';
import { canEdit, subscribeToTable, supabase, TABLE_GAMES } from '../../services/supabase';

export interface GamePlayer {
  name: string;
  deck: string;
  desc: string;
  life: number | null;
  winner: boolean;
  colors: string[];
  seat?: number;
}

export interface Game {
  id: string;
  date: string;
  format: string;
  notes: string;
  players: GamePlayer[];
  group: string;
  createdBy: string | null;
}

interface GameListProps {
  userId: string;
  onBack: () => void;
  onEdit: (game: Game) => void;
}

const WINNER_TAGS = [
  'King', 'Top Player', 'Bomber', 'King Slayer', 'Leggenda', 'Fenomeno',
  'Il Boss', 'Sua Maestà', 'MVP', 'Il Cecchino', 'Highlander', 'Spaccatutto',
  'Il Macellaio', 'Divinità del Mana', 'Sultano del Tavolo', 'Il Terminator',
  'Archenemy', 'Il Pilota del Topdeck', 'Signore del Mana', 'God Hand',
  'Il Combo Killer', 'Wincondition Vivente', 'Draft God', 'Il Boardwipe',
  "L'Intoccabile", 'Numero Uno', 'Il Sicario del Tavolo', 'Player of the Year',
  'Il Genio del Board State', 'Matto di Topdeck',
];

const LOSER_TAGS = [
  'Pippa', 'Pippa al sugo', 'NPC', 'Forte forte', 'Bersaglio mobile',
  'Carne da mazzo', 'Ultimo della classe', 'Il sacrificio rituale',
  'Tappezzeria', 'Panchinaro', 'Fantasma del tavolo', 'Il fusibile',
  'Vittima collaterale', 'Comparsa', 'Statista (de che)',
  'Mana Screwato', 'Il Mulligan Perenne', 'Topdeck Sfortunato', 'Il Brick',
  'Board Wiped', 'Sacco da Boxe', "L'Aggro Bait", 'Chump Blocker',
  'Il Fodder', 'Terra Ferma', 'Il Draw-Go', 'Ultimo Piazzato',
  'Skill Issue', 'Git Gud', 'Il Sagoma',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateLabel(iso: string): string {
  if (!iso) return 'Senza data';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Storico partite: lista + dettaglio, filtro per gruppo (se ce n'è più di uno),
 *  appellativi scherzosi random per vincitore/perdenti nel dettaglio. */
export default function GameList({ userId, onBack, onEdit }: GameListProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function loadGames() {
    if (!supabase) return;
    const { data, error: loadError } = await supabase
      .from(TABLE_GAMES)
      .select('*')
      .order('date', { ascending: false })
      .order('id', { ascending: false });
    if (loadError) {
      setError('Non riesco a leggere il registro condiviso: ' + loadError.message);
      return;
    }
    setGames(
      (data ?? []).map((row) => ({
        id: row.id,
        date: row.date,
        format: row.format ?? '',
        notes: row.notes ?? '',
        players: row.players ?? [],
        group: row.gruppo ?? 'Generale',
        createdBy: row.created_by ?? null,
      }))
    );
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    loadGames().finally(() => setLoading(false));
    const unsubscribe = subscribeToTable(TABLE_GAMES, loadGames);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => [...new Set(games.map((g) => g.group))].sort((a, b) => a.localeCompare(b)), [games]);

  useEffect(() => {
    if (groupFilter !== 'all' && !groups.includes(groupFilter)) setGroupFilter('all');
  }, [groups, groupFilter]);

  const visibleGames = groupFilter === 'all' ? games : games.filter((g) => g.group === groupFilter);
  const selectedGame = games.find((g) => g.id === selectedId) ?? null;

  const hasWinner = selectedGame ? selectedGame.players.some((p) => p.winner) : false;
  const playerTags = useMemo(() => {
    if (!selectedGame) return [];
    return selectedGame.players.map((p) => (p.winner ? randomFrom(WINNER_TAGS) : hasWinner ? randomFrom(LOSER_TAGS) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleDelete(id: string) {
    if (!supabase) return;
    if (!confirm('Cancellare questa partita dal registro? La vedranno cancellata anche gli altri.')) return;
    const { error: deleteError } = await supabase.from(TABLE_GAMES).delete().eq('id', id);
    if (deleteError) {
      setError('Cancellazione non riuscita: ' + deleteError.message);
      return;
    }
    setSelectedId(null);
    await loadGames();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
        <p className="text-zaff-muted">Caricamento…</p>
      </div>
    );
  }

  if (selectedGame) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
          <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-zaff-primary">
            {dateLabel(selectedGame.date)}
          </h1>
          <p className="mb-6 text-center text-sm text-zaff-muted">
            {selectedGame.format || 'formato non indicato'} · {selectedGame.players.length} giocatori · gruppo:{' '}
            {selectedGame.group}
          </p>

          <ul className="mb-4 space-y-3">
            {selectedGame.players.map((p, i) => (
              <li key={i} className={`rounded-lg border p-3 ${p.winner ? 'border-zaff-primary' : 'border-zaff-border'}`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-zaff-text">
                    {p.winner && '🏆 '}
                    {p.name}
                  </span>
                  {playerTags[i] && (
                    <span className={`text-xs ${p.winner ? 'text-zaff-primary' : 'text-zaff-muted'}`}>
                      {p.winner ? 'vincitore — ' : ''}
                      {playerTags[i]}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-zaff-muted">
                  <span className="min-w-0 flex-1 truncate" title={p.deck || ''}>
                    {(p.colors ?? []).length > 0 && <span className="mr-1">{(p.colors ?? []).join('')}</span>}
                    {p.deck || '—'}
                  </span>
                  <span className="shrink-0">{p.life === null || p.life === undefined ? '–' : p.life} PV</span>
                </div>
              </li>
            ))}
          </ul>

          {selectedGame.notes && <p className="mb-4 text-sm text-zaff-muted">{selectedGame.notes}</p>}

          {canEdit(selectedGame.createdBy, userId) && (
            <div className="mb-3 flex gap-3">
              <button
                type="button"
                onClick={() => onEdit(selectedGame)}
                className="flex-1 rounded-lg border border-zaff-border px-4 py-2 text-sm font-semibold text-zaff-primary transition-colors hover:bg-zaff-bg"
              >
                Modifica
              </button>
              <button
                type="button"
                onClick={() => handleDelete(selectedGame.id)}
                className="flex-1 rounded-lg border border-zaff-border px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-zaff-bg"
              >
                Cancella
              </button>
            </div>
          )}

          {error && (
            <p className="mb-3 text-center text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
          >
            Torna alla lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-zaff-primary">
          Partite salvate {visibleGames.length > 0 && <span className="text-base text-zaff-muted">({visibleGames.length})</span>}
        </h1>

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

        {visibleGames.length === 0 ? (
          <p className="text-center text-sm text-zaff-muted">
            Nessuna partita qui: aprila da &quot;Nuova partita&quot; nella home del registro.
          </p>
        ) : (
          <ul className="divide-y divide-zaff-border">
            {visibleGames.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className="flex w-full flex-col gap-1 py-3 text-left hover:bg-zaff-bg"
                >
                  <span className="text-sm font-semibold text-zaff-text">{dateLabel(g.date)}</span>
                  <span className="flex flex-wrap gap-x-2 text-xs text-zaff-muted">
                    {g.players.map((p, i) => (
                      <span key={i} className={p.winner ? 'font-semibold text-zaff-primary' : ''}>
                        {p.winner && '🏆 '}
                        {p.name}
                        {(p.colors ?? []).length > 0 ? ` (${(p.colors ?? []).join('')})` : ''}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-3 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-6 w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          Torna indietro
        </button>
      </div>
    </div>
  );
}
