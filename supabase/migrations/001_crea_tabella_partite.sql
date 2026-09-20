-- Incolla tutto questo nell'SQL Editor di Supabase e premi "Run".
-- Crea la tabella che conterrà le partite di tutto il gruppo.

create table partite (
  id text primary key,
  date date not null,
  format text,
  notes text,
  players jsonb not null default '[]',
  created_at timestamptz default now()
);

-- Permette al sito (senza login) di leggere e scrivere le partite.
-- Adatto a un link privato condiviso solo tra amici: chiunque abbia
-- il link può leggere e modificare il registro.
alter table partite enable row level security;

create policy "chiunque puo leggere" on partite
  for select using (true);

create policy "chiunque puo scrivere" on partite
  for insert with check (true);

create policy "chiunque puo modificare" on partite
  for update using (true);

create policy "chiunque puo cancellare" on partite
  for delete using (true);
