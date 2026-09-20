-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Aggiunge la colonna "gruppo" alla tabella partite che hai già creato.
-- Le partite salvate finora non hanno un gruppo: le mostreremo come "Generale".

alter table partite add column gruppo text;
