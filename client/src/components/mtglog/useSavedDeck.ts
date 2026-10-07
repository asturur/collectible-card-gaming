import { useEffect, useState } from 'react';
import { getSavedDeck, subscribeSavedDecks, type SavedDeck } from '../../services/savedDecks';

interface DeckSnapshot {
  id: string;
  deck: SavedDeck | null;
  loading: boolean;
  error: string;
}

/** Shared lifecycle for read-only saved-deck pages; editors keep their revision baseline. */
export function useSavedDeck(deckId: string) {
  const [snapshot, setSnapshot] = useState<DeckSnapshot>({ id: deckId, deck: null, loading: true, error: '' });
  useEffect(() => {
    let active = true;
    let request = 0;
    setSnapshot({ id: deckId, deck: null, loading: true, error: '' });
    async function load() {
      const current = ++request;
      try {
        const deck = await getSavedDeck(deckId);
        if (active && current === request) setSnapshot({ id: deckId, deck, loading: false, error: '' });
      } catch (err) {
        if (active && current === request) setSnapshot({
          id: deckId, deck: null, loading: false,
          error: 'Non riesco a leggere il mazzo: ' + (err as Error).message,
        });
      }
    }
    void load();
    const unsubscribe = subscribeSavedDecks(load);
    return () => { active = false; unsubscribe(); };
  }, [deckId]);
  // A changed URL must never briefly show the previous deck while its effect starts.
  return snapshot.id === deckId ? snapshot : { deck: null, loading: true, error: '' };
}
