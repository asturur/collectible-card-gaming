-- Cancellazione dell'account: mazzi a scelta, partite sempre conservate, proprietario dei mazzi protetto.
\set ON_ERROR_STOP 1
-- 1) Account e basta: mazzi lasciati al gruppo, partite sempre.
begin; set local role authenticated; set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.delete_my_account(false); commit;
do $$ begin
  assert not exists (select 1 from auth.users where id = '11111111-1111-4111-8111-111111111111'), 'account 1 cancellato';
  assert (select created_by from public.mazzi where id = 'a-deck') is null, 'mazzo lasciato senza proprietario';
  assert (select count(*) from public."mazzi-cards" where deck_id = 'a-deck') = 1, 'carte del mazzo lasciato intatte';
  assert (select created_by from public.partite where id = 'g-a') is null, 'partita restata senza proprietario';
  assert (select created_by from public.partite where id = 'g-b') = '22222222-2222-4222-8222-222222222222', 'partite altrui intatte';
  assert (select created_by from public.giocatori where name = 'Alessandro') is null, 'nome giocatore restato';
  assert (select created_by from public.giocatori where name = 'Andrea') is not null, 'nomi altrui intatti';
  assert (select created_by from public.gruppi where name = 'Pausa pranzo') is null, 'gruppo restato';
end $$;
-- 2) Account e mazzi: i mazzi spariscono (con le loro carte), le partite restano.
begin; set local role authenticated; set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select public.delete_my_account(true); commit;
do $$ begin
  assert not exists (select 1 from public.mazzi where id = 'c-deck'), 'mazzo eliminato';
  assert not exists (select 1 from public."mazzi-cards" where deck_id = 'c-deck'), 'carte del mazzo eliminate';
  assert exists (select 1 from public.partite where id = 'g-c' and created_by is null), 'partita restata';
  assert exists (select 1 from public.mazzi where id = 'other'), 'mazzi altrui intatti';
end $$;
-- 3) Fuori dalla cancellazione il proprietario di un mazzo resta immutabile.
do $$ begin
  begin
    update public.mazzi set created_by = null where id = 'other';
    raise exception 'doveva essere bloccato';
  exception when insufficient_privilege then null;
  end;
end $$;
-- 4) Senza accesso non si può chiamare.
do $$ begin
  begin
    set local role anon;
    perform public.delete_my_account(false);
    raise exception 'anon non doveva poterla chiamare';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'TUTTI I CONTROLLI SUPERATI' as esito;
