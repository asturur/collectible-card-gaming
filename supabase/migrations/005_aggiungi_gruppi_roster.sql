-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Crea l'elenco condiviso dei gruppi di gioco, usato dal menu a tendina
-- quando si registra una nuova partita.

create table gruppi (
  name text primary key
);

alter table gruppi enable row level security;

create policy "chiunque puo leggere i gruppi" on gruppi
  for select using (true);

create policy "chiunque puo aggiungere gruppi" on gruppi
  for insert with check (true);

create policy "chiunque puo rinominare gruppi" on gruppi
  for update using (true) with check (true);

create policy "chiunque puo cancellare gruppi" on gruppi
  for delete using (true);

-- Importa i gruppi già usati nelle partite salvate finora, così compaiono
-- subito nel menu anche se non li hai ancora creati esplicitamente.
insert into gruppi (name)
select distinct trim(gruppo)
from partite
where gruppo is not null and trim(gruppo) <> ''
on conflict (name) do nothing;
