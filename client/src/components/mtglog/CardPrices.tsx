import { useEffect, useReducer } from 'react';
import { getPrice, isPriceFailed, requestPrices, subscribePrices } from '../../services/cardPrices';
import { getCard } from '../../services/scryfall';
import { ButtonLink } from '../ui/Button';
import { computeDeckValue, formatEur, formatPriceDate, formatUsd, type DeckValue, type PricedItem } from './deckValue';

/** Chiede i prezzi di queste stampe (mancanti o vecchi) e si riaggiorna quando arrivano. */
export function useCardPrices(ids: (string | null | undefined)[]) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const unique = [...new Set(ids.filter((id): id is string => !!id))].sort();
  const signature = unique.join('|');
  useEffect(() => subscribePrices(bump), []);
  useEffect(() => {
    requestPrices(unique);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}

/** Stampa della carta: quella salvata nel mazzo, oppure quella trovata per nome. */
const printingOf = (name: string, scryfallId?: string | null) => scryfallId || getCard(name)?.scryfallId || null;

interface DeckValueState {
  value: DeckValue;
  /** Prezzi (o carte) ancora in arrivo. */
  loading: boolean;
  /** Almeno una lettura da Scryfall non è riuscita. */
  failed: boolean;
}

/** Valore del mazzo dai prezzi Scryfall (le carte vanno già chieste con `useDeckImages`). */
export function useDeckValue(cards: { name: string; qty: number; section?: string; scryfallId?: string | null }[]): DeckValueState {
  const items: PricedItem[] = cards.map((c) => {
    const scryfallId = printingOf(c.name, c.scryfallId);
    return { name: c.name, qty: c.qty, section: c.section, scryfallId, price: scryfallId ? getPrice(scryfallId) : undefined };
  });
  useCardPrices(items.map((i) => i.scryfallId));
  // Una carta non ancora riconosciuta da Scryfall non ha una stampa: conta tra quelle senza prezzo.
  const failed = items.some((i) => !i.price && i.scryfallId && isPriceFailed(i.scryfallId));
  const loading = items.some((i) => !i.price && i.scryfallId && !isPriceFailed(i.scryfallId));
  return { value: computeDeckValue(items), loading, failed };
}

/** Prezzo di una copia nel visore della carta, con il link a Cardmarket. */
export function CardPriceBox({ name, scryfallId }: { name: string; scryfallId?: string | null }) {
  const id = printingOf(name, scryfallId);
  useCardPrices([id]);
  const price = id ? getPrice(id) : undefined;
  const note = 'mt-1.5 text-center text-[11px] text-white/60';

  // Senza stampa riconosciuta non c'è un prezzo da cercare (il visore mostra già la carta "in attesa").
  if (!id) return null;
  if (!price) {
    return <p className={note}>{isPriceFailed(id) ? 'Prezzo non disponibile ora: riprova più tardi.' : 'Carico il prezzo…'}</p>;
  }
  if (price.eur === null && price.usd === null) {
    return <p className={note}>Nessun prezzo su Scryfall per questa stampa.</p>;
  }
  return (
    <div className="mt-3 flex flex-col items-center">
      <div className="flex items-center gap-3 rounded-xl border border-white/25 bg-zaff-bg/85 px-3 py-2 text-white">
        <span className="text-lg font-extrabold tabular-nums">{price.eur !== null ? formatEur(price.eur) : '€ —'}</span>
        {price.usd !== null && <span className="text-sm tabular-nums text-white/70">{formatUsd(price.usd)}</span>}
        {price.cardmarket && (
          <ButtonLink href={price.cardmarket} target="_blank" rel="noopener noreferrer" size="sm">
            Cardmarket ↗
          </ButtonLink>
        )}
      </div>
      <p className={note}>Prezzo di una copia · Scryfall, {formatPriceDate(price.at)}</p>
    </div>
  );
}
