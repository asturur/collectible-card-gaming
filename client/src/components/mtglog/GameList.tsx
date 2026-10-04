import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toCanvas } from 'html-to-image';
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

/** Stesso schema di colori dei simboli mana "ufficiali": pallino chiaro con
 *  simbolo scuro per i colori chiari, pallino nero con simbolo chiaro per il
 *  nero (altrimenti il teschio scuro su pallino scuro sparisce sullo sfondo
 *  scuro dell'app — questo è esattamente quello che non andava bene prima). */
const MANA_BG_COLOR: Record<string, string> = {
  W: '#EDE6CC',
  U: '#5B9BD9',
  B: '#241B2E',
  R: '#C9453B',
  G: '#4C8A5B',
};

function manaInk(color: string): string {
  return color === 'B' ? '#F3EEE3' : '#171220';
}

/** Simboli mana disegnati a mano, con lo stesso stile "pallino colorato +
 *  simbolo" delle altre schermate (Gestisci Mazzi, Nuova Partita), dove usano
 *  il font di icone `ManaIcons`: qui invece sono SVG puro, niente font,
 *  perché nel dettaglio/immagine esportata il font non viene centrato in modo
 *  affidabile da html2canvas (vedi commento su `ManaIcons` altrove nel file).
 *  Forma e posizione quindi sempre fisse e prevedibili, pallino colorato per
 *  restare leggibili come nel resto dell'app. */
function ManaSymbolIcon({ color }: { color: string }) {
  const bg = MANA_BG_COLOR[color] ?? '#6B7280';
  const ink = manaInk(color);
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill={bg} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      {color === 'W' && (
        <>
          <circle cx="12" cy="12" r="3" fill={ink} />
          <line x1="16.5" y1="12" x2="19.5" y2="12" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="15.18" y1="15.18" x2="17.3" y2="17.3" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="16.5" x2="12" y2="19.5" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8.82" y1="15.18" x2="6.7" y2="17.3" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7.5" y1="12" x2="4.5" y2="12" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8.82" y1="8.82" x2="6.7" y2="6.7" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="7.5" x2="12" y2="4.5" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="15.18" y1="8.82" x2="17.3" y2="6.7" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {color === 'U' && (
        <path d="M12 5C12 5 7.5 11 7.5 14.5a4.5 4.5 0 0 0 9 0C16.5 11 12 5 12 5z" fill={ink} />
      )}
      {color === 'B' && (
        <>
          <path
            d="M12 6a5 5 0 0 0-5 5c0 2 1 3.4 2 4.3V17a.8.8 0 0 0 .8.8h1v-1.4h.8v1.4h.8v-1.4h.8v1.4h1a.8.8 0 0 0 .8-.8v-1.7c1-.9 2-2.3 2-4.3a5 5 0 0 0-5-5z"
            fill={ink}
          />
          <circle cx="10.1" cy="10.6" r="1.1" fill={bg} />
          <circle cx="13.9" cy="10.6" r="1.1" fill={bg} />
          <rect x="11.4" y="12.2" width="1.2" height="1.3" fill={bg} />
        </>
      )}
      {color === 'R' && (
        <path
          d="M12 5c1.3 2-.6 3.3-.6 4.6 0 .7.5 1.2 1.2 1.2s1.2-.5 1.2-1.2c.9 1.1 1.6 2.4 1.6 3.9a3.4 3.4 0 1 1-6.8 0C8.6 10.5 10.3 8 12 5z"
          fill={ink}
        />
      )}
      {color === 'G' && (
        <path
          d="M12 5.3C9 6.5 7.3 9.3 7.3 12.5c3 .8 6.2-.7 7.3-3.6.6-1.7-.7-3.6-2.6-3.6z"
          fill={ink}
        />
      )}
      {!['W', 'U', 'B', 'R', 'G'].includes(color) && <circle cx="12" cy="12" r="4" fill={ink} />}
    </svg>
  );
}

/** Riga di simboli mana usata SOLO nella copia nascosta della scheda
 *  (vedi `ShareCardBody`/`ExportCopy` più sotto) che genera l'immagine:
 *  quella visibile a schermo usa sempre le vere icone `ManaIcons`, identiche
 *  al resto dell'app. */
function ExportManaSymbols({ colors }: { colors: string[] | undefined }) {
  if (!colors || colors.length === 0) return null;
  return (
    <span className="inline-flex items-center">
      {colors.map((c, i) => (
        <span key={c + i} className="ml-1.5 inline-flex first:ml-0" title={c}>
          <ManaSymbolIcon color={c} />
        </span>
      ))}
    </span>
  );
}

/** Icone mana "vere" (font ufficiale), per la scheda visibile a schermo: le
 *  stesse di elenco partite, Nuova Partita e Gestisci Mazzi. */
function LiveManaSymbols({ colors }: { colors: string[] | undefined }) {
  return <ManaIcons colors={colors} className="text-[19px]" />;
}

interface ShareCardBodyProps {
  game: Game;
  orderedPlayerIndices: number[];
  playerTags: (string | null)[];
  hasWinner: boolean;
  /** `LiveManaSymbols` per la scheda a schermo, `ExportManaSymbols` per la
   *  copia nascosta da cui generiamo il JPG (vedi sopra). */
  ManaDisplay: (props: { colors: string[] | undefined }) => ReactNode;
}

/** Contenuto della scheda risultato partita (testata, 3 colonne, note):
 *  reso due volte, una visibile e una nascosta solo per l'esportazione (vedi
 *  `GameList` più sotto) — stesso identico markup, cambia solo come vengono
 *  disegnati i simboli mana. */
