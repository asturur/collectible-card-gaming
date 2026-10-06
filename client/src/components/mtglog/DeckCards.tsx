import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { cardKey, getCard, isMissing, requestCards, subscribeCards, type ScryCard } from '../../services/scryfall';
import { cx, FIELD_LABEL } from '../ui/styles';

/** Carta di un mazzo, per questa vista (stessa forma di `DeckViewCard`). */
export interface DeckCardsItem {
  name: string;
  qty: number;
  section?: 'main' | 'side' | string;
}

type ViewMode = 'grid' | 'list';
const VIEW_KEY = 'mtg-deck-view-mode';

function readMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

function total(cards: DeckCardsItem[]): number {
  return cards.reduce((sum, c) => sum + c.qty, 0);
}

/** Chiede a Scryfall le carte del mazzo e si riaggiorna quando arrivano. */
function useDeckImages(names: string[]) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const signature = names.map(cardKey).join('|');
  useEffect(() => subscribeCards(bump), []);
  useEffect(() => {
    requestCards(names);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}

/** Riquadro grigio al posto dell'immagine: carta ancora in arrivo o non trovata. */
function Placeholder({ name, pending, className }: { name: string; pending: boolean; className?: string }) {
  return (
    <span
      className={cx(
        'flex items-center justify-center rounded-md border border-zaff-border bg-zaff-surface p-1 text-center text-[11px] leading-tight text-zaff-muted',
        pending ? 'animate-pulse' : undefined,
        className
      )}
    >
      {name}
    </span>
  );
}

function CardViewer({
  items,
  startIndex,
  onClose,
}: {
  items: DeckCardsItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [face, setFace] = useState(0);
  const touchX = useRef<number | null>(null);

  const item = items[index];
  const card: ScryCard | undefined = getCard(item.name);
  const faceCount = card?.faces.length ?? 0;
  const image = card ? card.faces[Math.min(face, faceCount - 1)] : undefined;

  function go(delta: number) {
    setFace(0);
    setIndex((i) => (i + delta + items.length) % items.length);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const navBtn =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/40 bg-black/50 text-2xl text-white active:scale-95';

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 px-3 py-4"
      onClick={onClose}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      }}
      role="dialog"
      aria-label={item.name}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi"
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/60 bg-black/60 text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="5" x2="19" y2="19" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      </button>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {image ? (
          <img
            src={image.normal}
            alt={item.name}
            className="max-h-full max-w-full rounded-xl object-contain"
            style={{ aspectRatio: '488 / 680' }}
          />
        ) : (
          <Placeholder name={item.name} pending={!isMissing(item.name)} className="h-72 w-52 text-base" />
        )}
      </div>

      <div className="mt-3 flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={navBtn} onClick={() => go(-1)} aria-label="Carta precedente">
          ‹
        </button>
        <div className="min-w-[8rem] text-center text-sm text-white">
          <div className="font-semibold">
            {item.name}
            {item.qty > 1 ? ` · ×${item.qty}` : ''}
          </div>
          <div className="text-xs text-white/70">
            {index + 1} / {items.length}
          </div>
        </div>
        <button type="button" className={navBtn} onClick={() => go(1)} aria-label="Carta successiva">
          ›
        </button>
      </div>

      {faceCount > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFace((f) => (f + 1) % faceCount);
          }}
          className="mt-3 rounded-lg border-2 border-white/60 bg-black/50 px-5 py-2 text-sm font-semibold text-white active:scale-95"
        >
          ↻ Gira la carta
        </button>
      )}
    </div>
  );
}

function CardGrid({ cards, onOpen }: { cards: DeckCardsItem[]; onOpen: (c: DeckCardsItem) => void }) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2 min-[560px]:grid-cols-4 min-[800px]:grid-cols-5">
      {cards.map((c) => {
        const scry = getCard(c.name);
        const img = scry?.faces[0];
        return (
          <button
            key={c.name}
            type="button"
            onClick={() => scry && onOpen(c)}
            className="relative block w-full text-left"
            style={{ aspectRatio: '488 / 680' }}
            aria-label={c.name}
          >
            {img ? (
              <img
                src={img.small}
                alt={c.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full rounded-md object-cover"
              />
            ) : (
              <Placeholder name={c.name} pending={!isMissing(c.name)} className="h-full w-full" />
            )}
            {c.qty > 1 && (
              <span className="absolute right-1 top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[12px] font-bold leading-none text-white ring-1 ring-white/50">
                ×{c.qty}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CardList({ cards, onOpen }: { cards: DeckCardsItem[]; onOpen: (c: DeckCardsItem) => void }) {
  return (
    <ul className="mb-3">
      {cards.map((c) => {
        const scry = getCard(c.name);
        const img = scry?.faces[0];
        return (
          <li key={c.name} className="border-b border-zaff-border last:border-b-0">
            <button
              type="button"
              onClick={() => scry && onOpen(c)}
              className="flex w-full items-center gap-3 py-1.5 text-left text-sm text-zaff-text"
            >
              {img ? (
                <img src={img.small} alt="" loading="lazy" decoding="async" className="h-14 w-10 shrink-0 rounded object-cover" />
              ) : (
                <span className="h-14 w-10 shrink-0 rounded border border-zaff-border bg-zaff-surface" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {c.qty}× {c.name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Elenco carte di un mazzo (main deck, poi sideboard) con le immagini di
 *  Scryfall: vista a griglia o a lista, "×N" per le copie multiple, tocco per
 *  ingrandire (con scorrimento tra le carte). Solo lettura. */
export default function DeckCardsView({ cards }: { cards: DeckCardsItem[] }) {
  const [mode, setMode] = useState<ViewMode>(readMode);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const main = useMemo(() => cards.filter((c) => c.section !== 'side'), [cards]);
  const side = useMemo(() => cards.filter((c) => c.section === 'side'), [cards]);
  const ordered = useMemo(() => [...main, ...side], [main, side]);

  useDeckImages(ordered.map((c) => c.name));

  function chooseMode(m: ViewMode) {
    setMode(m);
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch {
      /* non salvabile: vale solo per ora */
    }
  }

  function open(c: DeckCardsItem) {
    const i = ordered.indexOf(c);
    if (i >= 0) setOpenIndex(i);
  }

  const View = mode === 'grid' ? CardGrid : CardList;

  const toggleBtn = (m: ViewMode, label: string) => (
    <button
      type="button"
      onClick={() => chooseMode(m)}
      aria-pressed={mode === m}
      className={cx(
        'rounded-lg border px-4 py-2 text-sm font-semibold transition',
        mode === m ? 'border-zaff-text bg-zaff-text text-zaff-bg' : 'border-zaff-border text-zaff-muted'
      )}
    >
      {label}
    </button>
  );

  if (cards.length === 0) return <p className="text-sm text-zaff-muted">Nessuna carta.</p>;

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        {toggleBtn('grid', 'Griglia')}
        {toggleBtn('list', 'Lista')}
      </div>

      <span className={FIELD_LABEL}>Main Deck · {total(main)} carte</span>
      <View cards={main} onOpen={open} />

      {side.length > 0 && (
        <>
          <hr className="mb-3 border-zaff-border" />
          <span className={FIELD_LABEL}>Sideboard · {total(side)} carte</span>
          <View cards={side} onOpen={open} />
        </>
      )}

      {openIndex !== null && <CardViewer items={ordered} startIndex={openIndex} onClose={() => setOpenIndex(null)} />}
    </>
  );
}
