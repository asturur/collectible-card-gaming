-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Aggiunge il campo "source" ai mazzi, per distinguere i mazzi Precon
-- (importati "di fabbrica") da quelli Homebrew (costruiti carta per carta).
-- I mazzi già salvati finora restano "non specificato": potrai classificarli
-- in un secondo momento aprendoli con "Modifica".

alter table mazzi add column source text;
