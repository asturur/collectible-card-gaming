-- Additive rollout: mazzi.cards remains the compatibility source of names/qty/sections.
create schema if not exists deck_private;
revoke all on schema deck_private from public;
grant usage on schema deck_private to authenticated, service_role;

alter table public.mazzi add column revision bigint not null default 0;

create table public."mazzi-cards" (
  id uuid primary key default gen_random_uuid(),
  deck_id text not null references public.mazzi(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  qty integer not null check (qty > 0),
  section text not null default 'main' check (section in ('main', 'side')),
  position integer not null check (position >= 0),
  scryfall_id uuid,
  oracle_id uuid,
  image_url text,
  type_line text,
  constraint deck_card_metadata check (
    (scryfall_id is null and oracle_id is null and image_url is null and type_line is null)
    or (scryfall_id is not null and image_url is not null
      and image_url like 'https://cards.scryfall.io/%'
      and type_line is not null and btrim(type_line) <> '')
  )
);
create unique index deck_cards_group on public."mazzi-cards" (deck_id, section, lower(btrim(name)));
create index deck_cards_order on public."mazzi-cards" (deck_id, position);
alter table public."mazzi-cards" enable row level security;

-- Validate first, then aggregate groups exactly as the import/editor does.
create function deck_private.entries(p_cards jsonb)
returns table(name text, qty integer, section text, "position" integer)
language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    raise exception 'DECK_INVALID_CARDS' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_cards) e
    where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'name') is distinct from 'string'
      or coalesce(btrim(e->>'name'), '') = ''
      or jsonb_typeof(e->'qty') is distinct from 'number'
      or coalesce(e->>'qty', '') !~ '^[1-9][0-9]*$'
      or coalesce(e->>'section', 'main') not in ('main', 'side')
  ) then
    raise exception 'DECK_INVALID_ENTRY' using errcode = '23514';
  end if;
  return query
    select (array_agg(btrim(e->>'name') order by ord))[1],
      sum((e->>'qty')::bigint)::integer, coalesce(e->>'section', 'main'), (min(ord)-1)::integer
    from jsonb_array_elements(p_cards) with ordinality a(e, ord)
    group by lower(btrim(e->>'name')), coalesce(e->>'section', 'main')
    order by min(ord);
end;
$$;

create function deck_private.canonical(p_cards jsonb) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', e.name, 'qty', e.qty, 'section', e.section)
    order by e.position), '[]'::jsonb) from deck_private.entries(p_cards) e;
$$;

create function deck_private.guard_deck() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.cards := deck_private.canonical(new.cards);
  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'DECK_OWNER_IMMUTABLE' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
  else
    new.revision := 0;
  end if;
  return new;
end;
$$;
create trigger deck_guard before insert or update on public.mazzi
for each row execute function deck_private.guard_deck();

create function deck_private.guard_entry() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare parent_id text;
begin
  parent_id := case when tg_op = 'DELETE' then old.deck_id else new.deck_id end;
  -- Serialize child changes with the parent save. A cascade has already removed its parent.
  perform 1 from public.mazzi where id = parent_id for update;
  if not found and tg_op <> 'DELETE' then
    raise exception 'DECK_DELETED_OR_NOT_EDITABLE' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.deck_id is distinct from old.deck_id then
      raise exception 'DECK_CARD_PARENT_IMMUTABLE' using errcode = '42501';
    end if;
    if (old.scryfall_id is not null and new.scryfall_id is distinct from old.scryfall_id)
      or (old.oracle_id is not null and new.oracle_id is distinct from old.oracle_id)
      or (old.scryfall_id is not null and lower(btrim(new.name)) <> lower(btrim(old.name))) then
      raise exception 'DECK_CARD_IDENTITY_IMMUTABLE' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger deck_entry_guard before insert or update or delete on public."mazzi-cards"
for each row execute function deck_private.guard_entry();

create function deck_private.sync_entries() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public."mazzi-cards" c where c.deck_id = new.id and not exists (
    select 1 from deck_private.entries(new.cards) e
    where e.section = c.section and lower(btrim(e.name)) = lower(btrim(c.name))
  );
  insert into public."mazzi-cards" (deck_id, name, qty, section, position)
    select new.id, e.name, e.qty, e.section, e.position from deck_private.entries(new.cards) e
    on conflict (deck_id, section, (lower(btrim(name)))) do update
      set name = excluded.name, qty = excluded.qty, position = excluded.position;
  return new;
