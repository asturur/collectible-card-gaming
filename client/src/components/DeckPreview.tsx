import { useMemo, useState } from 'react';
import { dedupePlayableCards, expandPlayableDeck, type PlayableDeck, type PlayableCard } from '../services/playableDeck';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { cx, HEADING_PANEL, HEADING_SECTION } from './ui/styles';

interface DeckPreviewProps {
  deck: PlayableDeck;
  onGoBack: () => void;
  onConfirm: () => Promise<void>;
}

function CardTile({ card }: { card: PlayableCard }) {
  const imageUrl = card.imageUrl;

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
        <Badge tone="primary" size="lg" className="absolute bottom-2 left-2">
          {card.count}
        </Badge>
      )}
    </div>
  );
}

/** Check if a card is a land by its type line */
function isLand(card: PlayableCard): boolean {
  return card.type.toLowerCase().includes('land');
}

interface DeckSection {
  title: string;
  cards: PlayableCard[];
}

function buildSections(deck: PlayableDeck): DeckSection[] {
  const sections: DeckSection[] = [];

  // Commander
  if (deck.commander.length > 0) {
    sections.push({
      title: 'Commander',
      cards: dedupePlayableCards(deck.commander),
    });
  }

  // Main board — split into spells and lands
  if (deck.mainBoard.length > 0) {
    const mainDeduped = dedupePlayableCards(deck.mainBoard);
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
      cards: dedupePlayableCards(deck.sideBoard),
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  let validationError = '';
  try { expandPlayableDeck(deck); } catch (err) { validationError = (err as Error).message; }
  async function confirm() {
    setBusy(true); setError('');
    try { await onConfirm(); } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  const sections = useMemo(() => buildSections(deck), [deck]);
  const { total, unique } = useMemo(() => countTotal(sections), [sections]);

  return (
    <div className="flex min-h-screen flex-col bg-zaff-bg text-zaff-text">
      {/* Header */}
      <header className="border-b border-zaff-border bg-zaff-surface px-6 py-4">
        <h2 className={HEADING_PANEL}>{deck.name}</h2>
        <p className="mt-1 text-sm text-zaff-muted">
          {deck.type} &middot; {total} cards ({unique} unique)
        </p>
      </header>

      {/* Card sections */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {sections.map((section) => (
          <section key={section.title} className="mb-8">
            <h3 className={cx(HEADING_SECTION, 'mb-4')}>
              {section.title}
              <span className="ml-2 text-base font-normal text-zaff-muted">
                ({section.cards.reduce((sum, c) => sum + c.count, 0)} cards)
              </span>
            </h3>
            <div className="flex flex-wrap gap-4">
              {section.cards.map((card) => (
                <CardTile
                  key={card.scryfallId ?? card.name}
                  card={card}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {(error || validationError) && <p className="px-6 py-3 text-sm text-red-400" role="alert">{error || validationError}</p>}
      {/* Bottom action bar */}
      <footer className="flex items-center justify-between border-t border-zaff-border bg-zaff-surface px-6 py-4">
        <Button variant="ghost" size="lg" onClick={onGoBack} disabled={busy}>
          Go Back
        </Button>
        <Button size="lg" onClick={confirm} disabled={busy || !!validationError}>
          {busy ? 'Checking deck…' : 'Confirm Deck'}
        </Button>
      </footer>
    </div>
  );
}
