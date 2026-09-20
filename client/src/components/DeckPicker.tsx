import { useState, useEffect } from 'react';
import {
  fetchDeckList,
  fetchDeck,
  extractDeckTypes,
  filterDecksByType,
  type DeckListEntry,
  type MtgJsonDeck,
} from '../services/mtgjson';
import Button from './ui/Button';
import CenteredPanel from './ui/Panel';
import { SelectField } from './ui/Field';
import { TEXT_ERROR } from './ui/styles';

interface DeckPickerProps {
  onDeckSelected: (deck: MtgJsonDeck) => void;
}

export default function DeckPicker({ onDeckSelected }: DeckPickerProps) {
  const [deckList, setDeckList] = useState<DeckListEntry[] | null>(null);
  const [deckTypes, setDeckTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [filteredDecks, setFilteredDecks] = useState<DeckListEntry[]>([]);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch deck list index on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDeckList()
      .then((entries) => {
        if (cancelled) return;
        setDeckList(entries);
        setDeckTypes(extractDeckTypes(entries));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load deck list');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Update filtered decks when type changes
  useEffect(() => {
    if (!deckList || !selectedType) {
      setFilteredDecks([]);
      setSelectedFileName('');
      return;
    }
    setFilteredDecks(filterDecksByType(deckList, selectedType));
    setSelectedFileName('');
  }, [deckList, selectedType]);

  async function handleConfirm() {
    if (!selectedFileName) return;
    setFetching(true);
    setError(null);

    try {
      const deck = await fetchDeck(selectedFileName);
      onDeckSelected(deck);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deck');
    } finally {
      setFetching(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
        <div className="text-center">
          <div className="mb-4 text-lg text-zaff-muted">Loading deck library...</div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-zaff-border border-t-zaff-primary" />
        </div>
      </div>
    );
  }

  return (
    <CenteredPanel title="Choose a Deck" subtitle="Browse premade decks from MTGJSON">
      {error && (
        <div className={`mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 ${TEXT_ERROR}`} role="alert">
          {error}
        </div>
      )}

      <SelectField
        id="deck-type"
        label="Deck Type"
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
      >
        <option value="">Select a deck type...</option>
        {deckTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </SelectField>

      {selectedType && (
        <SelectField
          id="deck-name"
          label="Deck Name"
          value={selectedFileName}
          onChange={(e) => setSelectedFileName(e.target.value)}
        >
          <option value="">Select a deck...</option>
          {filteredDecks.map((deck) => (
            <option key={deck.fileName} value={deck.fileName}>
              {deck.name}
            </option>
          ))}
        </SelectField>
      )}

      <Button onClick={handleConfirm} disabled={!selectedFileName || fetching} size="lg" fullWidth>
        {fetching ? 'Loading deck...' : 'OK'}
      </Button>
    </CenteredPanel>
  );
}
