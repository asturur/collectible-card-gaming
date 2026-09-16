import { useMemo } from 'react';
import { scryfallImageUrl, type MtgJsonDeck, type MtgJsonCard } from '../services/mtgjson';

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
        <span className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-zaff-primary text-xs font-bold text-white shadow-lg">
          {card.count}
        </span>
      )}
    </div>
  );
}

/** Deduplicate cards by scryfallId, summing counts */
function dedupeCards(cards: MtgJsonCard[]): MtgJsonCard[] {
  const byId = new Map<string, MtgJsonCard>();
  for (const card of cards) {
    const id = card.identifiers.scryfallId;
    if (!id) continue;
    const existing = byId.get(id);
    if (existing) {
      existing.count += card.count;
    } else {
      byId.set(id, { ...card });
    }
  }
  return [...byId.values()];
}

/** Check if a card is a land by its type line */
function isLand(card: MtgJsonCard): boolean {
  return card.type.toLowerCase().includes('land');
}

interface DeckSection {
  title: string;
  cards: MtgJsonCard[];
}

function buildSections(deck: MtgJsonDeck): DeckSection[] {
  const sections: DeckSection[] = [];

  // Commander
  if (deck.commander.length > 0) {
    sections.push({
      title: 'Commander',
      cards: dedupeCards(deck.commander),
    });
  }

  // Main board — split into spells and lands
  if (deck.mainBoard.length > 0) {
    const mainDeduped = dedupeCards(deck.mainBoard);
    const spells = mainDeduped.filter((c) => !isLand(c));
    const lands = mainDeduped.filter((c) => isLand(c));

    if (spells.length > 0) {
      sections.push({
        title: 'Deck',
        cards: spells,
      });
    }
    if (lands.length > 0) {
      sections.push({
        title: 'Lands',
        cards: lands,
      });
    }
  }

  // Side board
  if (deck.sideBoard.length > 0) {
    sections.push({
      title: 'Sideboard',
      cards: dedupeCards(deck.sideBoard),
    });
  }

  return sections;
}

function countTotal(sections: DeckSection[]): { total: number; unique: number } {
  let total = 0;
  let unique = 0;
  for (const section of sections) {
    for (const card of section.cards) {
      total += card.count;
      unique += 1;
    }
  }
  return { total, unique };
}

export default function DeckPreview({ deck, onGoBack, onConfirm }: DeckPreviewProps) {
  const sections = useMemo(() => buildSections(deck), [deck]);
  const { total, unique } = useMemo(() => countTotal(sections), [sections]);

  return (
    <div className="flex min-h-screen flex-col bg-zaff-bg text-zaff-text">
      {/* Header */}
      <header className="border-b border-zaff-border bg-zaff-surface px-6 py-4">
        <h2 className="text-2xl font-bold text-zaff-primary">{deck.name}</h2>
        <p className="mt-1 text-sm text-zaff-muted">
          {deck.type} &middot; {total} cards ({unique} unique)
        </p>
      </header>

      {/* Card sections */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {sections.map((section) => (
          <section key={section.title} className="mb-8">
            <h3 className="mb-4 text-xl font-bold text-zaff-text">
              {section.title}
              <span className="ml-2 text-base font-normal text-zaff-muted">
                ({section.cards.reduce((sum, c) => sum + c.count, 0)} cards)
              </span>
            </h3>
            <div className="flex flex-wrap gap-4">
              {section.cards.map((card) => (
                <CardTile
                  key={card.identifiers.scryfallId ?? card.name}
                  card={card}
                />
              ))}
            </div>
          </section>
        ))}
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
