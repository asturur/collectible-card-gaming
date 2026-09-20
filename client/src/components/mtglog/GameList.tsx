import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { canEdit, subscribeToTable, supabase, TABLE_GAMES } from '../../services/supabase';
import { ManaIcons } from './ManaIcon';
import { dateLabel, rowToGame } from './stats';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { HEADING_SECTION, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

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

function idTimeSuffix(id: string): string {
  const m = String(id).match(/^g(\d{13})/);
  if (!m) return '';
  const d = new Date(Number(m[1]));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/** Storico partite: lista + dettaglio, appellativi scherzosi random per
 *  vincitore/perdenti nel dettaglio.
 *  Va mostrata dentro un `Modal`; il dettaglio partita si apre come riquadro sopra. */
export default function GameList({ userId, onEdit }: GameListProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

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
    setGames((data ?? []).map(rowToGame));
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

  async function handleExport(g: Game) {
    if (!shareCardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, { backgroundColor: '#1e293b', scale: 2 });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const time = idTimeSuffix(g.id);
        const fileName = `partita_${g.date || 'magic'}${time ? '_' + time : ''}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'Partita di Magic', text: 'Risultato della partita del ' + dateLabel(g.date) }).catch(() => {});
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      });
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <p className={TEXT_MUTED}>Caricamento…</p>;
  }

  return (
    <>
      {games.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zaff-border p-6 text-center text-sm text-zaff-muted">
          Nessuna partita qui: aprila da &quot;Nuova partita&quot; in cima alla pagina.
        </div>
      ) : (
        <>
          <p className={`mb-2 ${TEXT_MINI}`}>{games.length} partite</p>
          <ul>
            {games.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className="mb-2 flex w-full items-center gap-3.5 rounded-lg border border-zaff-border bg-zaff-bg px-3.5 py-3 text-left transition hover:border-zaff-primary"
                >
                  <span className="shrink-0 whitespace-nowrap border-r border-zaff-border pr-3 text-sm text-zaff-muted">
                    {dateLabel(g.date)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-x-3.5 gap-y-1.5">
                    {g.players.map((p, i) => (
                      <span
                        key={i}
                        className={`whitespace-nowrap text-sm ${p.winner ? 'font-semibold text-zaff-highlight' : 'text-zaff-text'}`}
                      >
                        {p.winner && '🏆 '}
                        {p.name}
                        <ManaIcons colors={p.colors} className="text-[13px]" />
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {selectedGame && (
        <Modal level={2} wide onClose={() => setSelectedId(null)}>
          <div ref={shareCardRef} className="px-0.5 py-1.5">
            <p className="mb-0.5 text-[11px] uppercase tracking-[0.06em] text-zaff-muted">Registro partite di Magic</p>
            <h2 className={HEADING_SECTION}>{dateLabel(selectedGame.date)}</h2>
            <p className={`mb-3 ${TEXT_MINI}`}>
              {selectedGame.format || 'formato non indicato'} · {selectedGame.players.length} giocatori
            </p>

            <div>
              {selectedGame.players.map((p, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2.5 border-b border-zaff-border py-2.5 last:border-b-0 ${
                    p.winner ? 'bg-zaff-highlight/10' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[15px] text-zaff-text">{p.name}</span>
                    {playerTags[i] && (
                      <span
                        className={`block text-xs ${p.winner ? 'text-zaff-gold' : 'italic text-zaff-muted opacity-75'}`}
                      >
                        {p.winner ? 'vincitore — ' : ''}
                        {playerTags[i]}
                      </span>
                    )}
                  </div>
                  <div
                    className="flex max-w-[210px] shrink-0 flex-col items-end gap-0.5 text-right text-[13px] text-zaff-muted"
                    title={p.deck || ''}
                  >
                    <ManaIcons colors={p.colors} className="text-[17px]" />
                    <span className="max-w-[210px] truncate">{p.deck || '—'}</span>
                  </div>
                  <div className="w-11 shrink-0 text-right text-[17px] tabular-nums text-zaff-text">
                    {p.life === null || p.life === undefined ? '–' : p.life}
                  </div>
                </div>
              ))}
            </div>

            {selectedGame.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded bg-zaff-bg px-3 py-2.5 text-sm text-zaff-text">
                {selectedGame.notes}
              </p>
            )}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <Button onClick={() => handleExport(selectedGame)} disabled={exporting}>
              {exporting ? 'Genero immagine…' : '🖼️ Esporta risultati'}
            </Button>

            {canEdit(selectedGame.createdBy, userId) && (
              <>
                <Button variant="link" size="sm" onClick={() => onEdit(selectedGame)}>
                  Modifica
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(selectedGame.id)}>
                  Cancella
                </Button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
