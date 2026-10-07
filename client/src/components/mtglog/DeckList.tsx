import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { canEdit, MAX_DECK_NAME_LENGTH, supabase, TABLE_DECKS } from '../../services/supabase';
import { ManaIcons, ManaPips } from './ManaIcon';
import DeckCardsView from './DeckCards';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { cx, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

interface DeckListProps {
  userId: string;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onImportFile: (name: string, cards: DeckCard[]) => void;
}

/** `section` distingue il mazzo vero e proprio dalla riserva, così la lista
 *  e l'editor possono mostrarli separati; i mazzi salvati prima di questa
 *  distinzione non hanno il campo e vengono trattati come "main". */
interface DeckCard {
  name: string;
  qty: number;
  section: 'main' | 'side';
}

/** Un mazzo letto da `mazzi.cards` può non avere ancora `section` (righe
 *  salvate prima di questa funzione): senza indicazione è sempre main deck. */
function normalizeSection(raw: unknown): 'main' | 'side' {
  return raw === 'side' ? 'side' : 'main';
}

/** Riconosce una riga "<copie> <nome carta> [(espansione) numero]": espansione
 *  e numero di collezione sono facoltativi e vengono ignorati. Usata sia per
 *  i file ManaBox sia per il testo copia-incolla da altre app. */
function parseCardLine(line: string): { name: string; qty: number } | null {
  const m = line.match(/^(\d+)\s+(.+)$/);
  if (!m) return null;
  const qty = parseInt(m[1], 10);
  const rest = m[2].trim();
  const setMatch = rest.match(/^(.*)\s+\([^)]+\)\s+\S+$/);
  const name = (setMatch ? setMatch[1] : rest).trim();
  if (!name || !qty) return null;
  return { name, qty };
}

/** Legge un file di testo esportato da ManaBox: ogni riga è
 *  "<copie> <nome carta> [(espansione) numero]", sempre main deck (questo
 *  formato non distingue una riserva). */
function parseManaboxText(text: string): DeckCard[] {
  const merged: Record<string, DeckCard> = {};
  text.split(/\r?\n/).forEach((rawLine) => {
    const card = parseCardLine(rawLine.trim());
    if (!card) return;
    const key = card.name.toLowerCase();
    merged[key] = merged[key] ?? { name: card.name, qty: 0, section: 'main' };
    merged[key].qty += card.qty;
  });
  return Object.values(merged);
}

/** Riga di intestazione tipo "Deck", "Main Deck - 39", "Sideboard", "Sideboard 11":
 *  il numero dopo, quando c'è, conta i TIPI di carta (non il totale copie) e
 *  non serve per importare; dice solo da quel punto in poi se le righe
 *  seguenti sono main deck o sideboard. */
const MAIN_HEADER_RE = /^(main\s*deck|mainboard|deck)\b/i;
const SIDE_HEADER_RE = /^sideboard\b/i;

/**
 * Legge un elenco mazzo copiato/incollato da un'altra app (es. l'elenco di
 * ManaBox copiato a mano, o l'export di MTG Scanner / Dragon Shield): righe
 * di intestazione ("Deck"/"Main Deck - 39", "Sideboard"), righe vuote e righe
 * carta ("<copie> <nome carta>") in qualsiasi combinazione. Le carte restano
 * divise per main deck/sideboard a seconda di sotto quale intestazione si
 * trovano (prima di qualsiasi intestazione si considerano main deck).
 */
function parsePastedDeckList(text: string): DeckCard[] {
  const merged: Record<string, DeckCard> = {};
  let section: 'main' | 'side' = 'main';
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    if (MAIN_HEADER_RE.test(line)) {
      section = 'main';
      return;
    }
    if (SIDE_HEADER_RE.test(line)) {
      section = 'side';
      return;
    }
    const card = parseCardLine(line);
    if (!card) return;
    const key = section + '|' + card.name.toLowerCase();
    merged[key] = merged[key] ?? { name: card.name, qty: 0, section };
    merged[key].qty += card.qty;
  });
  return Object.values(merged);
}

