import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { MAX_DECK_NAME_LENGTH } from '../../services/supabase';
import { listSavedDecks, subscribeSavedDecks, type SavedDeck } from '../../services/savedDecks';
import { parseDeckText, type DeckEntry } from '../../services/deckCards';
import { ManaIcons, ManaPips } from './ManaIcon';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { cx, TEXT_MINI, TEXT_MUTED } from '../ui/styles';
import { Link } from 'react-router';
import { paths } from '../../router';

interface DeckListProps {
  onCreate: () => void;
  onImportFile: (name: string, cards: DeckCard[]) => void;
}

type DeckCard = DeckEntry;
type Deck = SavedDeck;
const parseManaboxText = (text: string) => parseDeckText(text);
const parsePastedDeckList = (text: string) => parseDeckText(text);

/** Saved-deck links with filters and local creation/import tasks. */
export default function DeckList({ onCreate, onImportFile }: DeckListProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try { const decks = await listSavedDecks(); if (!cancelled) { setDecks(decks); setError(''); } }
      catch (err) { if (!cancelled) setError('Non riesco a leggere i mazzi: ' + (err as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    const stop = subscribeSavedDecks(load);
    return () => { cancelled = true; stop(); };
  }, []);

  function toggleColorFilter(c: string) {
    setColorFilter((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  // Colori: il mazzo deve contenerli tutti quelli selezionati (può averne altri).
  const visibleDecks = decks.filter(
    (d) =>
      [...colorFilter].every((c) => d.colors.includes(c))
  );
  const filtersActive = colorFilter.size > 0;

  return (
    <>
      <div className="mb-3">
        {loading ? (
          <p className={TEXT_MUTED}>Caricamento…</p>
        ) : decks.length === 0 ? (
          <p className="text-sm text-zaff-muted">Ancora nessun mazzo salvato.</p>
        ) : (
          <>
            {/* Il filtro colore resta in cima mentre si scorre la lista. */}
            <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-1 mb-2 rounded-lg border border-zaff-border bg-zaff-surface p-2.5 shadow-lg">
              <span className={cx('mb-1.5 block', TEXT_MINI)}>Colore</span>
              <div className="flex flex-wrap items-center gap-2">
                <ManaPips colors={colorFilter} onToggle={toggleColorFilter} />
                <button
                  type="button"
                  onClick={() => setColorFilter(new Set())}
                  aria-pressed={colorFilter.size === 0}
                  className={cx(
                    'rounded-lg border px-3 py-1.5 text-[13px] transition',
                    colorFilter.size === 0
                      ? 'border-transparent bg-gradient-to-r from-zaff-primary to-zaff-accent font-semibold text-zaff-bg'
                      : 'border-zaff-border bg-zaff-surface text-zaff-muted hover:text-zaff-text'
                  )}
                >
                  Nessun filtro
                </button>
              </div>
            </div>
            {filtersActive && (
              <p className={cx('mb-2', TEXT_MINI)}>
                {visibleDecks.length} di {decks.length} mazzi
              </p>
            )}
            {visibleDecks.length === 0 && <p className="text-sm text-zaff-muted">Nessun mazzo con questi filtri.</p>}
          <ul>
            {visibleDecks.map((d) => (
              <li key={d.id}>
                {/* Una sola azione per riga: tutta la riga apre il mazzo.
                    Modifica e cancella (solo mazzi propri) stanno nel dettaglio. */}
                <Link
                  to={paths.deck(d.id)}
                  title={d.name}
                  className="mb-2 flex w-full items-center gap-1.5 overflow-hidden rounded-lg border border-zaff-border bg-zaff-bg py-3 pl-3.5 pr-2 text-left transition hover:border-zaff-primary active:border-zaff-primary"
                >
                  <span className="min-w-0 truncate text-[15px] text-zaff-text">{d.name}</span>
                  <ManaIcons colors={d.colors} className="shrink-0 text-[17px]" />
                  <span className="ml-auto shrink-0 pl-2 text-2xl leading-none text-zaff-muted" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          </>
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
              📋 Incolla Elenco da Testo
            </Button>
          </div>
        </Modal>
      )}

      {pasteOpen && (
        <Modal
          level={2}
          title="Incolla Elenco da Testo"
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

    </>
  );
}
