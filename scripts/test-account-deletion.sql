-- Test fixture only (dopo assert-deck-migration): tabelle e righe per la cancellazione dell'account.
create table public.partite (id text primary key, created_by uuid default auth.uid() references auth.users(id));
create table public.giocatori (name text primary key, created_by uuid default auth.uid() references auth.users(id));
create table public.gruppi (name text primary key, created_by uuid default auth.uid() references auth.users(id));
insert into auth.users values ('33333333-3333-4333-8333-333333333333');
insert into public.mazzi (id,name,cards,created_by) values
  ('a-deck','Del primo','[{"name":"Forest","qty":2}]','11111111-1111-4111-8111-111111111111'),
  ('c-deck','Del terzo','[{"name":"Island","qty":3}]','33333333-3333-4333-8333-333333333333');
insert into public.partite values ('g-a','11111111-1111-4111-8111-111111111111'), ('g-b','22222222-2222-4222-8222-222222222222'), ('g-c','33333333-3333-4333-8333-333333333333');
insert into public.giocatori values ('Alessandro','11111111-1111-4111-8111-111111111111'), ('Andrea','22222222-2222-4222-8222-222222222222');
insert into public.gruppi values ('Pausa pranzo','11111111-1111-4111-8111-111111111111');
