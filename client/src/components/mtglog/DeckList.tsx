import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { MAX_DECK_NAME_LENGTH, shortenName } from '../../services/supabase';
import { listSavedDecks, subscribeSavedDecks, type SavedDeck } from '../../services/savedDecks';
import { parseDeckText, type DeckEntry } from '../../services/deckCards';
import { ManaIcons } from './ManaIcon';
import ColorFilter from './ColorFilter';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { SelectField, TextField } from '../ui/Field';
import { getCard, isMissing } from '../../services/scryfall';
import { useDeckImages } from './useDeckImages';
import {
  activeFilterCount, allCardNames, cardDataProgress, keywordsInDecks, matchDeck, needsCardData,
  NO_DECK_FILTERS, type DeckFilters,
} from './deckFilters';
import { cx, STICKY_BELOW_TITLE, TEXT_MINI, TEXT_MUTED } from '../ui/styles';
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
  /** Nome carta, parola chiave e testo: si scelgono nel pannello "Filtri". */
  const [filters, setFilters] = useState<DeckFilters>(NO_DECK_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      // Il nome del file può essere lungo quanto vuole: lo accorcio a parole intere,
      // così non arriva mai un nome mazzo fuori dal limite deciso (resta modificabile).
      onImportFile(shortenName(file.name.replace(/\.[^/.]+$/, ''), MAX_DECK_NAME_LENGTH), parsed);
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

  // Parola chiave e testo vengono da Scryfall: le carte si chiedono solo quando servono.
  const deckCards = decks.map((d) => d.cardRows.map((c) => ({ name: c.name, scryfallId: c.scryfallId })));
  const wantCardData = filtersOpen || needsCardData(filters);
  useDeckImages(wantCardData ? deckCards.flat() : []);
  const progress = wantCardData ? cardDataProgress(deckCards, getCard, isMissing) : { ready: 0, total: 0 };
  const loadingCardData = wantCardData && progress.ready < progress.total;

  // Colori: il mazzo deve contenerli tutti quelli selezionati (può averne altri).
  // Gli altri filtri devono valere tutti insieme.
  const matches = new Map(decks.map((d, i) => [d.id, matchDeck(deckCards[i], filters, getCard)]));
  const visibleDecks = decks.filter(
    (d) =>
      [...colorFilter].every((c) => d.colors.includes(c)) && matches.get(d.id)!.ok
  );
  // Colori, nome carta, parola chiave e testo: tutti nel pannello "Filtri".
  const activeCount = activeFilterCount(filters) + (colorFilter.size > 0 ? 1 : 0);
  const filtersActive = activeCount > 0;
  const clearAll = () => { setFilters(NO_DECK_FILTERS); setColorFilter(new Set()); };
  const setFilter = (key: keyof DeckFilters, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));
  const filterChips = ([
    ['card', 'Carta'], ['keyword', 'Parola chiave'], ['text', 'Testo'],
  ] as const).filter(([key]) => filters[key].trim());

  return (
    <>
      <div className="mb-3">
        {loading ? (
          <p className={TEXT_MUTED}>Caricamento…</p>
        ) : decks.length === 0 ? (
          <p className="text-sm text-zaff-muted">Ancora nessun mazzo salvato.</p>
        ) : (
          <>
            {/* Tutti i filtri stanno nel pannello: in cima, fissi mentre si scorre, solo il pulsante
                e i filtri attivi, da togliere con un tocco. */}
            <div className={cx(STICKY_BELOW_TITLE, 'sticky z-10 -mx-1 mb-2 rounded-lg border border-zaff-border bg-zaff-surface p-2.5 shadow-lg')}>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={activeCount ? 'primary' : 'ghost'} onClick={() => setFiltersOpen(true)}>
                  🔍 Filtri{activeCount > 0 && <Badge tone="count" size="xs">{activeCount}</Badge>}
                </Button>
                {colorFilter.size > 0 && (
                  <Button size="sm" variant="link" onClick={() => setColorFilter(new Set())} aria-label="Togli il filtro Colore">
                    {/* Anche a parole: i simboli da soli non dicono che filtro è. */}
                    Colore <ManaIcons colors={[...colorFilter]} className="text-[15px]" /> ✕
                  </Button>
                )}
                {filterChips.map(([key, label]) => (
                  <Button key={key} size="sm" variant="link" onClick={() => setFilter(key, '')}
                    aria-label={`Togli il filtro ${label}: ${filters[key]}`} className="max-w-full">
                    <span className="truncate">{filters[key]}</span> ✕
                  </Button>
                ))}
              </div>
            </div>
            {filtersActive && (
              <p className={cx('mb-2', TEXT_MINI)}>
                {visibleDecks.length} di {decks.length} mazzi
                {needsCardData(filters) && loadingCardData && ` · risultati parziali: carico i dati delle carte (${progress.ready}/${progress.total})`}
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
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-[15px] text-zaff-text">{d.name}</span>
                      <ManaIcons colors={d.colors} className="shrink-0 text-[17px]" />
                    </span>
                    {/* Perché il mazzo è tra i risultati dei filtri. */}
                    {matches.get(d.id)!.notes.length > 0 && (
                      <span className={cx('block truncate', TEXT_MINI)}>{matches.get(d.id)!.notes.join(' · ')}</span>
                    )}
                  </span>
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

      {filtersOpen && (
        <Modal title="Filtra mazzi" onClose={() => setFiltersOpen(false)}>
          <div className="mb-4">
            <ColorFilter colors={colorFilter} onToggle={toggleColorFilter} onClear={() => setColorFilter(new Set())} />
          </div>
          <TextField
            label="Nome carta"
            placeholder="es. Sol Ring"
            value={filters.card}
            onChange={(e) => setFilter('card', e.target.value)}
            suggestions={allCardNames(deckCards)}
            autoComplete="off"
          />
          <SelectField
            label="Parola chiave"
            value={filters.keyword}
            onChange={(e) => setFilter('keyword', e.target.value)}
            hint={loadingCardData ? `Carico i dati delle carte (${progress.ready}/${progress.total})…` : 'Le parole chiave delle carte dei vostri mazzi, come su Scryfall.'}
          >
            <option value="">Qualsiasi</option>
            {keywordsInDecks(deckCards, getCard).map((k) => (
              <option key={k.keyword} value={k.keyword}>{k.keyword} ({k.decks} {k.decks === 1 ? 'mazzo' : 'mazzi'})</option>
            ))}
          </SelectField>
          <TextField
            label="Testo della carta"
            placeholder="es. draw a card"
            value={filters.text}
            onChange={(e) => setFilter('text', e.target.value)}
            hint="In inglese, come su Scryfall: draw, sacrifice, +1/+1 counter…"
            autoComplete="off"
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={clearAll} disabled={activeCount === 0}>Azzera</Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Mostra {visibleDecks.length} {visibleDecks.length === 1 ? 'mazzo' : 'mazzi'}
            </Button>
          </div>
        </Modal>
      )}

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