function ShareCardBody({ game, orderedPlayerIndices, playerTags, hasWinner, ManaDisplay }: ShareCardBodyProps) {
  return (
    <div className="px-0.5 py-1.5">
      <p className="mb-0.5 text-[11px] uppercase tracking-[0.06em] text-zaff-muted">Registro partite di Magic</p>
      <h2 className={HEADING_SECTION}>{dateLabel(game.date)}</h2>
      <p className={`mb-3 ${TEXT_MINI}`}>
        {game.format || 'formato non indicato'} · {game.players.length} giocatori
        {(() => {
          const start = timeLabel(game.startedAt);
          const end = timeLabel(game.endedAt);
          const duration = durationLabel(game.startedAt, game.endedAt);
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
        {/* 3 colonne di uguale larghezza (grid, non flex con pesi diversi),
            ciascuna con intestazione e contenuto centrati al suo interno. */}
        <div className="grid grid-cols-3 pb-1">
          <div className="text-center text-[10px] uppercase tracking-wide text-zaff-muted">Nome Giocatore</div>
          <div className="text-center text-[10px] uppercase tracking-wide text-zaff-muted">Mazzo Utilizzato</div>
          <div className="text-center text-[10px] uppercase tracking-wide text-zaff-muted">Punti Vita Rimasti</div>
        </div>
        {orderedPlayerIndices.map((i) => {
          const p = game.players[i];
          return (
            <div
              key={i}
              // Riga alta e con parecchio margine verticale: al massimo 4
              // giocatori per partita, quindi ce n'è ampiamente lo spazio, e
              // così il nome del mazzo ha sempre abbastanza altezza libera
              // intorno a sé da non finire mai tagliato nell'immagine esportata.
              className="grid min-h-[86px] grid-cols-3 items-center border-b border-zaff-border py-5 last:border-b-0"
              // Sfondo via style, non con la classe Tailwind "bg-zaff-text/5": quella
              // genera un color-mix() che html2canvas (la libreria con cui generiamo
              // l'immagine) non sa interpretare, e piantava in silenzio tutto
              // l'export non appena una partita aveva un vincitore segnato.
              style={p.winner ? { background: 'rgba(248,250,252,0.05)' } : undefined}
            >
              <div className="flex flex-col items-center px-1 text-center">
                <span className={`text-[15px] ${p.winner ? 'font-bold text-zaff-text' : 'italic text-zaff-muted'}`}>
                  {p.winner && '🎉 '}
                  {!p.winner && hasWinner && '😵 '}
                  {p.name}
                </span>
                {playerTags[i] && (
                  <span className={`mt-0.5 text-xs ${p.winner ? 'text-zaff-gold' : 'italic text-zaff-muted opacity-75'}`}>
                    {p.winner ? 'vincitore — ' : ''}
                    {playerTags[i]}
                  </span>
                )}
              </div>
              <div
                className="flex flex-col items-center px-1 text-center text-[13px] text-zaff-muted"
                title={p.deck || ''}
              >
                <ManaDisplay colors={p.colors} />
                <span className="mt-2.5 max-w-full truncate pb-0.5 leading-[1.8]">{p.deck || '—'}</span>
              </div>
              <div className="text-center text-[17px] tabular-nums text-zaff-text">
                {p.life === null || p.life === undefined ? '–' : p.life}
              </div>
            </div>
          );
        })}
      </div>

      {game.notes && (
        <p className="mt-3 whitespace-pre-wrap rounded bg-zaff-bg px-3 py-2.5 text-sm text-zaff-text">{game.notes}</p>
      )}
    </div>
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
      // html-to-image invece di html2canvas: non reinterpreta a modo suo gli
      // stili come faceva html2canvas (da cui venivano sia il taglio del nome
      // mazzo che lo sfondo del vincitore da riscrivere a mano), ma chiede
      // al browser stesso di disegnare la pagina — compreso, si spera, il
      // font delle icone mana, che qui proviamo di nuovo vero (`LiveManaSymbols`
      // anche nella copia nascosta, vedi sotto) invece del simbolo di riserva.
      const canvas = await toCanvas(shareCardRef.current, {
        backgroundColor: '#1e293b',
        pixelRatio: 2,
        cacheBust: true,
      });
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
          xl
          onClose={() => {
            setSelectedId(null);
            setExportedImage((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
          }}
        >
          <ShareCardBody
            game={selectedGame}
            orderedPlayerIndices={orderedPlayerIndices}
            playerTags={playerTags}
            hasWinner={hasWinner}
            ManaDisplay={LiveManaSymbols}
          />

          {/* Copia identica, ma fuori schermo e invisibile: è da QUESTA che
              generiamo il JPG (vedi handleExport). In prova: con la nuova
              libreria (html-to-image al posto di html2canvas) usiamo qui le
              icone mana VERE (`LiveManaSymbols`, le stesse della copia
              visibile sopra) invece del simbolo di riserva disegnato a mano
              (`ExportManaSymbols`, tenuto pronto più sopra nel file come
              ripiego: se il font non dovesse venire bene nell'immagine
              esportata, basta rimetterlo qui). */}
          <div className="pointer-events-none fixed left-[-9999px] top-0" aria-hidden="true">
            <div ref={shareCardRef} className="w-[440px] bg-zaff-surface">
              <ShareCardBody
                game={selectedGame}
                orderedPlayerIndices={orderedPlayerIndices}
                playerTags={playerTags}
                hasWinner={hasWinner}
                ManaDisplay={LiveManaSymbols}
              />
            </div>
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
