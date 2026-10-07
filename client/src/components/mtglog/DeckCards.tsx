import { useEffect, useRef, useState } from 'react';
import { getCard, isMissing, type ScryCard } from '../../services/scryfall';
import { useDeckImages } from './useDeckImages';
import { DeckStatsButton } from './DeckStats';
import { groupCards, type GroupedColor, type GroupMode } from './cardGroups';
import { ManaIcons } from './ManaIcon';
import { cx } from '../ui/styles';

export { useDeckImages };

/** Carta di un mazzo, per questa vista (stessa forma di `DeckViewCard`). */
export interface DeckCardsItem {
  name: string;
  qty: number;
  section?: 'main' | 'side' | string;
}

/** Modifica dell'elenco (solo nell'editor mazzi): copie con −/+ (a 1 copia il
 *  tasto diventa × e toglie la carta) e correzione delle carte non riconosciute. */
export interface DeckCardsEditable {
  onChangeQty: (card: DeckCardsItem, delta: number) => void;
  onFix: (card: DeckCardsItem) => void;
}

type ViewMode = 'grid' | 'list';
const VIEW_KEY = 'mtg-deck-view-mode';
const GROUP_KEY = 'mtg-deck-group-mode';

function readGroupMode(): GroupMode {
  try {
    return localStorage.getItem(GROUP_KEY) === 'type' ? 'type' : 'color';
  } catch {
    return 'color';
  }
}

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
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/60 bg-black/60 text-white"
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

function QtyStepper({ card, editable }: { card: DeckCardsItem; editable: DeckCardsEditable }) {
  const btn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-lg font-bold leading-none active:scale-95';
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => editable.onChangeQty(card, -1)}
        aria-label={card.qty <= 1 ? `Togli ${card.name}` : `Una copia in meno di ${card.name}`}
        className={cx(btn, card.qty <= 1 ? 'border-red-400 text-red-400' : 'border-zaff-border text-zaff-text')}
      >
        {card.qty <= 1 ? '×' : '−'}
      </button>
      <span className="min-w-[1.25rem] text-center text-sm font-bold text-zaff-text">{card.qty}</span>
      <button
        type="button"
        onClick={() => editable.onChangeQty(card, 1)}
        aria-label={`Una copia in più di ${card.name}`}
        className={cx(btn, 'border-zaff-border text-zaff-text')}
      >
        +
      </button>
    </div>
  );
}

function FixTile({ card, onFix, className }: { card: DeckCardsItem; onFix: (c: DeckCardsItem) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onFix(card)}
      title="Carta non riconosciuta: tocca per cercarla"
      aria-label={`Carta non riconosciuta: ${card.name}. Tocca per cercarla`}
      className={cx(
        'flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border-2 border-dashed border-zaff-gold bg-zaff-surface p-1 text-center text-[11px] leading-tight text-zaff-gold',
        className
      )}
    >
      <span className="text-2xl font-bold leading-none">?</span>
      <span className="line-clamp-2 break-words">{card.name}</span>
    </button>
  );
}

interface ViewProps {
  cards: DeckCardsItem[];
  onOpen: (c: DeckCardsItem) => void;
  editable?: DeckCardsEditable;
}

