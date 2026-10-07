import { type MtgJsonDeck, type MtgJsonCard, scryfallImageUrl } from './mtgjson';
import type { SavedDeck } from './savedDecks';

export interface PlayableCard {
  name: string; count: number; type: string;
  scryfallId: string | null; oracleId?: string | null; imageUrl: string | null;
}
export interface PlayableDeck {
  name: string; type: string; mainBoard: PlayableCard[]; sideBoard: PlayableCard[]; commander: PlayableCard[];
  source: { kind: 'saved'; id: string; revision: number } | { kind: 'mtgjson'; fileName: string };
}
export function fromMtgJson(deck: MtgJsonDeck, fileName: string): PlayableDeck {
  const cards = (board: MtgJsonCard[]) => board.map(c => ({ name: c.name, count: c.count, type: c.type,
    scryfallId: c.identifiers.scryfallId ?? null,
    imageUrl: c.identifiers.scryfallId ? scryfallImageUrl(c.identifiers.scryfallId) : null,
  }));
  return { name: deck.name, type: deck.type, source: { kind: 'mtgjson', fileName },
    mainBoard: cards(deck.mainBoard), sideBoard: cards(deck.sideBoard), commander: cards(deck.commander) };
}
export function fromSavedDeck(deck: SavedDeck): PlayableDeck {
  const cards = (section: 'main' | 'side') => deck.cardRows.filter(c => (c.section ?? 'main') === section).map(c => ({
    name: c.name, count: c.qty, type: c.typeLine ?? '', scryfallId: c.scryfallId ?? null,
    oracleId: c.oracleId, imageUrl: c.imageUrl ?? null,
  }));
  return { name: deck.name, type: deck.format || 'Saved deck', mainBoard: cards('main'),
    sideBoard: cards('side'), commander: [], source: { kind: 'saved', id: deck.id, revision: deck.revision } };
}
export function expandPlayableDeck(deck: PlayableDeck): { cardId: string; imageUrl: string }[] {
  const entries = [...deck.mainBoard, ...deck.sideBoard, ...deck.commander];
  if (!entries.length) throw new Error('This deck is empty.');
  const invalid = entries.filter(c => !c.scryfallId || !c.imageUrl || !c.type || !Number.isSafeInteger(c.count) || c.count < 1);
  if (invalid.length) throw new Error('This deck is not ready to play. Resolve these cards in Registro: ' + invalid.map(c => c.name).join(', '));
  // Match the existing server behavior: main, sideboard and commander share the deck zone.
  return entries.flatMap(c => Array.from({ length: c.count }, () => ({ cardId: c.scryfallId!, imageUrl: c.imageUrl! })));
}
export function dedupePlayableCards(cards: PlayableCard[]): PlayableCard[] {
  const groups = new Map<string, PlayableCard>();
  for (const card of cards) {
    const key = card.scryfallId ?? card.name;
    const existing = groups.get(key);
    if (existing) existing.count += card.count;
    else groups.set(key, { ...card });
  }
  return [...groups.values()];
}
