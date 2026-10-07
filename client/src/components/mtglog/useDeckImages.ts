import { useEffect, useReducer } from 'react';
import { cardKey, requestCards, requestTokens, subscribeCards } from '../../services/scryfall';

/** Chiede a Scryfall le carte del mazzo e si riaggiorna quando arrivano. */
export function useDeckImages(entries: (string | { name: string; scryfallId?: string | null })[]) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const cards = entries.map(c => typeof c === 'string' ? { name: c } : c);
  const signature = cards.map(c => cardKey(c.name) + ':' + (c.scryfallId ?? '')).join('|');
  useEffect(() => subscribeCards(bump), []);
  useEffect(() => {
    requestCards(cards.map(c => c.name), cards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}

/** Chiede a Scryfall i token con questi id e si riaggiorna quando arrivano. */
export function useTokenImages(ids: string[]) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const signature = [...new Set(ids)].sort().join('|');
  useEffect(() => subscribeCards(bump), []);
  useEffect(() => {
    requestTokens(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
