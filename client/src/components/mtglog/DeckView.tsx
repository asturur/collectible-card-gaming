import { ManaPips } from './ManaIcon';
import DeckCardsView from './DeckCards';
import Badge from '../ui/Badge';
import { TEXT_MINI } from '../ui/styles';

/** Una carta di un mazzo salvato; `section` distingue main deck e sideboard
 *  (i mazzi salvati prima di questa distinzione non hanno il campo: main). */
export interface DeckViewCard {
  name: string;
  qty: number;
  section: 'main' | 'side';
}

/** Dalle righe di `mazzi.cards` (formato libero) a carte ben formate. */
export function normalizeDeckCards(raw: unknown): DeckViewCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: { name?: unknown; qty?: unknown; section?: unknown }) => ({
    name: String(c.name ?? ''),
    qty: Number(c.qty) || 0,
    section: c.section === 'side' ? 'side' : 'main',
  }));
}

function total(cards: DeckViewCard[]): number {
  return cards.reduce((sum, c) => sum + c.qty, 0);
}

/** Contenuto, in sola visualizzazione, del dettaglio di un mazzo: origine,
 *  colori, e l'elenco carte con le copie (main deck, poi sideboard). Stessa
 *  resa del dettaglio mazzo di "Gestisci Mazzi", senza modifica né cancellazione.
 *  Va dentro un `Modal` col nome del mazzo come titolo. */
export default function DeckViewContents({
  source,
  colors,
  cards,
}: {
  source: string;
  colors: string[];
  cards: DeckViewCard[];
}) {
  const label = source === 'precon' ? 'Precon' : source === 'brew' ? 'Homebrew' : null;

  return (
    <>
      <p className={`mb-2.5 flex items-center gap-2 ${TEXT_MINI}`}>
        {label && <Badge tone={source === 'brew' ? 'brew' : 'precon'}>{label}</Badge>}
        {total(cards)} carte
      </p>

      {colors.length > 0 && (
        <div className="mb-2.5">
          <ManaPips colors={colors} />
        </div>
      )}

      <DeckCardsView cards={cards} />
    </>
  );
}
