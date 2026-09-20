-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- La tabella "giocatori" aveva solo il permesso di lettura e aggiunta:
-- mancavano i permessi per rinominare o cancellare un nome, motivo per cui
-- la rinomina dei giocatori non veniva salvata nel database.

create policy "chiunque puo rinominare giocatori" on giocatori
  for update using (true) with check (true);

create policy "chiunque puo cancellare giocatori" on giocatori
  for delete using (true);
