/** Un mazzo salvato, ridotto a ciò che serve per collegarlo alle partite. */
export interface DeckRef {
  id: string;
  name: string;
}

export interface ResolvedDeck {
  /** Chiave stabile per raggruppare: l'ID del mazzo salvato, oppure il nome scritto nella partita. */
  key: string;
  /** Nome da mostrare: quello attuale del mazzo salvato, se c'è. */
  name: string;
  /** ID del mazzo salvato, se la partita si riferisce a uno che esiste ancora. */
  id?: string;
}

/**
 * Trova il mazzo di un giocatore in una partita. Prima per ID (resta valido anche
 * se il mazzo viene rinominato), poi per nome (partite salvate prima dell'ID).
 * Senza un mazzo salvato corrispondente resta il nome scritto nella partita.
 */
export function makeDeckResolver(decks: readonly DeckRef[]) {
  const byId = new Map(decks.map((d) => [d.id, d]));
  const byName = new Map(decks.map((d) => [d.name, d]));
  return (player: { deck?: string; deckId?: string }): ResolvedDeck | null => {
    const stored = (player.deck ?? '').trim();
    const saved = (player.deckId ? byId.get(player.deckId) : undefined) ?? (stored ? byName.get(stored) : undefined);
    if (saved) return { key: `id:${saved.id}`, name: saved.name, id: saved.id };
    return stored ? { key: `name:${stored}`, name: stored } : null;
  };
}
