create or replace function public.test_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'TEST FAILED: %', message; end if; end $$;
select test_assert((select sum(qty)=4 and count(*)=2 from public."mazzi-cards" where deck_id='legacy'),'legacy groups/sections');
begin;
set local role anon;
select public.test_assert((select count(*)=3 from public."mazzi-cards"),'anonymous shared read');
do $$ begin
  begin delete from public.mazzi where id='legacy'; raise exception 'anonymous delete allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.save_deck('anon','Anon','','','[]','[]',null,true); raise exception 'anonymous RPC allowed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';
select public.save_deck('own','Own','brew','Modern','["U"]',
  '[{"name":"Island","qty":2,"scryfall_id":"33333333-3333-4333-8333-333333333333","oracle_id":"44444444-4444-4444-8444-444444444444","image_url":"https://cards.scryfall.io/test.jpg","type_line":"Basic Land — Island"}]',null);
select public.test_assert((select revision=0 and format='Modern' from public.mazzi where id='own'),'create header');
select public.save_deck('own','Own','brew','Modern','["U"]',
  '[{"name":"Island","qty":4,"scryfall_id":"55555555-5555-4555-8555-555555555555","image_url":"https://cards.scryfall.io/other.jpg","type_line":"Land"}]',0);
select public.test_assert((select qty=4 and scryfall_id='33333333-3333-4333-8333-333333333333' from public."mazzi-cards" where deck_id='own'),'quantity preserves assigned printing');
do $$ begin
  begin perform public.save_deck('own','Stale','','','[]','[{"name":"Island","qty":1}]',0,true); raise exception 'stale save allowed';
  exception when serialization_failure then null; end;
  begin perform public.save_deck('other','Hijack','','','[]','[{"name":"Forest","qty":1}]',0,true); raise exception 'other owner allowed';
  exception when insufficient_privilege then null; end;
  begin update public.mazzi set created_by=null where id='own'; raise exception 'ownership reassignment allowed';
  exception when insufficient_privilege then null; end;
  begin update public."mazzi-cards" set scryfall_id='55555555-5555-4555-8555-555555555555' where deck_id='own'; raise exception 'ID replacement allowed';
  exception when check_violation then null; end;
  begin perform public.save_deck('own','Partial','','','[]','[{"name":"Unknown","qty":1}]',1); raise exception 'unresolved strict save allowed';
  exception when check_violation then null; end;
end $$;
select public.test_assert((select name='Own' and revision=1 from public.mazzi where id='own'),'failed save rolled back parent');
select public.test_assert((select qty=4 from public."mazzi-cards" where deck_id='own'),'failed save rolled back child');
-- Old tabs can still update JSON; removed groups are deleted by the same transaction.
update public.mazzi set cards='[{"name":"Island","qty":5},{"name":"Forest","qty":1}]' where id='own';
select public.test_assert((select count(*)=2 and sum(qty)=6 from public."mazzi-cards" where deck_id='own'),'legacy JSON sync');
update public.mazzi set cards='[{"name":"Island","qty":3}]' where id='own';
select public.test_assert((select count(*)=1 and sum(qty)=3 from public."mazzi-cards" where deck_id='own'),'group removal');
-- Ownerless legacy rows are writable by signed-in users.
update public.mazzi set name='Legacy edited' where id='legacy';
select public.test_assert((select name='Legacy edited' from public.mazzi where id='legacy'),'legacy authenticated edit');
set constraints all immediate;
do $$ begin
  begin update public."mazzi-cards" set qty=9 where deck_id='own'; raise exception 'child parity bypass allowed';
  exception when check_violation then null; end;
end $$;
delete from public.mazzi where id='own';
select public.test_assert(not exists(select 1 from public."mazzi-cards" where deck_id='own'),'deck cascade');
commit;

select public.backfill_deck_cards('other',0,'[{"name":"Forest","qty":1}]',
  '[{"name":"Forest","qty":1,"scryfall_id":"33333333-3333-4333-8333-333333333333","oracle_id":"44444444-4444-4444-8444-444444444444","image_url":"https://cards.scryfall.io/test.jpg","type_line":"Basic Land — Forest"}]');
select public.backfill_deck_cards('other',0,'[{"name":"Forest","qty":1}]',
  '[{"name":"Forest","qty":1,"scryfall_id":"55555555-5555-4555-8555-555555555555","image_url":"https://cards.scryfall.io/test.jpg","type_line":"Land"}]');
select public.test_assert((select count(*)=1 and bool_and(scryfall_id='33333333-3333-4333-8333-333333333333') from public."mazzi-cards" where deck_id='other'),'repeat backfill immutable/idempotent');
do $$ begin
  begin perform public.backfill_deck_cards('other',99,'[{"name":"Forest","qty":1}]','[{"name":"Forest","qty":1}]'); raise exception 'stale backfill allowed';
  exception when serialization_failure then null; end;
end $$;

-- Validation failures do not create even a parent row; backfill is not exposed to app users.
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';
do $$ begin
  begin perform public.save_deck('bad','Bad','','','[]','[{"name":"Island","qty":0}]',null,true); raise exception 'zero quantity allowed';
  exception when check_violation then null; end;
  begin perform public.save_deck('bad','Bad','','','[null]','[{"name":"Island","qty":1}]',null,true); raise exception 'null color allowed';
  exception when check_violation then null; end;
  begin perform public.save_deck('deleted','Deleted','','','[]','[{"name":"Island","qty":1}]',0,true); raise exception 'deleted deck recreated';
  exception when no_data_found then null; end;
  begin perform public.backfill_deck_cards('other',0,'[]','[]'); raise exception 'app backfill allowed';
  exception when insufficient_privilege then null; end;
  begin insert into public."mazzi-cards"(deck_id,name,qty,position) values ('missing','Island',1,0); raise exception 'missing parent allowed';
  exception when insufficient_privilege then null; end;
end $$;
select public.test_assert(not exists(select 1 from public.mazzi where id in ('bad','deleted')),'invalid parent rollback');
rollback;
begin;
set local role service_role;
select public.backfill_deck_cards('other',0,'[{"name":"Forest","qty":1}]',
  '[{"name":"Forest","qty":1,"scryfall_id":"33333333-3333-4333-8333-333333333333","image_url":"https://cards.scryfall.io/test.jpg","type_line":"Land"}]');
rollback;
