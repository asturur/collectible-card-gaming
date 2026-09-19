import { useEffect, useState } from 'react';
import { canEdit, supabase, TABLE_DECKS } from '../../services/supabase';

interface DeckListProps {
  userId: string;
  onBack: () => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
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

/** Lista mazzi salvati + dettaglio, con creazione/modifica/cancellazione (Step 5). */
export default function DeckList({ userId, onBack, onCreate, onEdit }: DeckListProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function loadDecks() {
    if (!supabase) return;
    const { data, error: loadError } = await supabase.from(TABLE_DECKS).select('*').order('name');
    if (loadError) {
      setError('Non riesco a leggere i mazzi: ' + loadError.message);
      return;
    }
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

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    loadDecks().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: string) {
    if (!supabase) return;
    if (!confirm('Cancellare questo mazzo? Le partite che lo usano già continueranno a mostrarne solo il nome.')) return;
    const { error: deleteError } = await supabase.from(TABLE_DECKS).delete().eq('id', id);
    if (deleteError) {
      setError('Cancellazione mazzo non riuscita: ' + deleteError.message);
      return;
    }
    await loadDecks();
  }

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
        <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-zaff-primary">Mazzi salvati</h1>

        <button
          type="button"
          onClick={onCreate}
          className="mb-4 w-full rounded-lg border border-zaff-border px-4 py-2 text-sm font-semibold text-zaff-primary transition-colors hover:bg-zaff-bg"
        >
          + Crea nuovo mazzo
        </button>

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
                {canEdit(d.createdBy, userId) ? (
                  <div className="flex shrink-0 gap-3">
                    <button type="button" onClick={() => onEdit(d.id)} className="text-sm text-zaff-primary hover:underline">
                      Modifica
                    </button>
                    <button type="button" onClick={() => handleDelete(d.id)} className="text-sm text-red-400 hover:underline">
                      Cancella
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className="shrink-0 text-sm text-zaff-primary hover:underline"
                  >
                    Visualizza
                  </button>
                )}
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
