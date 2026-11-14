import { useEffect, useRef, useState } from 'react';
import i18n from '../../i18n';
import { canEdit, MAX_DECK_NAME_LENGTH, shortenName } from '../../services/supabase';
import CharCount from '../ui/CharCount';
import { saveSavedDeck, getSavedDeck, findDeckWithSameName, DeckConflictError, UnresolvedCardsError } from '../../services/savedDecks';
import { autocompleteCards } from '../../services/scryfall';
import type { DeckEntry } from '../../services/deckCards';
import { ManaPips } from './ManaIcon';
import CardPicker from './CardPicker';
import DeckCardsView, { useDeckImages } from './DeckCards';
import { DeckStatsButton } from './DeckStats';
import { sectionTone } from './DeckDetailActions';
import { useSectionInView } from './useSectionInView';
import Button from '../ui/Button';
import { TextField, SelectField } from '../ui/Field';
import { cx, FIELD_CONTROL_SM, FIELD_LABEL, TEXT_MINI, TEXT_MUTED } from '../ui/styles';

interface DeckEditorProps {
  deckId: string | null;
  userId?: string;
  initialDraft?: { name: string; cards: DraftCard[] } | null;
  onBack: () => void;
  onSaved: (id: string) => void;
  onLoaded?: (name: string) => void;
  onPersistingChange?: (busy: boolean) => void;
}

/** `section` distingue il main deck dalla riserva (sideboard): le carte
 *  importate o salvate prima di questa distinzione non hanno il campo e
 *  vengono trattate come main deck (vedi `normalizeSection`). */
type DraftCard = DeckEntry;

function normalizeSection(raw: unknown): 'main' | 'side' {
  return raw === 'side' ? 'side' : 'main';
}

interface PreconCardEntry {
  name: string;
  count?: number;
}

interface PreconDeck {
  name: string;
  set_name?: string;
  type?: string;
  category?: string;
  commander?: PreconCardEntry[];
  cards?: PreconCardEntry[];
}

const PRECON_CACHE_KEY = 'mtg:precon-cache';
const PRECON_URL = 'https://raw.githubusercontent.com/taw/magic-preconstructed-decks-data/master/decks_v2.json';

const BASIC_LAND_COLOR: Record<string, string> = {
  plains: 'W',
  island: 'U',
  swamp: 'B',
  mountain: 'R',
  forest: 'G',
};

/** Rileva i colori delle terre base presenti nei nomi carta (es. "Snow-Covered Swamp"). */
function detectLandColors(cardNames: string[]): Set<string> {
  const found = new Set<string>();
  cardNames.forEach((name) => {
    const low = name.toLowerCase();
    Object.keys(BASIC_LAND_COLOR).forEach((land) => {
      if (low.includes(land)) found.add(BASIC_LAND_COLOR[land]);
    });
  });
  return found;
}

/** Creazione/modifica manuale di un mazzo, con autocomplete carte (Scryfall),
 *  rilevamento automatico dei colori dalle terre base, e import (file ManaBox
 *  passato come `initialDraft`, o mazzo precon Commander cercato qui).
 *  La pagina gestisce titolo e navigazione; i selettori carte restano dialoghi. */
/** Parti del mazzo che contano per accorgersi di una modifica altrui. */
/** Formati selezionabili per un mazzo (usati anche dal filtro nella lista mazzi). */
export const DECK_FORMATS = ['Commander', 'Standard', 'Modern', 'Pauper', 'Altro'];

