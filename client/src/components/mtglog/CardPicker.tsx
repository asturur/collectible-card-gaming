import { useEffect, useRef, useState } from 'react';
import { searchScryfall, type ScryCard } from '../../services/scryfall';
import Button from '../ui/Button';
import { cx, TEXT_MINI } from '../ui/styles';

interface CardPickerProps {
  /** `add`: ogni scelta aggiunge una copia, il selettore resta aperto.
   *  `replace`: la scelta sostituisce una carta non riconosciuta e chiude. */
  mode: 'add' | 'replace';
  /** Testo con cui parte la ricerca (nome sbagliato da correggere). */
  initialQuery?: string;
  /** Solo in modalità `add`: dove finiscono le carte aggiunte. */
  section?: 'main' | 'side';
  onSectionChange?: (s: 'main' | 'side') => void;
  /** Quante copie di quella carta ci sono già nel mazzo. */
  countOf: (name: string) => number;
  /** Totali del mazzo, sempre in vista mentre si aggiungono carte. */
  totals?: { main: number; side: number };
  onPick: (card: ScryCard) => void;
  onClose: () => void;
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

/** Anteprima grande di una carta trovata. Tocco sull'immagine = scelta
 *  (+1 in modalità aggiungi); la X (o "Non è questa") chiude senza scegliere. */
function Preview({
  card,
  mode,
  count,
  onChoose,
  onClose,
}: {
  card: ScryCard;
  mode: 'add' | 'replace';
  count: number;
  onChoose: () => void;
  onClose: () => void;
}) {
  const [face, setFace] = useState(0);
  const [flash, setFlash] = useState(0);
  const flashTimer = useRef<number | undefined>(undefined);
  const image = card.faces[Math.min(face, card.faces.length - 1)];

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  function choose() {
    onChoose();
    if (mode === 'add') {
      setFlash((n) => n + 1);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(0), 700);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/90 px-4 py-4"
      onClick={onClose}
      role="dialog"
      aria-label={card.name}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi senza scegliere"
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/60 bg-black/60 text-white"
      >
        <CloseIcon />
      </button>

      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={choose} className="relative max-h-full max-w-full" aria-label={`Aggiungi ${card.name}`}>
          <img
            src={image.normal}
            alt={card.name}
            className="max-h-full max-w-full rounded-xl object-contain"
            style={{ aspectRatio: '488 / 680', maxHeight: '62vh' }}
          />
          {flash > 0 && (
            <span
              key={flash}
              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-5xl font-extrabold text-white"
            >
              +1
            </span>
          )}
        </button>
      </div>

      <div className="w-full max-w-sm text-center text-white" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold">{card.name}</div>
        <div className="text-xs text-white/70">
          {mode === 'add'
            ? `Nel mazzo: ${count} · tocca la carta per aggiungerne una`
            : 'Tocca la carta per usarla al posto di quella non riconosciuta'}
        </div>
        {card.faces.length > 1 && (
          <button
            type="button"
            onClick={() => setFace((f) => (f + 1) % card.faces.length)}
            className="mt-2 rounded-lg border-2 border-white/60 bg-black/50 px-4 py-1.5 text-sm font-semibold text-white"
          >
            ↻ Gira la carta
          </button>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Button size="lg" fullWidth onClick={choose}>
            {mode === 'add' ? '+1 Aggiungi' : 'Usa questa'}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={onClose}>
            Non è questa
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Ricerca carte con immagini (Scryfall): scrivi il nome, tocca una carta per
 *  vederla grande, tocca ancora la carta per aggiungerla (o la X per scartarla). */
export default function CardPicker({
  mode,
  initialQuery = '',
  section,
  onSectionChange,
  countOf,
  totals,
  onPick,
  onClose,
}: CardPickerProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ScryCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<ScryCard | null>(null);
  const token = useRef(0);

  useEffect(() => {
    const mine = ++token.current;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchScryfall(q);
        if (mine !== token.current) return;
        setResults(found);
        setFailed(false);
      } catch {
        if (mine !== token.current) return;
        setResults([]);
        setFailed(true);
      } finally {
        if (mine === token.current) setSearching(false);
      }
    }, 350);
    return () => { token.current++; window.clearTimeout(timer); };
  }, [query]);

  function choose(card: ScryCard) {
    onPick(card);
    if (mode === 'replace') onClose();
  }

  const sectionBtn = (s: 'main' | 'side', label: string) => (
    <button
      type="button"
      onClick={() => onSectionChange?.(s)}
      aria-pressed={section === s}
      className={cx(
        'rounded-lg border px-4 py-2 text-sm font-semibold transition',
        section === s ? 'border-transparent bg-gradient-to-r from-zaff-primary to-zaff-accent text-zaff-bg' : 'border-zaff-border text-zaff-muted'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zaff-bg text-zaff-text">
      <div className="flex items-center justify-between gap-3 border-b border-zaff-border px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{mode === 'add' ? 'Aggiungi carte' : 'Trova la carta giusta'}</h2>
          {totals && (
            <p className="text-sm font-semibold text-zaff-muted">
              Main {totals.main} · Side {totals.side} · Totale {totals.main + totals.side}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-zaff-border text-zaff-text"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="px-4 pt-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoFocus
          placeholder="Scrivi il nome della carta (in inglese)…"
          className="w-full rounded-lg border border-zaff-border bg-zaff-surface px-3 py-3 text-base text-zaff-text placeholder:text-zaff-muted"
        />
        {mode === 'add' && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {sectionBtn('main', 'Main Deck')}
            {sectionBtn('side', 'Sideboard')}
          </div>
        )}
        <p className={cx('mt-2', TEXT_MINI)}>
          {searching
            ? 'Cerco…'
            : failed
              ? 'Ricerca non riuscita: controlla la connessione e riprova.'
              : query.trim().length < 2
                ? 'Scrivi almeno 2 lettere. Tocca una carta per vederla grande.'
                : results.length === 0
                  ? 'Nessuna carta trovata con questo nome.'
                  : `${results.length} carte trovate${results.length >= 60 ? ' (mostro le prime 60: affina il nome)' : ''}`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
        <div className="grid grid-cols-3 gap-2 min-[560px]:grid-cols-4 min-[800px]:grid-cols-5">
          {results.map((c) => {
            const n = countOf(c.name);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setPreview(c)}
                className="relative block w-full"
                style={{ aspectRatio: '488 / 680' }}
                aria-label={c.name}
              >
                <img
                  src={c.faces[0].small}
                  alt={c.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full rounded-md object-cover"
                />
                {n > 0 && (
                  <span className="absolute right-1 top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[12px] font-bold leading-none text-white ring-1 ring-white/50">
                    ×{n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {preview && (
        <Preview
          card={preview}
          mode={mode}
          count={countOf(preview.name)}
          onChoose={() => choose(preview)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
