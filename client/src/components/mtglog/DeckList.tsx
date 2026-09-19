import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { canEdit, supabase, TABLE_DECKS } from '../../services/supabase';
import Modal from './Modal';
import { ManaIcons, ManaPips } from './ManaIcon';
import { BTN_DANGER_LINK, BTN_LINK } from './ui';

interface DeckListProps {
  userId: string;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onImportFile: (name: string, cards: DeckCard[]) => void;
}

interface DeckCard {
  name: string;
  qty: number;
}

/** Legge un file di testo esportato da ManaBox: ogni riga è
 *  "<copie> <nome carta> [(espansione) numero]"; espansione e numero
 *  sono facoltativi e vengono ignorati. */
function parseManaboxText(text: string): DeckCard[] {
  const merged: Record<string, DeckCard> = {};
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const m = line.match(/^(\d+)\s+(.+)$/);
    if (!m) return;
    const qty = parseInt(m[1], 10);
    const rest = m[2].trim();
    const setMatch = rest.match(/^(.*)\s+\([^)]+\)\s+\S+$/);
    const name = (setMatch ? setMatch[1] : rest).trim();
    if (!name || !qty) return;
    const key = name.toLowerCase();
    merged[key] = merged[key] ?? { name, qty: 0 };
    merged[key].qty += qty;
  });
  return Object.values(merged);
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

/** Pillola "Homebrew"/"Precon" accanto al nome del mazzo (.badge-source). */
function SourceBadge({ source }: { source: string }) {
  const label = sourceLabel(source);
  if (!label) return null;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-px text-[11px] ${
        source === 'brew' ? 'border-green-400 text-green-400' : 'border-cyan-400 text-cyan-400'
      }`}
    >
      {label}
    </span>
  );
}

/** Lista mazzi salvati + dettaglio, con creazione/modifica/cancellazione (Step 5).
 *  Va mostrata dentro un `Modal`; il dettaglio mazzo si apre come riquadro sopra. */
export default function DeckList({ userId, onCreate, onEdit, onImportFile }: DeckListProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      onImportFile(file.name.replace(/\.[^/.]+$/, ''), parsed);
    };
    reader.readAsText(file, 'utf-8');
  }

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

  return (
    <>
      <div className="mb-3">
        {loading ? (
          <p className="text-zaff-muted">Caricamento…</p>
        ) : decks.length === 0 ? (
          <p className="text-sm text-zaff-muted">Ancora nessun mazzo salvato.</p>
        ) : (
          <ul>
            {decks.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2.5 border-b border-zaff-border py-2 last:border-b-0">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                  <span className="truncate text-[15px] text-zaff-text" title={d.name}>
                    {d.name}
                  </span>
                  <SourceBadge source={d.source} />
                  <small className="shrink-0 text-[13px] text-zaff-muted">({deckTotal(d)} carte)</small>
                  <ManaIcons colors={d.colors} className="shrink-0 text-[17px]" />
                </div>
                <div className="flex shrink-0 gap-1.5 whitespace-nowrap">
                  {canEdit(d.createdBy, userId) ? (
                    <>
                      <button type="button" onClick={() => onEdit(d.id)} className={BTN_LINK}>
                        Modifica
                      </button>
                      <button type="button" onClick={() => handleDelete(d.id)} className={BTN_DANGER_LINK}>
                        Cancella
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setSelectedId(d.id)} className={BTN_LINK}>
                      Visualizza
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onCreate} className={BTN_LINK}>
          + Crea nuovo mazzo
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className={BTN_LINK}>
          📄 Importa mazzo (file ManaBox)
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept=".txt" hidden onChange={handleFileChange} />

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {selectedDeck && (
        <Modal level={2} title={selectedDeck.name} onClose={() => setSelectedId(null)}>
          <p className="mb-2.5 flex items-center gap-2 text-xs text-zaff-muted">
            <SourceBadge source={selectedDeck.source} />
            {deckTotal(selectedDeck)} carte
          </p>

          {selectedDeck.colors.length > 0 && (
            <div className="mb-2.5">
              <ManaPips colors={selectedDeck.colors} />
            </div>
          )}

          {selectedDeck.cards.length === 0 ? (
            <p className="text-sm text-zaff-muted">Nessuna carta.</p>
          ) : (
            <ul className="max-h-[50vh] overflow-y-auto">
              {selectedDeck.cards.map((c) => (
                <li key={c.name} className="border-b border-zaff-border py-1.5 text-sm text-zaff-text last:border-b-0">
                  {c.qty}× {c.name}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
