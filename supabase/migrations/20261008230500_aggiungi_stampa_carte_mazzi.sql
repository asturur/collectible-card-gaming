-- Espansione (set_code) e numero di collezione (collector_number) delle carte dei mazzi.
-- Additiva e sicura: due colonne facoltative; i mazzi esistenti restano com'erano (valori vuoti).
alter table public."mazzi-cards" add column if not exists set_code text;
alter table public."mazzi-cards" add column if not exists collector_number text;

-- Come prima: la stampa già assegnata non viene mai sostituita. Espansione e numero
-- si compilano solo se mancano e solo se la stampa è quella già salvata.
create or replace function deck_private.attach_metadata(p_deck_id text, p_cards jsonb) returns void
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
      type_line = coalesce(existing.type_line, nullif(e->>'type_line', '')),
      set_code = coalesce(existing.set_code, nullif(e->>'set_code', '')),
      collector_number = coalesce(existing.collector_number, nullif(e->>'collector_number', ''))
    where id = existing.id;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
