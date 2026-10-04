import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import html2canvas from 'html2canvas';
import { canEdit, subscribeToTable, supabase, TABLE_GAMES } from '../../services/supabase';
import { ManaIcons } from './ManaIcon';
import { dateLabel, durationLabel, rowToGame, timeLabel } from './stats';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { cx, HEADING_SECTION, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

interface IconButtonProps {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  children: ReactNode;
}

/** Bottone quadrato con solo un'icona (emoji) e un'etichetta accessibile
 *  (title + aria-label): stesso stile usato in "Gestisci Mazzi" e "Gestisci
 *  Giocatori". */
function IconButton({ label, onClick, tone = 'default', children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zaff-border bg-zaff-bg text-base leading-none text-zaff-muted transition',
        tone === 'danger' ? 'hover:border-red-400 hover:text-red-400' : 'hover:border-zaff-gold hover:text-zaff-gold'
      )}
    >
      {children}
    </button>
  );
}

/** Piccolo badge "JPG", per far capire a colpo d'occhio nel tasto "Esporta
 *  Risultati" in che formato viene generata l'immagine. */
function JpgBadge() {
  return (
    <svg width="28" height="18" viewBox="0 0 28 18" className="mr-1 inline-block align-[-4px]" aria-hidden="true">
      <rect x="0.5" y="0.5" width="27" height="17" rx="3.5" fill="#E8CA7E" stroke="#9E7A31" strokeWidth="1" />
      <text
        x="14"
        y="12.5"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.5"
        fill="#241B3E"
      >
        JPG
      </text>
    </svg>
  );
}

const MANA_DOT_COLOR: Record<string, string> = {
  W: '#EDE6CC',
  U: '#5B9BD9',
  B: '#3B2A4A',
  R: '#C9453B',
  G: '#4C8A5B',
};

/** Pallini mana semplici (niente font di icone) per il dettaglio/immagine
 *  esportata: il font mana-font usato altrove (`ManaIcons`) è un font
 *  personalizzato, e html2canvas non ne calcola sempre bene altezza e
 *  posizione del glifo — nella JPG i simboli risultavano scentrati dentro
 *  i pallini e facevano sballare l'altezza della riga, tagliando il nome
 *  del mazzo sotto. Pallini pieni invece del simbolo preciso, ma sempre
 *  ben centrati e di altezza prevedibile. */
