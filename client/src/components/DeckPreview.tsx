import { useMemo } from 'react';
import { getAllCards, scryfallImageUrl, type MtgJsonDeck, type MtgJsonCard } from '../services/mtgjson';

interface DeckPreviewProps {
  deck: MtgJsonDeck;
  onGoBack: () => void;
  onConfirm: () => void;
}

function CardTile({ card }: { card: MtgJsonCard }) {
  const imageUrl = card.identifiers.scryfallId
    ? scryfallImageUrl(card.identifiers.scryfallId)
    : null;

  return (
    <div className="relative max-w-64 shrink-0">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={card.name}
          crossOrigin="anonymous"
          loading="lazy"
          className="w-full rounded-lg"
        />
      ) : (
        <div className="flex aspect-[5/7] w-full items-center justify-center rounded-lg bg-zaff-border text-sm text-zaff-muted">
          {card.name}
        </div>
      )}
      {card.count > 1 && (
        <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-zaff-primary text-xs font-bold text-white shadow-lg">
          {card.count}
        </span>
      )}
    </div>
  );
}

export default function DeckPreview({ deck, onGoBack, onConfirm }: DeckPreviewProps) {
  const cards = useMemo(() => getAllCards(deck), [deck]);

  const totalCards = useMemo(
    () => cards.reduce((sum, c) => sum + c.count, 0),
    [cards],
  );

  return (
    <div className="flex min-h-screen flex-col bg-zaff-bg text-zaff-text">
      {/* Header */}
      <header className="border-b border-zaff-border bg-zaff-surface px-6 py-4">
        <h2 className="text-2xl font-bold text-zaff-primary">{deck.name}</h2>
        <p className="mt-1 text-sm text-zaff-muted">
          {deck.type} &middot; {totalCards} cards ({cards.length} unique)
        </p>
      </header>

      {/* Card grid */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex flex-wrap gap-4">
          {cards.map((card) => (
            <CardTile
              key={card.identifiers.scryfallId ?? card.name}
              card={card}
            />
          ))}
        </div>
      </main>

      {/* Bottom action bar */}
      <footer className="flex items-center justify-between border-t border-zaff-border bg-zaff-surface px-6 py-4">
        <button
          onClick={onGoBack}
          className="rounded-lg border border-zaff-border px-6 py-3 font-semibold text-zaff-muted transition-colors hover:bg-zaff-border hover:text-zaff-text focus:outline-none focus:ring-2 focus:ring-zaff-primary"
        >
          Go Back
        </button>
        <button
          onClick={onConfirm}
          className="rounded-lg bg-zaff-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-zaff-primary-hover focus:outline-none focus:ring-2 focus:ring-zaff-primary focus:ring-offset-2 focus:ring-offset-zaff-surface"
        >
          Confirm Deck
        </button>
      </footer>
    </div>
  );
}
