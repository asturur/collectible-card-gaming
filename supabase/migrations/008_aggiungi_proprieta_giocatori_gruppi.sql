-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Estende la stessa logica di proprietà già applicata a partite e mazzi
-- anche a giocatori e gruppi: da qui in avanti, solo chi crea un nome
-- giocatore o un gruppo può rinominarlo o cancellarlo.
-- Le righe già esistenti (di test, senza proprietario) restano modificabili
-- da chiunque sia loggato, come le altre tabelle.

-- 1) Aggiungo il proprietario
alter table giocatori add column created_by uuid references auth.users(id) default auth.uid();
alter table gruppi add column created_by uuid references auth.users(id) default auth.uid();

-- 2) GIOCATORI: tolgo le regole "chiunque autenticato" per modifica/cancellazione
drop policy if exists "autenticati rinominano giocatori" on giocatori;
drop policy if exists "autenticati cancellano giocatori" on giocatori;

create policy "solo il proprietario rinomina il giocatore" on giocatori
  for update using (created_by is null or created_by = auth.uid())
  with check (created_by is null or created_by = auth.uid());

create policy "solo il proprietario cancella il giocatore" on giocatori
  for delete using (created_by is null or created_by = auth.uid());

-- 3) GRUPPI: stessa logica
drop policy if exists "autenticati rinominano gruppi" on gruppi;
drop policy if exists "autenticati cancellano gruppi" on gruppi;

create policy "solo il proprietario rinomina il gruppo" on gruppi
  for update using (created_by is null or created_by = auth.uid())
  with check (created_by is null or created_by = auth.uid());

create policy "solo il proprietario cancella il gruppo" on gruppi
  for delete using (created_by is null or created_by = auth.uid());