function CardGrid({ cards, onOpen, editable }: ViewProps) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-2.5 min-[560px]:grid-cols-4 min-[800px]:grid-cols-5">
      {cards.map((c) => {
        const scry = getCard(c.name);
        const img = scry?.faces[0];
        const missing = !scry && isMissing(c.name);
        return (
          <div key={c.name} className="min-w-0">
            <div className="relative" style={{ aspectRatio: '488 / 680' }}>
              {missing && editable ? (
                <FixTile card={c} onFix={editable.onFix} className="h-full w-full" />
              ) : (
                <button
                  type="button"
                  onClick={() => scry && onOpen(c)}
                  className="block h-full w-full text-left"
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
                    <Placeholder name={c.name} pending={!missing} className="h-full w-full" />
                  )}
                </button>
              )}
              {!editable && c.qty > 1 && (
                <span className="pointer-events-none absolute right-1 top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[12px] font-bold leading-none text-white ring-1 ring-white/50">
                  ×{c.qty}
                </span>
              )}
            </div>
            {editable && (
              <div className="mt-1 flex justify-center">
                <QtyStepper card={c} editable={editable} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CardList({ cards, onOpen, editable }: ViewProps) {
  return (
    <ul>
      {cards.map((c) => {
        const scry = getCard(c.name);
        const img = scry?.faces[0];
        const missing = !scry && isMissing(c.name);
        return (
          <li key={c.name} className="flex items-center gap-2.5 border-b border-zaff-border py-1.5 last:border-b-0">
            {missing && editable ? (
              <FixTile card={c} onFix={editable.onFix} className="h-14 w-14 shrink-0 !p-0 text-[0px]" />
            ) : (
              <button
                type="button"
                onClick={() => scry && onOpen(c)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm text-zaff-text"
              >
                {img ? (
                  <img src={img.art} alt="" loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded object-cover" />
                ) : (
                  <span className="h-14 w-14 shrink-0 rounded border border-zaff-border bg-zaff-surface" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {editable ? c.name : `${c.qty}× ${c.name}`}
                </span>
              </button>
            )}
            {missing && editable && <span className="min-w-0 flex-1 truncate text-sm text-zaff-gold">{c.name}</span>}
            {editable && <QtyStepper card={c} editable={editable} />}
          </li>
        );
      })}
    </ul>
  );
}

/** Un blocco (Main Deck o Sideboard): gruppi per colore con intestazione
 *  ben visibile e totale, dentro ogni colore i tipi, dentro ogni tipo le
 *  carte in ordine alfabetico. */
function Section({
  title,
  groups,
  total,
  mode,
  onOpen,
  editable,
}: {
  title: string;
  groups: GroupedColor<DeckCardsItem>[];
  total: number;
  mode: ViewMode;
  onOpen: (c: DeckCardsItem) => void;
  editable?: DeckCardsEditable;
}) {
  const View = mode === 'grid' ? CardGrid : CardList;
  return (
    <div className="mb-5">
      <h3 className="mb-3 flex items-baseline justify-between border-b-2 border-zaff-text pb-1.5 text-base font-bold text-zaff-text">
        <span>{title}</span>
        <span>{total} carte</span>
      </h3>
      {groups.length === 0 && <p className="text-sm text-zaff-muted">Nessuna carta.</p>}
      {groups.map((g) => (
        <div key={g.id} className="mb-5 last:mb-0">
          <div
            className="mb-2 flex items-center justify-between gap-2 rounded-md border border-l-[6px] border-zaff-border bg-zaff-bg px-3 py-2"
            style={{ borderLeftColor: g.stripe }}
          >
            <span className="flex items-center gap-2 text-[15px] font-bold text-zaff-text">
              {g.label}
              {'WUBRG'.includes(g.id) && <ManaIcons colors={[g.id]} className="text-[15px]" />}
            </span>
            <span className="text-sm font-semibold text-zaff-muted">{g.total} carte</span>
          </div>
          {g.types.map((t) => (
            <div key={t.id}>
              {g.showTypes && (
                <div className="mb-1 mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zaff-muted">
                  <span className="shrink-0">
                    {t.label} · {t.total}
                  </span>
                  <span className="h-px flex-1 bg-zaff-border" />
                </div>
              )}
              <View cards={t.items} onOpen={onOpen} editable={editable} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Elenco carte di un mazzo (main deck, poi sideboard) con le immagini di
 *  Scryfall: vista a griglia o a lista, ordinate per colore → tipo → nome,
 *  "×N" per le copie multiple, tocco per ingrandire (con scorrimento tra le
 *  carte). Con `editable` serve anche per modificare il mazzo nell'editor. */
export default function DeckCardsView({
  cards,
  editable,
}: {
  cards: DeckCardsItem[];
  editable?: DeckCardsEditable;
}) {
  const [mode, setMode] = useState<ViewMode>(readMode);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>(readGroupMode);

  const main = cards.filter((c) => c.section !== 'side');
  const side = cards.filter((c) => c.section === 'side');
  const mainGroups = groupCards(main, getCard, groupMode);
  const sideGroups = groupCards(side, getCard, groupMode);
  const ordered = [...mainGroups, ...sideGroups].flatMap((g) => g.types.flatMap((t) => t.items));

  useDeckImages(cards.map((c) => c.name));

  function chooseMode(m: ViewMode) {
    setMode(m);
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch {
      /* non salvabile: vale solo per ora */
    }
  }

  function chooseGroupMode(m: GroupMode) {
    setGroupMode(m);
    try {
      localStorage.setItem(GROUP_KEY, m);
    } catch {
      /* non salvabile: vale solo per ora */
    }
  }

  function open(c: DeckCardsItem) {
    const i = ordered.indexOf(c);
    if (i >= 0) setOpenIndex(i);
  }

  const toggleClass = (active: boolean) =>
    cx(
      'rounded-lg border px-4 py-2 text-sm font-semibold transition',
      active ? 'border-transparent bg-gradient-to-r from-zaff-primary to-zaff-accent text-zaff-bg' : 'border-zaff-border text-zaff-muted'
    );
  const toggleBtn = (m: ViewMode, label: string) => (
    <button type="button" onClick={() => chooseMode(m)} aria-pressed={mode === m} className={toggleClass(mode === m)}>
      {label}
    </button>
  );
  const groupBtn = (m: GroupMode, label: string) => (
    <button
      type="button"
      onClick={() => chooseGroupMode(m)}
      aria-pressed={groupMode === m}
      className={toggleClass(groupMode === m)}
    >
      {label}
    </button>
  );

  if (cards.length === 0) return <p className="text-sm text-zaff-muted">Nessuna carta.</p>;

  const mainTotal = total(main);
  const sideTotal = total(side);

  return (
    <>
      {/* Nell'editor i totali stanno già nella barra fissa in cima. */}
      {!editable && (
        <>
        <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-center justify-between gap-2 rounded-lg border border-zaff-primary bg-zaff-surface px-3 py-2 text-sm font-semibold text-zaff-text shadow-lg">
          <span>Main {mainTotal}</span>
          <span>Side {sideTotal}</span>
          <span className="text-zaff-muted">Totale {mainTotal + sideTotal}</span>
        </div>
        <div className="mb-3">
          <DeckStatsButton cards={cards} />
        </div>
        </>
      )}

      <div className="mb-2.5 grid grid-cols-2 gap-2.5">
        {toggleBtn('grid', 'Griglia')}
        {toggleBtn('list', 'Lista')}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        {groupBtn('color', 'Colore')}
        {groupBtn('type', 'Tipo')}
      </div>

      <Section title="Main Deck" groups={mainGroups} total={mainTotal} mode={mode} onOpen={open} editable={editable} />
      {(side.length > 0 || editable) && (
        <Section title="Sideboard" groups={sideGroups} total={sideTotal} mode={mode} onOpen={open} editable={editable} />
      )}

      {openIndex !== null && <CardViewer items={ordered} startIndex={openIndex} onClose={() => setOpenIndex(null)} />}
    </>
  );
}
