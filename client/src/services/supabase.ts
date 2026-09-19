/**
 * Supabase client for the MTG game log feature (registro partite).
 * Independent from the live game server: this talks directly to Supabase
 * (Postgres + Auth + Realtime), no Go/WebSocket involved.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Table names in the shared Supabase project (see registro-partite-mtg.html)
export const TABLE_GAMES = 'partite';
export const TABLE_PLAYERS = 'giocatori';
export const TABLE_DECKS = 'mazzi';
export const TABLE_GROUPS = 'gruppi';

/** A row is editable by its owner; legacy rows without an owner are editable by anyone. */
export function canEdit(createdBy: string | null | undefined, currentUserId: string | undefined): boolean {
  return !createdBy || createdBy === currentUserId;
}

/** Supabase rifiuta due canali con lo stesso nome: ogni sottoscrizione ne chiede uno suo. */
let channelSeq = 0;

/**
 * Sottoscrive un canale Realtime alle modifiche di una tabella e richiama
 * `onChange` per ogni evento (insert/update/delete), così più dispositivi
 * restano sincronizzati. Restituisce una funzione di cleanup.
 */
export function subscribeToTable(table: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  channelSeq += 1;
  const channel = supabase
    .channel(table + '-live-' + channelSeq)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}
