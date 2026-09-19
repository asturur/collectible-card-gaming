import { useEffect, useState } from 'react';
import { supabase, TABLE_DECKS } from '../../services/supabase';

interface DeckEditorProps {
  deckId: string | null;
  initialDraft?: { name: string; cards: DraftCard[] } | null;
  onBack: () => void;
  onSaved: () => void;
}

interface DraftCard {
  name: string;
  qty: number;
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

const COLORS = ['W', 'U', 'B', 'R', 'G'] as const;

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

async function searchCards(query: string): Promise<string[]> {
  try {
    const res = await fetch('https://api.scryfall.com/cards/autocomplete?q=' + encodeURIComponent(query));
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

/** Creazione/modifica manuale di un mazzo, con autocomplete carte (Scryfall),
 *  rilevamento automatico dei colori dalle terre base, e import (file ManaBox
 *  passato come `initialDraft`, o mazzo precon Commander cercato qui). */
export default function DeckEditor({ deckId, initialDraft, onBack, onSaved }: DeckEditorProps) {
  const [name, setName] = useState(initialDraft?.name ?? '');
  const [source, setSource] = useState('');
  const [colors, setColors] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<DraftCard[]>(initialDraft?.cards ?? []);
  const [cardSearch, setCardSearch] = useState('');
  const [pickedCardName, setPickedCardName] = useState('');
  const [qty, setQty] = useState(1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(deckId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [preconOpen, setPreconOpen] = useState(false);
  const [preconData, setPreconData] = useState<PreconDeck[] | null>(null);
  const [preconStatus, setPreconStatus] = useState('');
  const [preconSearch, setPreconSearch] = useState('');

  useEffect(() => {
    if (!deckId || !supabase) {
      setLoading(false);
      if (initialDraft?.cards.length) autoDetectColors(initialDraft.cards.map((c) => c.name));
      return;
    }
    supabase
      .from(TABLE_DECKS)
      .select('*')
      .eq('id', deckId)
      .single()
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError('Non riesco a leggere il mazzo: ' + loadError.message);
        } else if (data) {
          setName(data.name);
          setSource(data.source ?? '');
          setColors(new Set(data.colors ?? []));
          setDraft(data.cards ?? []);
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  useEffect(() => {
    const q = cardSearch.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const names = await searchCards(q);
      setSuggestions(names);
    }, 250);
    return () => clearTimeout(timer);
  }, [cardSearch]);

  function autoDetectColors(cardNames: string[]) {
    const found = detectLandColors(cardNames);
    if (found.size === 0) return;
    setColors((prev) => new Set([...prev, ...found]));
  }

  async function loadPreconData(): Promise<PreconDeck[] | null> {
    if (preconData) return preconData;
    setPreconStatus('Carico l\u2019elenco dei mazzi precon (solo la prima volta)…');
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
      setPreconStatus('Non sono riuscito a scaricare l\u2019elenco dei precon. Riprova più tardi.');
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
        merged[key] = merged[key] ?? { name: c.name, qty: 0 };
        merged[key].qty += c.count ?? 1;
      });
    addAll(deck.commander);
    addAll(deck.cards);
    const newDraft = Object.values(merged);
    setDraft(newDraft);
    setName(deck.name);
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

  function handleAddCard() {
    const cardName = pickedCardName || cardSearch.trim();
    if (!cardName) return;
    const addQty = Math.max(1, qty || 1);
    setDraft((prev) => {
      const idx = prev.findIndex((c) => c.name.toLowerCase() === cardName.toLowerCase());
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + addQty };
        return next;
      }
      return [...prev, { name: cardName, qty: addQty }];
    });
    autoDetectColors([cardName]);
    setCardSearch('');
    setQty(1);
    setPickedCardName('');
    setSuggestions([]);
  }

  function handleRemoveCard(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const trimmedName = name.trim();
    setError('');
    if (!trimmedName) {
      setError('Dai un nome al mazzo prima di salvarlo.');
      return;
    }
    if (!draft.length) {
      setError('Aggiungi almeno una carta al mazzo.');
      return;
    }
    if (!supabase) {
      setError('Supabase non configurato.');
      return;
    }
    setSaving(true);
    if (deckId) {
      const { error: updateError } = await supabase
        .from(TABLE_DECKS)
        .update({ name: trimmedName, cards: draft, source, colors: [...colors] })
        .eq('id', deckId);
      setSaving(false);
      if (updateError) {
        setError('Salvataggio mazzo non riuscito: ' + updateError.message);
        return;
      }
    } else {
      const row = {
        id: 'm' + Date.now() + Math.random().toString(36).slice(2, 7),
        name: trimmedName,
        cards: draft,
        source,
        colors: [...colors],
      };
      const { error: insertError } = await supabase.from(TABLE_DECKS).insert(row);
      setSaving(false);
      if (insertError) {
        setError('Salvataggio mazzo non riuscito: ' + insertError.message);
        return;
      }
    }
    onSaved();
  }

  const total = draft.reduce((sum, c) => sum + c.qty, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4">
        <p className="text-zaff-muted">Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zaff-bg px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zaff-border bg-zaff-surface p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-zaff-primary">
          {deckId ? 'Modifica mazzo' : 'Nuovo mazzo'}
        </h1>

        <label className="mb-1 block text-sm font-semibold text-zaff-text" htmlFor="deckName">
          Nome mazzo
        </label>
        <input
          id="deckName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="es. Mono nero aggro by Ale"
          className="mb-4 w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
        />

        <label className="mb-1 block text-sm font-semibold text-zaff-text" htmlFor="deckSource">
          Origine mazzo
        </label>
        <select
          id="deckSource"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
        >
          <option value="">Non specificato</option>
          <option value="brew">Homebrew (fatto in casa)</option>
          <option value="precon">Precon (di fabbrica)</option>
        </select>

        <p className="mb-1 text-sm font-semibold text-zaff-text">Colori del mazzo</p>
        <div className="mb-1 flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleColor(c)}
              aria-pressed={colors.has(c)}
              className={`h-8 w-8 rounded-full border text-sm font-bold transition-colors ${
                colors.has(c)
                  ? 'border-zaff-primary bg-zaff-primary text-white'
                  : 'border-zaff-border bg-zaff-bg text-zaff-muted'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mb-4 text-xs text-zaff-muted">
          Si accendono da soli quando aggiungi terre base; puoi correggerli a mano in ogni momento.
        </p>

        <button
          type="button"
          onClick={togglePreconBox}
          className="mb-4 w-full rounded-lg border border-zaff-border px-4 py-2 text-sm font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          Importa un mazzo precon Commander…
        </button>
        {preconOpen && (
          <div className="mb-4 rounded-lg border border-zaff-border p-3">
            <input
              type="text"
              autoComplete="off"
              value={preconSearch}
              onChange={(e) => setPreconSearch(e.target.value)}
              placeholder="Cerca il nome del precon (es. Elven Empire)…"
              className="mb-2 w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
            />
            {preconStatus && <p className="mb-2 text-xs text-zaff-muted">{preconStatus}</p>}
            {preconSearch.trim().length >= 2 && preconMatches.length === 0 && !preconStatus && (
              <p className="text-xs text-zaff-muted">Nessun mazzo trovato.</p>
            )}
            {preconMatches.length > 0 && (
              <ul className="max-h-48 divide-y divide-zaff-border overflow-y-auto">
                {preconMatches.map((d, i) => (
                  <li key={d.name + i}>
                    <button
                      type="button"
                      onClick={() => importPrecon(d)}
                      className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm text-zaff-text hover:text-zaff-primary"
                    >
                      <span className="min-w-0 flex-1 truncate">{d.name}</span>
                      <span className="shrink-0 text-xs text-zaff-muted">{d.set_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="relative mb-4">
          <label className="mb-1 block text-sm font-semibold text-zaff-text" htmlFor="cardSearch">
            Cerca carta
          </label>
          <input
            id="cardSearch"
            type="text"
            autoComplete="off"
            value={cardSearch}
            onChange={(e) => {
              setCardSearch(e.target.value);
              setPickedCardName('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCard()}
            placeholder="Scrivi il nome della carta…"
            className="w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text placeholder:text-zaff-muted focus:outline-none focus:ring-2 focus:ring-zaff-primary"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zaff-border bg-zaff-surface shadow-lg">
              {suggestions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setCardSearch(n);
                    setPickedCardName(n);
                    setSuggestions([]);
                  }}
                  className="block w-full truncate px-3 py-2 text-left text-sm text-zaff-text hover:bg-zaff-bg"
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 flex gap-2">
          <div className="w-20">
            <label className="mb-1 block text-sm font-semibold text-zaff-text" htmlFor="cardQty">
              Copie
            </label>
            <input
              id="cardQty"
              type="number"
              min={1}
              max={99}
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full rounded-lg border border-zaff-border bg-zaff-bg px-3 py-2 text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
            />
          </div>
          <div className="flex flex-1 items-end">
            <button
              type="button"
              onClick={handleAddCard}
              className="w-full rounded-lg border border-zaff-border px-4 py-2 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
            >
              Aggiungi al mazzo
            </button>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-sm text-zaff-text">
          <span>Totale carte</span>
          <b>{total}</b>
        </div>

        {draft.length === 0 ? (
          <p className="mb-4 text-sm text-zaff-muted">Nessuna carta ancora aggiunta.</p>
        ) : (
          <ul className="mb-4 max-h-64 divide-y divide-zaff-border overflow-y-auto">
            {draft.map((c, i) => (
              <li key={c.name} className="flex items-center justify-between gap-2 py-2 text-sm text-zaff-text">
                <span className="min-w-0 flex-1 truncate">
                  {c.qty}× {c.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveCard(i)}
                  title="Togli carta"
                  className="shrink-0 text-red-400 hover:underline"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-zaff-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-zaff-primary-hover disabled:opacity-60"
        >
          {deckId ? 'Salva modifiche' : 'Salva mazzo'}
        </button>

        {error && (
          <p className="mt-3 text-center text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-3 w-full rounded-lg border border-zaff-border px-4 py-3 font-semibold text-zaff-text transition-colors hover:bg-zaff-bg"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
