import { useEffect, useState } from 'react';
import { supabase, TABLE_DECKS } from '../../services/supabase';

interface DeckListProps {
  onBack: () => void;
}

interface DeckCard {
  name: string;
  qty: number;
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

/** Lista mazzi salvati (sola lettura) + dettaglio. La modifica arriva nello Step 5. */
export default function DeckList({ onBack }: DeckListProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase
      .from(TABLE_DECKS)
      .select('*')
      .order('name')
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError('Non riesco a leggere i mazzi: ' + loadError.message);
        } else {
          setDecks(
            (data ?? []).map((r) => ({
              id: r.id,
              name: r.name,
              cards: r.cards ?? [],
              source: r.source ?? '',
              colors: r.colors ?? [],
              createdBy: r.created_by ?? null,
            }))
          );
        }
        setLoading(false);
      });
  }, []);

  const selectedDeck = decks.find((d) => d.id === selectedId) ?? null;

  if (selectedDeck) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
          <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-zaff-primary">{selectedDeck.name}</h1>
          <p className="mb-6 text-center text-sm text-zaff-muted">
            {sourceLabel(selectedDeck.source) && <span className="mr-2">{sourceLabel(selectedDeck.source)}</span>}
            {deckTotal(selectedDeck)} carte
          </p>

          {selectedDeck.cards.length === 0 ? (
            <p className="text-center text-sm text-zaff-muted">Nessuna carta.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-zaff-border overflow-y-auto">
              {selectedDeck.cards.map((c) => (
                <li key={c.name} className="py-2 text-sm text-zaff-text">
                  {c.qty}× {c.name}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="mt-6 w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
          >
            Torna alla lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-zaff-primary">Mazzi salvati</h1>

        {loading ? (
          <p className="text-center text-zaff-muted">Caricamento…</p>
        ) : decks.length === 0 ? (
          <p className="text-center text-sm text-zaff-muted">Ancora nessun mazzo salvato.</p>
        ) : (
          <ul className="divide-y divide-zaff-border">
            {decks.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-zaff-text" title={d.name}>
                  {d.name}
                  {sourceLabel(d.source) && (
                    <span className="ml-2 rounded-full border border-zaff-border px-2 py-0.5 text-xs text-zaff-muted">
                      {sourceLabel(d.source)}
                    </span>
                  )}
                  <span className="ml-2 text-xs text-zaff-muted">({deckTotal(d)} carte)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className="shrink-0 text-sm text-zaff-primary hover:underline"
                >
                  Visualizza
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-3 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-6 w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          Torna indietro
        </button>
      </div>
    </div>
  );
}
