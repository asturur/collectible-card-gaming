-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Introduce gli account personali: da qui in avanti, solo chi crea una
-- partita o un mazzo può modificarlo o cancellarlo. Le righe già esistenti
-- (create prima degli account, senza proprietario) restano modificabili
-- da chiunque sia loggato, per non bloccare la cronologia passata.
-- Giocatori e gruppi restano condivisi: chiunque sia loggato può gestirli.

-- 1) Aggiungo il proprietario a partite e mazzi
alter table partite add column created_by uuid references auth.users(id) default auth.uid();
alter table mazzi add column created_by uuid references auth.users(id) default auth.uid();

-- 2) PARTITE: tolgo le vecchie regole aperte, ne metto di basate sul proprietario
drop policy if exists "chiunque puo scrivere" on partite;
drop policy if exists "chiunque puo modificare" on partite;
drop policy if exists "chiunque puo cancellare" on partite;

create policy "solo autenticati creano partite" on partite
  for insert with check (auth.uid() is not null);

create policy "solo il proprietario modifica la partita" on partite
  for update using (created_by is null or created_by = auth.uid());

create policy "solo il proprietario cancella la partita" on partite
  for delete using (created_by is null or created_by = auth.uid());

-- 3) MAZZI: stessa identica logica
drop policy if exists "chiunque puo creare mazzi" on mazzi;
drop policy if exists "chiunque puo modificare mazzi" on mazzi;
drop policy if exists "chiunque puo cancellare mazzi" on mazzi;

create policy "solo autenticati creano mazzi" on mazzi
  for insert with check (auth.uid() is not null);

create policy "solo il proprietario modifica il mazzo" on mazzi
  for update using (created_by is null or created_by = auth.uid());

create policy "solo il proprietario cancella il mazzo" on mazzi
  for delete using (created_by is null or created_by = auth.uid());

-- 4) GIOCATORI: restano condivisi, ma serve essere loggati per scriverli
drop policy if exists "chiunque puo aggiungere giocatori" on giocatori;
drop policy if exists "chiunque puo rinominare giocatori" on giocatori;
drop policy if exists "chiunque puo cancellare giocatori" on giocatori;

create policy "autenticati aggiungono giocatori" on giocatori
  for insert with check (auth.uid() is not null);
create policy "autenticati rinominano giocatori" on giocatori
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "autenticati cancellano giocatori" on giocatori
  for delete using (auth.uid() is not null);

-- 5) GRUPPI: stessa logica dei giocatori
drop policy if exists "chiunque puo aggiungere gruppi" on gruppi;
drop policy if exists "chiunque puo rinominare gruppi" on gruppi;
drop policy if exists "chiunque puo cancellare gruppi" on gruppi;

create policy "autenticati aggiungono gruppi" on gruppi
  for insert with check (auth.uid() is not null);
create policy "autenticati rinominano gruppi" on gruppi
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "autenticati cancellano gruppi" on gruppi
  for delete using (auth.uid() is not null);
