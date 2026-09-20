-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Crea la tabella dove vengono salvati i mazzi (nome + elenco carte con copie).

create table mazzi (
  id text primary key,
  name text not null,
  cards jsonb not null default '[]',
  created_at timestamptz default now()
);

alter table mazzi enable row level security;

create policy "chiunque puo leggere i mazzi" on mazzi
  for select using (true);

create policy "chiunque puo creare mazzi" on mazzi
  for insert with check (true);

create policy "chiunque puo modificare mazzi" on mazzi
  for update using (true);

create policy "chiunque puo cancellare mazzi" on mazzi
  for delete using (true);
