import { supabase } from './supabase';

/** Cosa fare, alla cancellazione dell'account, dei mazzi salvati da chi se ne va. */
export interface DeleteAccountChoices {
  /** true: i mazzi vengono eliminati; false: restano al gruppo senza proprietario. */
  deleteDecks: boolean;
}

/**
 * Cancella l'account di chi ha fatto l'accesso (funzione `delete_my_account` del database)
 * e chiude la sessione su questo dispositivo. Le partite restano sempre, come nomi giocatore e
 * gruppi, senza proprietario.
 */
export async function deleteMyAccount({ deleteDecks }: DeleteAccountChoices): Promise<void> {
  if (!supabase) throw new Error('Database non configurato.');
  const { error } = await supabase.rpc('delete_my_account', { p_delete_decks: deleteDecks });
  if (error) {
    // PGRST202: la funzione non esiste (migrazione non ancora eseguita).
    throw new Error(error.code === 'PGRST202'
      ? 'La cancellazione dell’account non è ancora attiva sul database.'
      : error.message);
  }
  // L'account non esiste più: basta dimenticare la sessione su questo dispositivo.
  await supabase.auth.signOut({ scope: 'local' });
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
