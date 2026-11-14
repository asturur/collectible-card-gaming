import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import i18n from '../../i18n';
import { MAX_DECK_NAME_LENGTH, shortenName } from '../../services/supabase';
import { listSavedDecks, subscribeSavedDecks, type SavedDeck } from '../../services/savedDecks';
import { parseDeckText, type DeckEntry } from '../../services/deckCards';
import { ManaIcons } from './ManaIcon';
import ColorFilter from './ColorFilter';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { CheckboxListField, TextField } from '../ui/Field';
import FilterTabs from '../ui/FilterTabs';
import { getCard, isMissing } from '../../services/scryfall';
import { useDeckImages } from './useDeckImages';
import {
  activeFilterCount, allCardNames, cardDataProgress, keywordsInDecks, matchDeck, needsCardData,
  NO_DECK_FILTERS, type DeckFilters, type KeywordMode,
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
        setError(i18n.t('nessuna_carta_letta_dal_file'));
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
      setPasteError(i18n.t('nessuna_carta_letta_dal_testo'));
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
      catch (err) { if (!cancelled) setError(i18n.t('non_riesco_leggere_mazzi', { error: (err as Error).message })); }
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
  const setFilter = (key: 'card' | 'text', value: string) => setFilters((prev) => ({ ...prev, [key]: value }));
  const setKeywords = (keywords: string[]) => setFilters((prev) => ({ ...prev, keywords }));
  // Un chip per filtro: nome carta, ogni parola chiave, testo.
  const filterChips = [
    ...(filters.card.trim() ? [{ id: 'card', label: i18n.t('carta'), value: filters.card, clear: () => setFilter('card', '') }] : []),
    ...filters.keywords.map((k) => ({ id: 'kw-' + k, label: i18n.t('parola_chiave'), value: k, clear: () => setKeywords(filters.keywords.filter((x) => x !== k)) })),
    ...(filters.text.trim() ? [{ id: 'text', label: i18n.t('testo'), value: filters.text, clear: () => setFilter('text', '') }] : []),
  ];

  return (
    <>
      <div className="mb-3">
        {loading ? (
          <p className={TEXT_MUTED}>{i18n.t('caricamento')}</p>
        ) : decks.length === 0 ? (
          <p className="text-sm text-zaff-muted">{i18n.t('ancora_nessun_mazzo_salvato')}</p>
        ) : (
          <>
            {/* Tutti i filtri stanno nel pannello: in cima, fissi mentre si scorre, solo il pulsante
                e i filtri attivi, da togliere con un tocco. */}
            <div className={cx(STICKY_BELOW_TITLE, 'sticky z-10 -mx-1 mb-2 rounded-lg border border-zaff-border bg-zaff-surface p-2.5 shadow-lg')}>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={activeCount ? 'primary' : 'ghost'} onClick={() => setFiltersOpen(true)}>
                  {i18n.t('filtri_icona')}{activeCount > 0 && <Badge tone="count" size="xs">{activeCount}</Badge>}
                </Button>
                {colorFilter.size > 0 && (
                  <Button size="sm" variant="link" onClick={() => setColorFilter(new Set())} aria-label={i18n.t('togli_filtro_colore')}>
                    {/* Anche a parole: i simboli da soli non dicono che filtro è. */}
                    {i18n.t('colore')} <ManaIcons colors={[...colorFilter]} className="text-[15px]" /> ✕
                  </Button>
                )}
                {filterChips.map((chip) => (
                  <Button key={chip.id} size="sm" variant="link" onClick={chip.clear}
                    aria-label={i18n.t('togli_filtro', { label: chip.label, value: chip.value })} className="max-w-full">
                    <span className="truncate">{chip.value}</span> ✕
                  </Button>
                ))}
              </div>
            </div>
            {filtersActive && (
              <p className={cx('mb-2', TEXT_MINI)}>
                {i18n.t('mazzi_di_totale', { shown: visibleDecks.length, count: decks.length })}
                {needsCardData(filters) && loadingCardData && ` · ${i18n.t('risultati_parziali', { ready: progress.ready, total: progress.total })}`}
              </p>
            )}
            {visibleDecks.length === 0 && <p className="text-sm text-zaff-muted">{i18n.t('nessun_mazzo_con_questi_filtri')}</p>}
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
        <Modal
          title={i18n.t('filtra_mazzi')}
          onClose={() => setFiltersOpen(false)}
          // "Mostra N mazzi" sempre raggiungibile, anche su schermi bassi.
          footer={(
            <div className="flex gap-2">
              <Button variant="ghost" onClick={clearAll} disabled={activeCount === 0}>{i18n.t('azzera')}</Button>
              <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                {i18n.t('mostra_mazzi', { count: visibleDecks.length })}
              </Button>
            </div>
          )}
        >
          <div className="mb-4">
            <ColorFilter colors={colorFilter} onToggle={toggleColorFilter} onClear={() => setColorFilter(new Set())} />
          </div>
          <TextField
            label={i18n.t('nome_carta')}
            placeholder={i18n.t('es_sol_ring')}
            value={filters.card}
            onChange={(e) => setFilter('card', e.target.value)}
            suggestions={allCardNames(deckCards)}
            autoComplete="off"
          />
          <CheckboxListField
            legend={filters.keywords.length ? i18n.t('parole_chiave_scelte', { count: filters.keywords.length }) : i18n.t('parole_chiave')}
            searchLabel={i18n.t('cerca_parola_chiave')}
            values={filters.keywords}
            onChange={setKeywords}
            options={keywordsInDecks(deckCards, getCard).map((k) => ({
              value: k.keyword, label: k.keyword, hint: `(${i18n.t('mazzi_count', { count: k.decks })})`,
            }))}
            hint={loadingCardData ? i18n.t('carico_dati_delle_carte', { ready: progress.ready, total: progress.total }) : i18n.t('parole_chiave_delle_carte_dei')}
            className="mb-2"
          />
          {/* Con più parole chiave si sceglie come combinarle. */}
          {filters.keywords.length > 1 && (
            <FilterTabs
              className="mb-4"
              value={filters.keywordMode}
              onChange={(v) => setFilters((prev) => ({ ...prev, keywordMode: v as KeywordMode }))}
              options={[{ value: 'all', label: i18n.t('tutte') }, { value: 'any', label: i18n.t('almeno_una') }]}
            />
          )}
          <TextField
            label={i18n.t('testo_della_carta')}
            placeholder={i18n.t('es_draw_card')}
            value={filters.text}
            onChange={(e) => setFilter('text', e.target.value)}
            hint={i18n.t('in_inglese_come_su_scryfall')}
            autoComplete="off"
          />
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
          {i18n.t('crea_nuovo_mazzo_piu')}
        </Button>
      </div>

      {createOpen && (
        <Modal level={2} title={i18n.t('crea_nuovo_mazzo')} subtitle={i18n.t('come_vuoi_iniziare')} onClose={() => setCreateOpen(false)}>
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
              {i18n.t('inserimento_manuale')}
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
              {i18n.t('importa_file_manabox')}
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
              {i18n.t('incolla_elenco_da_testo_icona')}
            </Button>
          </div>
        </Modal>
      )}

      {pasteOpen && (
        <Modal
          level={2}
          title={i18n.t('incolla_elenco_da_testo')}
          onClose={() => {
            setPasteOpen(false);
            setPasteText('');
          }}
        >
          <p className={cx('mb-2', TEXT_MINI)}>
            {i18n.t('incolla_qui_elenco_copiato_da')}
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
              {i18n.t('importa')}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => {
                setPasteOpen(false);
                setPasteText('');
              }}
            >
              {i18n.t('annulla')}
            </Button>
          </div>
        </Modal>
      )}

    </>
  );
}
