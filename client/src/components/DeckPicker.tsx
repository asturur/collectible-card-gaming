import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchDeckList, fetchDeck, extractDeckTypes, filterDecksByType, type DeckListEntry } from '../services/mtgjson';
import { listSavedDecks, getSavedDeck, subscribeSavedDecks, type SavedDeck } from '../services/savedDecks';
import { fromMtgJson, fromSavedDeck, type PlayableDeck } from '../services/playableDeck';
import { isPlayableEntry } from '../services/deckCards';
import Button from './ui/Button';
import CenteredPanel from './ui/Panel';
import { SelectField } from './ui/Field';
import { TEXT_ERROR, TEXT_MINI } from './ui/styles';
import { APP_NAME } from '../appName';

interface DeckPickerProps { onDeckSelected: (deck: PlayableDeck) => void }

export default function DeckPicker({ onDeckSelected }: DeckPickerProps) {
  const { t } = useTranslation();
  const [deckList, setDeckList] = useState<DeckListEntry[]>([]);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [selection, setSelection] = useState<{ kind: 'saved' | 'mtgjson'; id: string } | null>(null);
  const [loadingPremade, setLoadingPremade] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [premadeError, setPremadeError] = useState('');
  const [savedError, setSavedError] = useState('');
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingPremade(true); setPremadeError('');
    fetchDeckList().then(entries => { if (!cancelled) setDeckList(entries); })
      .catch(err => { if (!cancelled) setPremadeError(err.message); })
      .finally(() => { if (!cancelled) setLoadingPremade(false); });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSaved(true);
    async function load() {
      try {
        const decks = await listSavedDecks();
        if (!cancelled) { setSavedDecks(decks); setSavedError(''); }
      } catch (err) { if (!cancelled) setSavedError((err as Error).message); }
      finally { if (!cancelled) setLoadingSaved(false); }
    }
    void load();
    const stop = subscribeSavedDecks(load);
    return () => { cancelled = true; stop(); };
  }, [retry]);

  const chosenSaved = selection?.kind === 'saved' ? savedDecks.find(d => d.id === selection.id) : undefined;
  const missing = chosenSaved?.cardRows.filter(c => !isPlayableEntry(c)) ?? [];
  async function handleConfirm() {
    if (!selection) return;
    setFetching(true); setError('');
    try {
      const deck = selection.kind === 'saved'
        ? fromSavedDeck(await getSavedDeck(selection.id))
        : fromMtgJson(await fetchDeck(selection.id), selection.id);
      onDeckSelected(deck);
    } catch (err) { setError((err as Error).message); }
    finally { setFetching(false); }
  }

  return (
    <CenteredPanel width="lg" title={t('scegli_mazzo')} subtitle={t('mazzi_precostruiti_qualsiasi_mazzo_salvato')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <SelectField id="deck-type" label={t('tipo_di_mazzo_mtgjson')} value={selectedType} disabled={loadingPremade || fetching}
            onChange={e => { setSelectedType(e.target.value); if (selection?.kind === 'mtgjson') setSelection(null); }}>
            <option value="">{loadingPremade ? t('caricamento_della_libreria') : t('scegli_un_tipo_di_mazzo')}</option>
            {extractDeckTypes(deckList).map(type => <option key={type} value={type}>{type}</option>)}
          </SelectField>
          <SelectField id="deck-name" label={t('mazzo_precostruito')} value={selection?.kind === 'mtgjson' ? selection.id : ''}
            disabled={!selectedType || fetching} onChange={e => { setSelection(e.target.value ? { kind: 'mtgjson', id: e.target.value } : null); setError(''); }}>
            <option value="">{t('scegli_un_mazzo')}</option>
            {filterDecksByType(deckList, selectedType).map(deck => <option key={deck.fileName} value={deck.fileName}>{deck.name}</option>)}
          </SelectField>
          {premadeError && <p className={TEXT_ERROR} role="alert">MTGJSON: {premadeError}</p>}
        </div>
        <div>
          <SelectField id="saved-deck" label={t('mazzo_salvato_mtg_tracker')} value={selection?.kind === 'saved' ? selection.id : ''}
            disabled={loadingSaved || fetching} onChange={e => { setSelection(e.target.value ? { kind: 'saved', id: e.target.value } : null); setError(''); }}>
            <option value="">{loadingSaved ? t('caricamento_dei_mazzi_salvati') : t('scegli_un_mazzo_salvato')}</option>
            {savedDecks.map(deck => <option key={deck.id} value={deck.id}>
              {deck.name}{deck.format ? ` · ${deck.format}` : ''}{savedDecks.filter(d => d.name === deck.name).length > 1 ? ` · ${deck.id.slice(-6)}` : ''}
            </option>)}
          </SelectField>
          {!loadingSaved && !savedError && !savedDecks.length && <p className={TEXT_MINI}>{t('ancora_nessun_mazzo_salvato')}</p>}
          {chosenSaved && <p className={TEXT_MINI}>
            {t('carte', { count: chosenSaved.cardRows.reduce((n, c) => n + c.qty, 0) })}
            {missing.length > 0 ? ` · ${t('carte_non_riconosciute_sistemale_in', { count: missing.length })}` : ''}
          </p>}
          {savedError && <p className={TEXT_ERROR} role="alert">{APP_NAME}: {savedError}</p>}
        </div>
      </div>
      {(savedError || premadeError) && <Button variant="ghost" onClick={() => setRetry(n => n + 1)}>{t('riprova_caricare_librerie')}</Button>}
      {error && <p className={TEXT_ERROR} role="alert">{error}</p>}
      <Button onClick={handleConfirm} disabled={!selection || fetching} size="lg" fullWidth>
        {fetching ? t('caricamento_del_mazzo') : t('anteprima_del_mazzo')}
      </Button>
    </CenteredPanel>
  );
}
