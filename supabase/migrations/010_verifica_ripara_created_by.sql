-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Aggiunge la colonna "created_by" a giocatori e gruppi SOLO se manca
-- (sicura da eseguire anche se esistesse già, non fa nulla in quel caso).
-- Serve a riparare la migrazione precedente se non fosse andata a buon fine
-- su una di queste due tabelle.

alter table giocatori add column if not exists created_by uuid references auth.users(id) default auth.uid();
alter table gruppi add column if not exists created_by uuid references auth.users(id) default auth.uid();
