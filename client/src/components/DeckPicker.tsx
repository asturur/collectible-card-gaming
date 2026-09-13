import { useState, useEffect } from 'react';
import {
  fetchDeckList,
  fetchDeck,
  extractDeckTypes,
  filterDecksByType,
  type DeckListEntry,
  type MtgJsonDeck,
} from '../services/mtgjson';

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
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h2 className="mb-2 text-center text-3xl font-bold tracking-tight text-zaff-primary">
          Choose a Deck
        </h2>
        <p className="mb-8 text-center text-zaff-muted">
          Browse premade decks from MTGJSON
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
            {error}
          </div>
        )}

        {/* Deck Type dropdown */}
        <label
          htmlFor="deck-type"
          className="mb-2 block text-sm font-medium text-zaff-text"
        >
          Deck Type
        </label>
        <select
          id="deck-type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="mb-6 w-full rounded-lg border border-zaff-border bg-zaff-bg px-4 py-3 text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
        >
          <option value="">Select a deck type...</option>
          {deckTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* Deck Name dropdown (visible only when type is selected) */}
        {selectedType && (
          <>
            <label
              htmlFor="deck-name"
              className="mb-2 block text-sm font-medium text-zaff-text"
            >
              Deck Name
            </label>
            <select
              id="deck-name"
              value={selectedFileName}
              onChange={(e) => setSelectedFileName(e.target.value)}
              className="mb-6 w-full rounded-lg border border-zaff-border bg-zaff-bg px-4 py-3 text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
            >
              <option value="">Select a deck...</option>
              {filteredDecks.map((deck) => (
                <option key={deck.fileName} value={deck.fileName}>
                  {deck.name}
                </option>
              ))}
            </select>
          </>
        )}

        {/* OK button */}
        <button
          onClick={handleConfirm}
          disabled={!selectedFileName || fetching}
          className="w-full rounded-lg bg-zaff-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-zaff-primary-hover focus:outline-none focus:ring-2 focus:ring-zaff-primary focus:ring-offset-2 focus:ring-offset-zaff-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fetching ? 'Loading deck...' : 'OK'}
        </button>
      </div>
    </div>
  );
}
