import { useState, useEffect } from 'react';
import { fetchDeckList, fetchDeck, extractDeckTypes, filterDecksByType, type DeckListEntry } from '../services/mtgjson';
import { listSavedDecks, getSavedDeck, subscribeSavedDecks, type SavedDeck } from '../services/savedDecks';
import { fromMtgJson, fromSavedDeck, type PlayableDeck } from '../services/playableDeck';
import { isPlayableEntry } from '../services/deckCards';
import Button from './ui/Button';
import CenteredPanel from './ui/Panel';
import { SelectField } from './ui/Field';
import { TEXT_ERROR, TEXT_MINI } from './ui/styles';

interface DeckPickerProps { onDeckSelected: (deck: PlayableDeck) => void }

export default function DeckPicker({ onDeckSelected }: DeckPickerProps) {
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
    <CenteredPanel width="lg" title="Choose a Deck" subtitle="Premade decks or any deck saved in Registro">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <SelectField id="deck-type" label="MTGJSON deck type" value={selectedType} disabled={loadingPremade || fetching}
            onChange={e => { setSelectedType(e.target.value); if (selection?.kind === 'mtgjson') setSelection(null); }}>
            <option value="">{loadingPremade ? 'Loading library…' : 'Select a deck type…'}</option>
            {extractDeckTypes(deckList).map(type => <option key={type} value={type}>{type}</option>)}
          </SelectField>
          <SelectField id="deck-name" label="Premade deck" value={selection?.kind === 'mtgjson' ? selection.id : ''}
            disabled={!selectedType || fetching} onChange={e => { setSelection(e.target.value ? { kind: 'mtgjson', id: e.target.value } : null); setError(''); }}>
            <option value="">Select a deck…</option>
            {filterDecksByType(deckList, selectedType).map(deck => <option key={deck.fileName} value={deck.fileName}>{deck.name}</option>)}
          </SelectField>
          {premadeError && <p className={TEXT_ERROR} role="alert">MTGJSON: {premadeError}</p>}
        </div>
        <div>
          <SelectField id="saved-deck" label="Saved deck (Registro)" value={selection?.kind === 'saved' ? selection.id : ''}
            disabled={loadingSaved || fetching} onChange={e => { setSelection(e.target.value ? { kind: 'saved', id: e.target.value } : null); setError(''); }}>
            <option value="">{loadingSaved ? 'Loading saved decks…' : 'Select a saved deck…'}</option>
            {savedDecks.map(deck => <option key={deck.id} value={deck.id}>
              {deck.name}{deck.format ? ` · ${deck.format}` : ''}{savedDecks.filter(d => d.name === deck.name).length > 1 ? ` · ${deck.id.slice(-6)}` : ''}
            </option>)}
          </SelectField>
          {!loadingSaved && !savedError && !savedDecks.length && <p className={TEXT_MINI}>No saved decks yet.</p>}
          {chosenSaved && <p className={TEXT_MINI}>
            {chosenSaved.cardRows.reduce((n, c) => n + c.qty, 0)} cards
            {missing.length > 0 ? ` · ${missing.length} unresolved groups; fix them in Registro before playing.` : ''}
          </p>}
          {savedError && <p className={TEXT_ERROR} role="alert">Registro: {savedError}</p>}
        </div>
      </div>
      {(savedError || premadeError) && <Button variant="ghost" onClick={() => setRetry(n => n + 1)}>Retry libraries</Button>}
      {error && <p className={TEXT_ERROR} role="alert">{error}</p>}
      <Button onClick={handleConfirm} disabled={!selection || fetching} size="lg" fullWidth>
        {fetching ? 'Loading deck…' : 'Preview Deck'}
      </Button>
    </CenteredPanel>
  );
}