end;
$$;
create trigger deck_sync after insert or update of cards on public.mazzi
for each row execute function deck_private.sync_entries();

create function deck_private.check_parity() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare parent_id text; expected jsonb; actual jsonb;
begin
  if tg_table_name = 'mazzi' then
    parent_id := new.id;
  elsif tg_op = 'DELETE' then
    parent_id := old.deck_id;
  else
    parent_id := new.deck_id;
  end if;
  select deck_private.canonical(cards) into expected from public.mazzi where id = parent_id;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'section', section)
    order by position), '[]'::jsonb) into actual from public."mazzi-cards" where deck_id = parent_id;
  if expected is distinct from actual then
    raise exception 'DECK_CARD_JSON_PARITY' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger deck_entry_parity after insert or update or delete on public."mazzi-cards"
deferrable initially deferred for each row execute function deck_private.check_parity();
create constraint trigger deck_parent_parity after insert or update on public.mazzi
deferrable initially deferred for each row execute function deck_private.check_parity();

-- Never replace assigned IDs. Metadata from a different later printing is ignored.
create function deck_private.attach_metadata(p_deck_id text, p_cards jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare e jsonb; existing public."mazzi-cards"; printing uuid;
begin
  for e in select value from jsonb_array_elements(p_cards) loop
    printing := nullif(e->>'scryfall_id', '')::uuid;
    if printing is null then continue; end if;
    select * into existing from public."mazzi-cards" c where c.deck_id = p_deck_id
      and c.section = coalesce(e->>'section', 'main') and lower(btrim(c.name)) = lower(btrim(e->>'name'));
    if not found then raise exception 'DECK_ENTRY_CHANGED' using errcode = '40001'; end if;
    if existing.scryfall_id is not null and existing.scryfall_id <> printing then continue; end if;
    update public."mazzi-cards" set
      scryfall_id = coalesce(existing.scryfall_id, printing),
      oracle_id = coalesce(existing.oracle_id, nullif(e->>'oracle_id', '')::uuid),
      image_url = coalesce(existing.image_url, nullif(e->>'image_url', '')),
      type_line = coalesce(existing.type_line, nullif(e->>'type_line', ''))
    where id = existing.id;
  end loop;
end;
$$;

create function public.save_deck(
  p_deck_id text, p_name text, p_source text, p_format text, p_colors jsonb,
  p_cards jsonb, p_expected_revision bigint, p_allow_unresolved boolean default false
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.mazzi; saved public.mazzi; normalized jsonb;
begin
  if auth.uid() is null then raise exception 'DECK_LOGIN_REQUIRED' using errcode = '42501'; end if;
  if coalesce(btrim(p_name), '') = '' or length(btrim(p_name)) > 80
    or coalesce(btrim(p_deck_id), '') = '' then
    raise exception 'DECK_INVALID_NAME' using errcode = '23514';
  end if;
  if p_colors is null or jsonb_typeof(p_colors) <> 'array' or exists (
    select 1 from jsonb_array_elements_text(p_colors) c where c is null or c not in ('W','U','B','R','G')
  ) then raise exception 'DECK_INVALID_COLORS' using errcode = '23514'; end if;
  normalized := deck_private.canonical(p_cards);
  if jsonb_array_length(normalized) = 0 then raise exception 'DECK_EMPTY' using errcode = '23514'; end if;
  -- Public reads must not allow editing another user's deck. Lock after the explicit owner check.
  select * into existing from public.mazzi where id = p_deck_id;
  if found then
    if existing.created_by is not null and existing.created_by <> auth.uid() then
      raise exception 'DECK_NOT_EDITABLE' using errcode = '42501';
    end if;
    select * into existing from public.mazzi where id = p_deck_id for update;
    if not found then raise exception 'DECK_DELETED' using errcode = 'P0002'; end if;
    if p_expected_revision is null or existing.revision <> p_expected_revision then
      raise exception 'DECK_CONFLICT' using errcode = '40001';
    end if;
    update public.mazzi set name = btrim(p_name), source = coalesce(p_source,''),
      format = coalesce(p_format,''), colors = p_colors, cards = normalized
      where id = p_deck_id returning * into saved;
  else
    if p_expected_revision is not null then raise exception 'DECK_DELETED' using errcode = 'P0002'; end if;
    insert into public.mazzi (id,name,source,format,colors,cards,created_by)
      values (p_deck_id,btrim(p_name),coalesce(p_source,''),coalesce(p_format,''),p_colors,normalized,auth.uid())
      returning * into saved;
  end if;
  perform deck_private.attach_metadata(p_deck_id, p_cards);
  if not p_allow_unresolved and exists (
    select 1 from public."mazzi-cards" where deck_id = p_deck_id and scryfall_id is null
  ) then raise exception 'DECK_UNRESOLVED' using errcode = '23514'; end if;
  return to_jsonb(saved) - 'cards';
end;
$$;

-- Off-browser backfill only; optimistic checks prevent applying a stale snapshot.
create function public.backfill_deck_cards(
  p_deck_id text, p_expected_revision bigint, p_expected_cards jsonb, p_cards jsonb
) returns integer language plpgsql security invoker set search_path = '' as $$
declare current_deck public.mazzi; enriched integer;
begin
  select * into current_deck from public.mazzi where id = p_deck_id for update;
  if not found or current_deck.revision <> p_expected_revision
    or deck_private.canonical(current_deck.cards) <> deck_private.canonical(p_expected_cards)
    or deck_private.canonical(p_cards) <> deck_private.canonical(p_expected_cards) then
    raise exception 'DECK_BACKFILL_CONFLICT' using errcode = '40001';
  end if;
  perform deck_private.attach_metadata(p_deck_id, p_cards);
  select count(*) into enriched from public."mazzi-cards" where deck_id = p_deck_id and scryfall_id is not null;
  return enriched;
end;
$$;

-- Structural backfill preserves the original JSON. No network calls occur in SQL.
insert into public."mazzi-cards" (deck_id,name,qty,section,position)
  select m.id,e.name,e.qty,e.section,e.position from public.mazzi m
  cross join lateral deck_private.entries(m.cards) e;

-- Replace only this table's legacy policies, including anonymous ownerless writes.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'mazzi' loop
    execute format('drop policy %I on public.mazzi', p.policyname);
  end loop;
end $$;
alter table public.mazzi enable row level security;
revoke all on public.mazzi, public."mazzi-cards" from anon, authenticated;
grant select on public.mazzi, public."mazzi-cards" to anon;
grant select, insert, update, delete on public.mazzi, public."mazzi-cards" to authenticated, service_role;
create policy decks_read on public.mazzi for select to anon, authenticated using (true);
create policy decks_insert on public.mazzi for insert to authenticated
with check ((select auth.uid()) is not null and created_by = (select auth.uid()));
create policy decks_update on public.mazzi for update to authenticated
using ((select auth.uid()) is not null and (created_by is null or created_by = (select auth.uid())))
with check ((select auth.uid()) is not null and (created_by is null or created_by = (select auth.uid())));
create policy decks_delete on public.mazzi for delete to authenticated
using ((select auth.uid()) is not null and (created_by is null or created_by = (select auth.uid())));
create policy deck_cards_read on public."mazzi-cards" for select to anon, authenticated using (true);
create policy deck_cards_insert on public."mazzi-cards" for insert to authenticated with check (
  (select auth.uid()) is not null and exists (select 1 from public.mazzi m where m.id = deck_id
    and (m.created_by is null or m.created_by = (select auth.uid())))
);
create policy deck_cards_update on public."mazzi-cards" for update to authenticated using (
  (select auth.uid()) is not null and exists (select 1 from public.mazzi m where m.id = deck_id
    and (m.created_by is null or m.created_by = (select auth.uid())))
) with check (
  (select auth.uid()) is not null and exists (select 1 from public.mazzi m where m.id = deck_id
    and (m.created_by is null or m.created_by = (select auth.uid())))
);
create policy deck_cards_delete on public."mazzi-cards" for delete to authenticated using (
  (select auth.uid()) is not null and exists (select 1 from public.mazzi m where m.id = deck_id
    and (m.created_by is null or m.created_by = (select auth.uid())))
);

revoke execute on all functions in schema deck_private from public;
grant execute on all functions in schema deck_private to authenticated, service_role;
revoke all on function public.save_deck(text,text,text,text,jsonb,jsonb,bigint,boolean) from public, anon;
grant execute on function public.save_deck(text,text,text,text,jsonb,jsonb,bigint,boolean) to authenticated;
revoke all on function public.backfill_deck_cards(text,bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.backfill_deck_cards(text,bigint,jsonb,jsonb) to service_role;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'mazzi') then
      alter publication supabase_realtime add table public.mazzi;
    end if;
    alter publication supabase_realtime add table public."mazzi-cards";
  end if;
end $$;
notify pgrst, 'reload schema';
