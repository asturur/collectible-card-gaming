-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Aggiunge ai mazzi il formato (Commander, Standard, ...) per poterli filtrare.
-- I mazzi esistenti restano senza formato (stringa vuota) finché non lo scegli.

alter table mazzi add column if not exists format text not null default '';
