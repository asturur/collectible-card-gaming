-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Aggiunge ai mazzi l'elenco dei colori mana (W/U/B/R/G) che li identificano.

alter table mazzi add column if not exists colors jsonb not null default '[]';
