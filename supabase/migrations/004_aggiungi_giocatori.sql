-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Crea l'elenco condiviso dei giocatori, usato dal menu a tendina
-- quando si registra una partita (evita che "Ale", "ale", "alex"
-- diventino per errore tre giocatori diversi).

create table giocatori (
  name text primary key
);

alter table giocatori enable row level security;

create policy "chiunque puo leggere i giocatori" on giocatori
  for select using (true);

create policy "chiunque puo aggiungere giocatori" on giocatori
  for insert with check (true);

-- Importa automaticamente i nomi già usati nelle partite salvate finora,
-- così le partite vecchie continuano a funzionare nel menu a tendina.
-- Se tra questi ci sono doppioni per errori di battitura (es. "Ale" e "ale"),
-- compariranno entrambi: potrai correggerli aprendo quelle partite vecchie
-- con "Modifica" e scegliendo il nome giusto dal menu.
insert into giocatori (name)
select distinct trim(elem->>'name')
from partite, jsonb_array_elements(players) as elem
where trim(elem->>'name') <> ''
on conflict (name) do nothing;