interface Deck {
  id: string;
  name: string;
  cards: DeckCard[];
  source: string;
  colors: string[];
  createdBy: string | null;
}

function deckTotal(d: Deck): number {
  return d.cards.reduce((sum, c) => sum + c.qty, 0);
}

function sourceLabel(source: string): string | null {
  if (source === 'precon') return 'Precon';
  if (source === 'brew') return 'Homebrew';
  return null;
}

/** Pillola "Homebrew"/"Precon" accanto al nome del mazzo. */
function SourceBadge({ source }: { source: string }) {
  const label = sourceLabel(source);
  if (!label) return null;
  return <Badge tone={source === 'brew' ? 'brew' : 'precon'}>{label}</Badge>;
}

/** Lista mazzi salvati + dettaglio, con creazione/modifica/cancellazione (Step 5).
 *  Va mostrata dentro un `Modal`; il dettaglio mazzo si apre come riquadro sopra. */
export default function DeckList({ userId, onCreate, onEdit, onImportFile }: DeckListProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseManaboxText(String(reader.result));
      if (!parsed.length) {
        setError('Non sono riuscito a leggere nessuna carta da questo file: controlla il formato.');
        return;
      }
      // Il nome del file può essere lungo quanto vuole: lo taglio subito,
      // così non arriva mai un nome mazzo fuori dal limite deciso.
      onImportFile(file.name.replace(/\.[^/.]+$/, '').slice(0, MAX_DECK_NAME_LENGTH), parsed);
    };
    reader.readAsText(file, 'utf-8');
  }

  function handlePasteImport() {
    const parsed = parsePastedDeckList(pasteText);
    if (!parsed.length) {
      setPasteError("Non sono riuscito a leggere nessuna carta da questo testo: controlla che ci sia una riga \"<numero> <nome carta>\" per ogni carta.");
      return;
    }
    setPasteError('');
    setPasteOpen(false);
    setPasteText('');
    // Il testo incollato non porta un nome mazzo: lo si scrive nella
    // schermata di modifica che si apre subito dopo.
    onImportFile('', parsed);
  }

  async function loadDecks() {
    if (!supabase) return;
    const { data, error: loadError } = await supabase.from(TABLE_DECKS).select('*').order('name');
    if (loadError) {
      setError('Non riesco a leggere i mazzi: ' + loadError.message);
      return;
    }
    setDecks(
      [...(data ?? [])]
        .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'it', { sensitivity: 'base' }))
        .map((r) => ({
        id: r.id,
        name: r.name,
        cards: (r.cards ?? []).map((c: { name: string; qty: number; section?: unknown }) => ({
          name: c.name,
          qty: c.qty,
          section: normalizeSection(c.section),
        })),
        source: r.source ?? '',
        colors: r.colors ?? [],
        createdBy: r.created_by ?? null,
      }))
    );
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    loadDecks().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** True se il mazzo è stato davvero cancellato (non annullato, non in errore). */
  async function handleDelete(id: string): Promise<boolean> {
    if (!supabase) return false;
    if (!confirm('Cancellare questo mazzo? Le partite che lo usano già continueranno a mostrarne solo il nome.')) return false;
    const { error: deleteError } = await supabase.from(TABLE_DECKS).delete().eq('id', id);
    if (deleteError) {
      setError('Cancellazione mazzo non riuscita: ' + deleteError.message);
      return false;
    }
    await loadDecks();
    return true;
  }

  const selectedDeck = decks.find((d) => d.id === selectedId) ?? null;

  return (
    <>
      <div className="mb-3">
        {loading ? (
          <p className={TEXT_MUTED}>Caricamento…</p>
        ) : decks.length === 0 ? (
          <p className="text-sm text-zaff-muted">Ancora nessun mazzo salvato.</p>
        ) : (
          <ul>
            {decks.map((d) => (
              <li key={d.id}>
                {/* Una sola azione per riga: tutta la riga apre il mazzo.
                    Modifica e cancella (solo mazzi propri) stanno nel dettaglio. */}
                <button
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  title={d.name}
                  className="mb-2 flex w-full items-center gap-1.5 overflow-hidden rounded-lg border border-zaff-border bg-zaff-bg py-3 pl-3.5 pr-2 text-left transition hover:border-zaff-primary active:border-zaff-primary"
                >
                  <span className="min-w-0 truncate text-[15px] text-zaff-text">{d.name}</span>
                  <ManaIcons colors={d.colors} className="shrink-0 text-[17px]" />
                  <span className="ml-auto shrink-0 pl-2 text-2xl leading-none text-zaff-muted" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept=".txt" hidden onChange={handleFileChange} />

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* Un solo tasto, sempre in vista in fondo (sopra la barra di
          navigazione): le tre strade per creare un mazzo si scelgono dopo. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-3 border-t border-zaff-border bg-zaff-surface px-4 py-3 sm:-mx-6 sm:px-6">
        <Button
          size="lg"
          fullWidth
          className="py-3.5 text-lg"
          onClick={() => {
            setError('');
            setCreateOpen(true);
          }}
        >
          + Crea Nuovo Mazzo
        </Button>
      </div>

      {createOpen && (
        <Modal level={2} title="Crea Nuovo Mazzo" subtitle="Come vuoi iniziare?" onClose={() => setCreateOpen(false)}>
          <div className="flex flex-col gap-2.5">
            <Button
              size="lg"
              fullWidth
              className="py-3.5 text-lg"
              onClick={() => {
                setCreateOpen(false);
                onCreate();
              }}
            >
              ✍️ Inserimento manuale
            </Button>
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              className="py-3.5"
              onClick={() => {
                setCreateOpen(false);
                fileInputRef.current?.click();
              }}
            >
              📄 Importa file (ManaBox)
            </Button>
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              className="py-3.5"
              onClick={() => {
                setCreateOpen(false);
                setPasteError('');
                setPasteOpen(true);
              }}
            >
              📋 Incolla elenco
            </Button>
          </div>
        </Modal>
      )}

      {pasteOpen && (
        <Modal
          level={2}
          title="Incolla elenco"
          onClose={() => {
            setPasteOpen(false);
            setPasteText('');
          }}
        >
          <p className={cx('mb-2', TEXT_MINI)}>
            Incolla qui l&apos;elenco copiato da ManaBox, MTG Scanner o app simili: righe come &quot;Deck&quot; o
            &quot;Sideboard&quot; (anche con un numero dopo) vengono riconosciute e saltate da sole.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'Deck\n2 Annul\n4 Brainstorm\n16 Island\n\nSideboard\n2 Island'}
            rows={8}
            className="w-full rounded-lg border border-zaff-border bg-zaff-bg p-2.5 text-sm text-zaff-text placeholder:text-zaff-muted"
          />
          {pasteError && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {pasteError}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Button size="lg" onClick={handlePasteImport} disabled={!pasteText.trim()}>
              Importa
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => {
                setPasteOpen(false);
                setPasteText('');
              }}
            >
              Annulla
            </Button>
          </div>
        </Modal>
      )}

      {selectedDeck && (
        <Modal level={2} title={selectedDeck.name} onClose={() => setSelectedId(null)}>
          <p className={`mb-2.5 flex items-center gap-2 ${TEXT_MINI}`}>
            <SourceBadge source={selectedDeck.source} />
            {deckTotal(selectedDeck)} carte
          </p>

          {selectedDeck.colors.length > 0 && (
            <div className="mb-2.5">
              <ManaPips colors={selectedDeck.colors} />
            </div>
          )}

          {canEdit(selectedDeck.createdBy, userId) && (
            // Solo per i mazzi propri.
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  const id = selectedDeck.id;
                  setSelectedId(null);
                  onEdit(id);
                }}
              >
                ✏️ Modifica
              </Button>
              <Button
                variant="ghost"
                fullWidth
                className="hover:border-red-400 hover:text-red-400"
                onClick={async () => {
                  if (await handleDelete(selectedDeck.id)) setSelectedId(null);
                }}
              >
                🗑️ Cancella
              </Button>
            </div>
          )}

          <DeckCardsView cards={selectedDeck.cards} />
        </Modal>
      )}
    </>
  );
}
