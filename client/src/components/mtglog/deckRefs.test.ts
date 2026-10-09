import { describe, expect, it } from 'vitest';
import { makeDeckResolver } from './deckRefs';

const decks = [{ id: 'd1', name: 'MonoBlu_Pauper_Ale' }, { id: 'd2', name: 'Elfi' }];
const resolve = makeDeckResolver(decks);

describe('collegamento partita → mazzo', () => {
  it('segue l\'ID anche se il mazzo è stato rinominato', () => {
    expect(resolve({ deck: 'MonoBlu Pauper - Ale', deckId: 'd1' })).toEqual({ key: 'id:d1', name: 'MonoBlu_Pauper_Ale', id: 'd1' });
  });
  it('per le partite senza ID ripiega sul nome del mazzo salvato', () => {
    expect(resolve({ deck: 'Elfi' })).toEqual({ key: 'id:d2', name: 'Elfi', id: 'd2' });
  });
  it('mazzo cancellato o scritto a mano: resta il nome della partita, senza ID', () => {
    expect(resolve({ deck: 'Vecchio', deckId: 'sparito' })).toEqual({ key: 'name:Vecchio', name: 'Vecchio' });
    expect(resolve({ deck: '  ' })).toBeNull();
  });
});