export default function DeckEditor({ deckId, userId, initialDraft, onBack, onSaved, onLoaded, onPersistingChange }: DeckEditorProps) {
  const [name, setName] = useState(initialDraft?.name ?? '');
  const [source, setSource] = useState('');
  const [format, setFormat] = useState('');
  const [colors, setColors] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<DraftCard[]>(
    (initialDraft?.cards ?? []).map((c) => ({ ...c, section: normalizeSection(c.section) }))
  );
  const [cardSearch, setCardSearch] = useState('');
  const [pickedCardName, setPickedCardName] = useState('');
  /** Copie da aggiungere, come scritte nel campo: può restare vuoto mentre si corregge (vuoto = 1). */
  const [qty, setQty] = useState('1');
  const [cardSection, setCardSection] = useState<'main' | 'side'>('main');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  /** Selettore carte con immagini: aggiungere, oppure correggere (`replace`)
   *  una carta non riconosciuta da Scryfall. */
  const [picker, setPicker] = useState<
    null | { mode: 'add' } | { mode: 'replace'; name: string; section: 'main' | 'side'; qty: number }
  >(null);
  const [loading, setLoading] = useState(Boolean(deckId));
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState('');
  const [unresolved, setUnresolved] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const saveAbort = useRef<AbortController | null>(null);
  const newId = useRef('m' + Date.now() + Math.random().toString(36).slice(2, 9));

  const [preconOpen, setPreconOpen] = useState(false);
  const [preconData, setPreconData] = useState<PreconDeck[] | null>(null);
  const [preconStatus, setPreconStatus] = useState('');
  const [preconSearch, setPreconSearch] = useState('');

  useDeckImages(draft);

  const openedRevision = useRef<number | null>(null);
  useEffect(() => () => { saveAbort.current?.abort(); }, []);

  useEffect(() => {
    let cancelled = false;
    if (!deckId) {
      setLoading(false);
      if (initialDraft?.cards.length) autoDetectColors(initialDraft.cards.map(c => c.name));
      return;
    }
    getSavedDeck(deckId).then(deck => {
      if (cancelled) return;
      if (userId && !canEdit(deck.createdBy, userId)) throw new Error(i18n.t('puoi_modificare_solo_mazzi_che'));
      openedRevision.current = deck.revision;
      setName(deck.name); setSource(deck.source); setFormat(deck.format);
      setColors(new Set(deck.colors)); setDraft(deck.cards);
      onLoaded?.(deck.name);
    }).catch(err => {
      if (!cancelled) {
        setLoadFailed(true);
        setError(i18n.t('non_riesco_leggere_mazzo', { error: err.message }));
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, userId]);

  useEffect(() => {
    const q = cardSearch.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try { const names = await autocompleteCards(q); if (!cancelled) setSuggestions(names); }
      catch { if (!cancelled) setSuggestions([]); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cardSearch]);

  function autoDetectColors(cardNames: string[]) {
    const found = detectLandColors(cardNames);
    if (found.size === 0) return;
    setColors((prev) => new Set([...prev, ...found]));
  }

  async function loadPreconData(): Promise<PreconDeck[] | null> {
    if (preconData) return preconData;
    setPreconStatus(i18n.t('carico_elenco_dei_mazzi_precon'));
    try {
      const cached = localStorage.getItem(PRECON_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as PreconDeck[];
        setPreconData(parsed);
        setPreconStatus('');
        return parsed;
      }
    } catch {
      // ignore cache errors, fall through to fetch
    }
    try {
      const res = await fetch(PRECON_URL);
      const all = (await res.json()) as PreconDeck[];
      const filtered = all.filter(
        (d) =>
          (d.type ?? '').toLowerCase().includes('commander') ||
          (d.category ?? '').toLowerCase().includes('commander') ||
          (d.commander?.length ?? 0) > 0
      );
      try {
        localStorage.setItem(PRECON_CACHE_KEY, JSON.stringify(filtered));
      } catch {
        // localStorage full or unavailable: skip caching
      }
      setPreconData(filtered);
      setPreconStatus('');
      return filtered;
    } catch {
      setPreconStatus(i18n.t('non_sono_riuscito_scaricare_precon'));
      return null;
    }
  }

  async function togglePreconBox() {
    const opening = !preconOpen;
    setPreconOpen(opening);
    if (opening && !preconData) await loadPreconData();
  }

  const preconMatches = (() => {
    const q = preconSearch.trim().toLowerCase();
    if (!preconData || q.length < 2) return [];
    return preconData
      .filter((d) => d.name.toLowerCase().includes(q) || (d.set_name ?? '').toLowerCase().includes(q))
      .slice(0, 25);
  })();

  function importPrecon(deck: PreconDeck) {
    const merged: Record<string, DraftCard> = {};
    const addAll = (list: PreconCardEntry[] | undefined) =>
      (list ?? []).forEach((c) => {
        const key = c.name.toLowerCase();
        merged[key] = merged[key] ?? { name: c.name, qty: 0, section: 'main' };
        merged[key].qty += c.count ?? 1;
      });
    addAll(deck.commander);
    addAll(deck.cards);
    const newDraft = Object.values(merged);
    setDraft(newDraft);
    setName(shortenName(deck.name, MAX_DECK_NAME_LENGTH));
    setSource('precon');
    setColors(new Set());
    autoDetectColors(newDraft.map((c) => c.name));
    setPreconOpen(false);
    setPreconSearch('');
  }

  function toggleColor(c: string) {
    setColors((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function addToDraft(cardName: string, addQty: number, section: 'main' | 'side') {
    setDraft((prev) => {
      const idx = prev.findIndex(
        (c) => c.name.toLowerCase() === cardName.toLowerCase() && normalizeSection(c.section) === section
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + addQty };
        return next;
      }
      return [...prev, { name: cardName, qty: addQty, section }];
    });
    autoDetectColors([cardName]);
  }

  /** Sostituisce una carta non riconosciuta con quella scelta nel selettore
   *  (tenendo sezione e copie; se la carta c'è già, le copie si sommano). */
  function replaceInDraft(oldName: string, section: 'main' | 'side', oldQty: number, newName: string) {
    setDraft((prev) => {
      const without = prev.filter((c) => !(c.name === oldName && normalizeSection(c.section) === section));
      const idx = without.findIndex(
        (c) => c.name.toLowerCase() === newName.toLowerCase() && normalizeSection(c.section) === section
      );
      if (idx >= 0) {
        const next = [...without];
        next[idx] = { ...next[idx], qty: next[idx].qty + oldQty };
        return next;
      }
      return [...without, { name: newName, qty: oldQty, section }];
    });
    autoDetectColors([newName]);
  }

  /** ⇄: una copia passa nell'altra sezione con la stessa stampa; se lì c'è già, le copie si sommano. */
  function moveOne(card: { name: string; section?: string }) {
    const from = normalizeSection(card.section);
    const to = from === 'main' ? 'side' : 'main';
    setDraft((prev) => {
      const source = prev.find((c) => c.name === card.name && normalizeSection(c.section) === from);
      if (!source) return prev;
      const next = prev.flatMap((c) => (c !== source ? [c] : c.qty > 1 ? [{ ...c, qty: c.qty - 1 }] : []));
      const idx = next.findIndex((c) => c.name.toLowerCase() === card.name.toLowerCase() && normalizeSection(c.section) === to);
      if (idx >= 0) {
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      const { id: _rowId, ...printing } = source;
      return [...next, { ...printing, qty: 1, section: to }];
    });
  }

  /** −/+ sulle carte dell'elenco; a 1 copia il "−" toglie la carta. */
  function changeQty(card: { name: string; section?: string }, delta: number) {
    const sec = normalizeSection(card.section);
    setDraft((prev) =>
      prev.flatMap((c) => {
        if (c.name !== card.name || normalizeSection(c.section) !== sec) return [c];
        const q = c.qty + delta;
        return q <= 0 ? [] : [{ ...c, qty: q }];
      })
    );
  }

  function countInDraft(cardName: string): number {
    const low = cardName.toLowerCase();
    return draft.filter((c) => c.name.toLowerCase() === low).reduce((sum, c) => sum + c.qty, 0);
  }

  function handleAddCard() {
    const cardName = pickedCardName || cardSearch.trim();
    if (!cardName) return;
    const addQty = Math.min(99, Math.max(1, parseInt(qty, 10) || 1));
    addToDraft(cardName, addQty, cardSection);
    setCardSearch('');
    setQty('1');
    setPickedCardName('');
    setSuggestions([]);
  }

  function handleRemoveCard(cardName: string, section: 'main' | 'side') {
    setDraft((prev) => prev.filter((c) => !(c.name === cardName && normalizeSection(c.section) === section)));
  }

  async function handleSave(allowUnresolved = false) {
    const trimmedName = name.trim();
    setError(''); setUnresolved(false);
    if (!trimmedName) { setError(i18n.t('dai_un_nome_al_mazzo')); return; }
    if (trimmedName.length > MAX_DECK_NAME_LENGTH) {
      setError(i18n.t('nome_del_mazzo_troppo_lungo', { length: trimmedName.length, max: MAX_DECK_NAME_LENGTH }));
      return;
    }
    if (!draft.length) { setError(i18n.t('aggiungi_almeno_una_carta_al')); return; }
    if (deckId && openedRevision.current === null) { setError(i18n.t('riapri_mazzo_prima_di_salvarlo')); return; }
    const controller = new AbortController();
    saveAbort.current = controller;
    setSaving(true);
    let didPersist = false;
    const persist = () => {
      didPersist = true;
      setPersisting(true); onPersistingChange?.(true);
    };
    try {
      const input = { id: deckId ?? newId.current, name: trimmedName, source, format,
        colors: [...colors], cards: draft, expectedRevision: openedRevision.current };
      const sameNameDeck = await findDeckWithSameName(trimmedName, input.id);
      if (controller.signal.aborted) return;
      if (sameNameDeck) {
        setError(i18n.t('esiste_gia_un_mazzo_chiamato', { name: sameNameDeck }));
        return;
      }
      try {
        await saveSavedDeck(input, { allowUnresolved, signal: controller.signal, onPersisting: persist });
      } catch (err) {
        if (!(err instanceof DeckConflictError)) throw err;
        didPersist = false;
        setPersisting(false); onPersistingChange?.(false);
        const current = await getSavedDeck(input.id);
        controller.signal.throwIfAborted();
        if (!window.confirm(i18n.t('qualcun_altro_ha_modificato_mazzo'))) {
          setError(err.message); return;
        }
        await saveSavedDeck({ ...input, expectedRevision: current.revision }, {
          allowUnresolved, signal: controller.signal, onPersisting: persist,
        });
      }
      onSaved(input.id);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(i18n.t('salvataggio_mazzo_non_riuscito', { error: err instanceof Error ? err.message : String((err as { message?: string }).message ?? err) }));
        setUnresolved(err instanceof UnresolvedCardsError);
      }
    } finally {
      setSaving(false); setPersisting(false);
      if (didPersist) onPersistingChange?.(false);
      saveAbort.current = null;
    }
  }

  const total = draft.reduce((sum, c) => sum + c.qty, 0);

  // Come nella pagina del mazzo: scorrendo le carte si accende Main Deck o Sideboard.
  const section = useSectionInView(!loading && !loadFailed, draft);

  if (loading) {
    return <p className={TEXT_MUTED}>{i18n.t('caricamento')}</p>;
  }
  if (loadFailed) return <p role="alert" className="text-sm text-red-400">{error}</p>;

  const mainTotal = draft.filter((c) => normalizeSection(c.section) === 'main').reduce((sum, c) => sum + c.qty, 0);
  const sideTotal = total - mainTotal;

  return (
    <>
      {/* min-w-0: un fieldset per natura non si stringe sotto il suo contenuto più largo, quindi un
          nome di carta lungo (vista Lista) allargava tutto l'editor oltre lo schermo. */}
      <fieldset disabled={saving} className="min-w-0">
      {/* Totali sempre in vista mentre si scorre. */}
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-1 mb-3.5 rounded-lg border border-zaff-primary bg-zaff-surface px-3 py-2 text-sm font-semibold text-zaff-text shadow-lg">
        <p className="mb-1 truncate text-base font-bold" title={name.trim() || i18n.t('nuovo_mazzo')}>
          {name.trim() || i18n.t('nuovo_mazzo')}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span aria-current={section === 'main' ? 'true' : undefined} className={sectionTone(section, 'main')}>Main Deck {mainTotal}</span>
          <span aria-current={section === 'side' ? 'true' : undefined} className={sectionTone(section, 'side')}>Sideboard {sideTotal}</span>
          <span className="bg-gradient-to-r from-zaff-primary to-zaff-accent bg-clip-text text-lg font-bold text-transparent">
            {i18n.t('totale_n', { n: total })}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <DeckStatsButton cards={draft} deckName={name} />
      </div>

      <TextField
        id="deckName"
        label={i18n.t('nome_mazzo')}
        density="compact"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={i18n.t('es_mono_nero_aggro')}
        maxLength={MAX_DECK_NAME_LENGTH}
        hint={<CharCount value={name} max={MAX_DECK_NAME_LENGTH} />}
      />

      <SelectField
        id="deckFormat"
        label={i18n.t('formato')}
        density="compact"
        value={format}
        onChange={(e) => setFormat(e.target.value)}
      >
        <option value="">{i18n.t('non_specificato')}</option>
        {DECK_FORMATS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="deckSource"
        label={i18n.t('origine_mazzo')}
        density="compact"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      >
        <option value="">{i18n.t('non_specificato')}</option>
        <option value="brew">{i18n.t('homebrew_fatto_in_casa')}</option>
        <option value="precon">{i18n.t('precon_di_fabbrica')}</option>
      </SelectField>

      <div className="mb-4">
        <span className={FIELD_LABEL}>{i18n.t('colori_del_mazzo')}</span>
        <ManaPips colors={colors} onToggle={toggleColor} />
        <p className={cx('mt-1.5', TEXT_MINI)}>
          {i18n.t('si_accendono_da_soli_quando')}
        </p>
      </div>

      <Button variant="link" size="sm" onClick={togglePreconBox}>
        {i18n.t('importa_un_mazzo_precon_commander')}
      </Button>

      {preconOpen && (
        <div className="mb-3.5 mt-0.5 rounded-lg border border-zaff-border bg-zaff-bg p-3">
          <input
            type="text"
            value={preconSearch}
            onChange={(e) => setPreconSearch(e.target.value)}
            autoComplete="off"
            placeholder={i18n.t('cerca_nome_del_precon_es')}
            className={FIELD_CONTROL_SM}
          />
          {preconStatus && <p className={cx('mt-1.5', TEXT_MINI)}>{preconStatus}</p>}
          {preconMatches.length > 0 && (
            <div className="mt-2 max-h-[260px] overflow-y-auto">
              {preconMatches.map((d) => (
                <button
                  key={d.name + (d.set_name ?? '')}
                  type="button"
                  onClick={() => importPrecon(d)}
                  className="flex w-full items-baseline justify-between gap-2.5 border-b border-zaff-border px-1 py-1.5 text-left text-sm text-zaff-text transition last:border-b-0 hover:bg-zaff-surface"
                >
                  <span className="min-w-0 truncate">{d.name}</span>
                  <small className="shrink-0 whitespace-nowrap text-xs text-zaff-muted">{d.set_name ?? ''}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3.5">
        <Button variant="ghost" size="lg" fullWidth className="py-3" onClick={() => setPicker({ mode: 'add' })}>
          {i18n.t('cerca_carte_con_immagini')}
        </Button>
      </div>

      <div className="relative mt-3.5">
        <label className={FIELD_LABEL} htmlFor="cardSearch">
          {i18n.t('cerca_carta')}
        </label>
        <input
          id="cardSearch"
          type="text"
          value={cardSearch}
          onChange={(e) => {
            setCardSearch(e.target.value);
            setPickedCardName('');
          }}
          autoComplete="off"
          placeholder={i18n.t('scrivi_nome_della_carta')}
          className={FIELD_CONTROL_SM}
        />
        {suggestions.length > 0 && (
          <div className="absolute inset-x-0 top-full z-10 max-h-[220px] overflow-y-auto rounded-lg border border-zaff-border bg-zaff-surface">
            {suggestions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setCardSearch(n);
                  setPickedCardName(n);
                  setSuggestions([]);
                }}
                className="block w-full px-2.5 py-1.5 text-left text-sm text-zaff-text transition hover:bg-zaff-bg"
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3.5">
        <span className={FIELD_LABEL}>{i18n.t('aggiungi_a')}</span>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant={cardSection === 'main' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setCardSection('main')}
          >
            Main Deck
          </Button>
          <Button
            type="button"
            variant={cardSection === 'side' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setCardSection('side')}
          >
            Sideboard
          </Button>
        </div>
      </div>

      <div className="mb-2.5 mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <TextField
          id="cardQty"
          label={i18n.t('copie')}
          density="compact"
          type="number"
          min={1}
          max={99}
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onFocus={(e) => e.target.select()}
          onBlur={() => { if (!qty) setQty('1'); }}
          fieldClassName="mb-0"
        />
        <Button variant="ghost" onClick={handleAddCard}>
          {i18n.t('aggiungi_al_mazzo')}
        </Button>
      </div>

      {draft.length === 0 ? (
        <p className={cx('mb-2.5', TEXT_MINI)}>{i18n.t('nessuna_carta_ancora_aggiunta')}</p>
      ) : (
        <div className="mb-2.5">
          <DeckCardsView
            cards={draft}
            editable={{
              onChangeQty: changeQty,
              onMove: moveOne,
              onFix: (c) =>
                setPicker({ mode: 'replace', name: c.name, section: normalizeSection(c.section), qty: c.qty }),
            }}
          />
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <p className={cx('mt-2.5', TEXT_MINI)}>
        {i18n.t('nomi_delle_carte_arrivano_da')}{' '}
        <a href="https://scryfall.com" target="_blank" rel="noopener" className="underline hover:text-zaff-gold">
          Scryfall
        </a>
        {i18n.t('mazzi_precon_da_un_archivio')}
      </p>

      </fieldset>
      {unresolved && !saving && (
        <Button variant="ghost" fullWidth onClick={() => handleSave(true)}>
          {i18n.t('salva_solo_per_mtg_tracker')}
        </Button>
      )}
      {/* Barra sempre in vista in fondo allo schermo: salvare senza scorrere. */}
      {/* Sta sopra la barra di navigazione fissa (alta 4rem più la zona sicura). */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 grid grid-cols-2 gap-2.5 border-t border-zaff-border bg-zaff-surface px-4 py-3 sm:-mx-6 sm:px-6">
        <Button size="lg" fullWidth onClick={() => handleSave()} disabled={saving}>
          {saving ? (persisting ? i18n.t('salvataggio') : i18n.t('verifico_carte')) : deckId ? i18n.t('salva_modifiche') : i18n.t('salva_mazzo')}
        </Button>
        <Button size="lg" fullWidth variant="ghost" disabled={persisting} onClick={onBack}>
          {i18n.t('annulla')}
        </Button>
      </div>
      {picker && !saving && (
        <CardPicker
          mode={picker.mode}
          initialQuery={picker.mode === 'replace' ? picker.name : ''}
          section={cardSection}
          onSectionChange={setCardSection}
          countOf={countInDraft}
          totals={{ main: mainTotal, side: sideTotal }}
          onPick={(card) => {
            if (picker.mode === 'add') addToDraft(card.name, 1, cardSection);
            else replaceInDraft(picker.name, picker.section, picker.qty, card.name);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}