function ExportManaDots({ colors }: { colors: string[] | undefined }) {
  if (!colors || colors.length === 0) return null;
  return (
    <span className="mb-1.5 inline-flex items-center">
      {colors.map((c, i) => (
        <span
          key={c + i}
          className="ml-1 inline-block h-[15px] w-[15px] shrink-0 rounded-full first:ml-0"
          // Colore via style, non con una classe Tailwind con opacità tipo
          // "border-black/25": su Tailwind v4 genera un color-mix() che
          // html2canvas (la libreria con cui generiamo l'immagine) non sa
          // interpretare (vedi lo stesso problema già risolto più sopra).
          style={{ background: MANA_DOT_COLOR[c] ?? '#9CA3AF', border: '1px solid rgba(0,0,0,0.25)' }}
          title={c}
        />
      ))}
    </span>
  );
}

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
  /** Orario preciso di inizio/fine partita (timestamp ISO), se registrato:
   *  `null` per le partite salvate prima di questo campo. */
  startedAt: string | null;
  endedAt: string | null;
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
  /** URL dell'ultima immagine generata: la mostriamo sempre (da salvare
   *  tenendo premuto), perché su iPhone la condivisione nativa può fallire
   *  in silenzio e un semplice download non è affidabile in Safari — così
   *  il tasto "Esporta" non sembra mai non aver fatto nulla. */
  const [exportedImage, setExportedImage] = useState<string | null>(null);
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
  /** Indici dei giocatori ordinati col/i vincitore/i per primo/i (a sinistra/in
   *  cima): `playerTags` resta indicizzato sull'ordine originale, qui si
   *  riordina solo la visualizzazione. */
  const orderedPlayerIndices = useMemo(() => {
    if (!selectedGame) return [];
    const players = selectedGame.players;
    return players.map((_, i) => i).sort((a, b) => Number(players[b].winner) - Number(players[a].winner));
  }, [selectedGame]);

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
    setError('');
    try {
      const canvas = await html2canvas(shareCardRef.current, { backgroundColor: '#1e293b', scale: 2 });
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Non sono riuscito a generare l'immagine: riprova.");
            return;
          }
          const time = idTimeSuffix(g.id);
          const fileName = `partita_${g.date || 'magic'}${time ? '_' + time : ''}.jpg`;
          const file = new File([blob], fileName, { type: 'image/jpeg' });

          // La condivisione nativa è comoda quando funziona, ma su iPhone può
          // essere rifiutata in silenzio se passa un attimo di troppo tra il
          // tocco del bottone e qui (il tempo di generare l'immagine): per
          // questo non ci basiamo solo su di lei, proviamo e basta.
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator
              .share({ files: [file], title: 'Partita di Magic', text: 'Risultato della partita del ' + dateLabel(g.date) })
              .catch(() => {});
          }

          // Mostriamo SEMPRE anche l'anteprima qui sotto, da salvare tenendo
          // premuto: un semplice download via link non è affidabile in Safari
          // su iPhone, così il tasto non sembra mai non aver fatto nulla.
          setExportedImage((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        },
        'image/jpeg',
        0.92
      );
    } catch {
      // Es. una classe colore non supportata da html2canvas: prima d'ora
      // falliva qui in silenzio e il tasto sembrava non fare nulla.
      setError("Non sono riuscito a generare l'immagine: riprova.");
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
                    {/* Il/i vincitore/i sempre per primo/i, a sinistra. */}
                    {(() => {
                      const gHasWinner = g.players.some((pl) => pl.winner);
                      return [...g.players]
                        .sort((a, b) => Number(b.winner) - Number(a.winner))
                        .map((p, i) => (
                          <span
                            key={i}
                            className={`whitespace-nowrap text-sm ${
                              p.winner ? 'font-bold text-zaff-text' : 'italic text-zaff-muted'
                            }`}
                          >
                            {p.winner && '🎉 '}
                            {!p.winner && gHasWinner && '😵 '}
                            {p.name}
                            <ManaIcons colors={p.colors} className="ml-1.5 text-[13px]" />
                          </span>
                        ));
                    })()}
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
        <Modal
          level={2}
          wide
          onClose={() => {
            setSelectedId(null);
            setExportedImage((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
          }}
        >
          <div ref={shareCardRef} className="px-0.5 py-1.5">
            <p className="mb-0.5 text-[11px] uppercase tracking-[0.06em] text-zaff-muted">Registro partite di Magic</p>
            <h2 className={HEADING_SECTION}>{dateLabel(selectedGame.date)}</h2>
            <p className={`mb-3 ${TEXT_MINI}`}>
              {selectedGame.format || 'formato non indicato'} · {selectedGame.players.length} giocatori
              {(() => {
                const start = timeLabel(selectedGame.startedAt);
                const end = timeLabel(selectedGame.endedAt);
                const duration = durationLabel(selectedGame.startedAt, selectedGame.endedAt);
                if (!start && !end) return null;
                return (
                  <>
                    {' · '}
                    {start && <>Inizio {start}</>}
                    {end && <>{start && ' · '}Fine {end}</>}
                    {duration && <> · Durata {duration}</>}
                  </>
                );
              })()}
            </p>

            <div>
              {/* Intestazione della colonna numerica: senza, "0"/"4" ecc.
                  sembrano punteggi a caso invece di punti vita rimasti. */}
              <div className="flex items-center pb-1">
                <div className="min-w-0 flex-1" />
                <div className="max-w-[210px] shrink-0" />
                <div className="w-11 shrink-0 text-right text-[10px] uppercase tracking-wide text-zaff-muted">PV</div>
              </div>
              {orderedPlayerIndices.map((i) => {
                const p = selectedGame.players[i];
                return (
                <div
                  key={i}
                  className="flex items-center border-b border-zaff-border py-2.5 last:border-b-0"
                  // Sfondo via style, non con la classe Tailwind "bg-zaff-text/5": quella
                  // genera un color-mix() che html2canvas (la libreria con cui generiamo
                  // l'immagine) non sa interpretare, e piantava in silenzio tutto
                  // l'export non appena una partita aveva un vincitore segnato.
                  style={p.winner ? { background: 'rgba(248,250,252,0.05)' } : undefined}
                >
                  {/* mr-2.5 invece di `gap` sulla riga: html2canvas (usato per
                      esportare l'immagine) non supporta bene `gap` nel flexbox
                      e le colonne finivano per sovrapporsi nell'immagine. */}
                  <div className="min-w-0 flex-1 pr-2.5">
                    <span className={`text-[15px] ${p.winner ? 'font-bold text-zaff-text' : 'italic text-zaff-muted'}`}>
                      {p.winner && '🎉 '}
                      {!p.winner && hasWinner && '😵 '}
                      {p.name}
                    </span>
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
                    className="flex max-w-[210px] shrink-0 flex-col items-end pr-2.5 text-right text-[13px] text-zaff-muted"
                    title={p.deck || ''}
                  >
                    <ExportManaDots colors={p.colors} />
                    <span className="max-w-[210px] truncate leading-snug">{p.deck || '—'}</span>
                  </div>
                  <div className="w-11 shrink-0 text-right text-[17px] tabular-nums text-zaff-text">
                    {p.life === null || p.life === undefined ? '–' : p.life}
                  </div>
                </div>
                );
              })}
            </div>

            {selectedGame.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded bg-zaff-bg px-3 py-2.5 text-sm text-zaff-text">
                {selectedGame.notes}
              </p>
            )}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <Button onClick={() => handleExport(selectedGame)} disabled={exporting}>
              {exporting ? (
                'Genero immagine…'
              ) : (
                <>
                  <JpgBadge />
                  Esporta Risultati
                </>
              )}
            </Button>

            {canEdit(selectedGame.createdBy, userId) && (
              <>
                <IconButton label="Modifica partita" onClick={() => onEdit(selectedGame)}>
                  ✏️
                </IconButton>
                <IconButton label="Cancella partita" tone="danger" onClick={() => handleDelete(selectedGame.id)}>
                  🗑️
                </IconButton>
              </>
            )}
          </div>

          {exportedImage && (
            <div className="mt-3.5 rounded-lg border border-zaff-border bg-zaff-bg p-3">
              <p className={cx('mb-2', TEXT_MINI)}>
                Tieni premuto sull&apos;immagine qui sotto e scegli &quot;Salva immagine&quot; (o condividila da lì) —
                più affidabile del tasto, che su alcuni iPhone non riesce ad aprire da solo il foglio di condivisione.
              </p>
              <img
                src={exportedImage}
                alt="Risultato della partita, da salvare"
                className="w-full rounded-lg border border-zaff-border"
              />
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
