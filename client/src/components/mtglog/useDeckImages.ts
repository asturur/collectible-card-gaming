import { useEffect, useReducer } from 'react';
import { cardKey, requestCards, subscribeCards } from '../../services/scryfall';

/** Chiede a Scryfall le carte del mazzo e si riaggiorna quando arrivano. */
export function useDeckImages(names: string[]) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const signature = names.map(cardKey).join('|');
  useEffect(() => subscribeCards(bump), []);
  useEffect(() => {
    requestCards(names);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
