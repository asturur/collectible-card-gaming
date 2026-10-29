-- Incolla questo nell'SQL Editor di Supabase e premi "Run".
-- Cancellazione dell'account dall'app (richiesta anche da App Store e Google Play).
-- Chi cancella l'account sceglie se eliminare anche i mazzi che ha salvato o lasciarli
-- al gruppo. Le partite restano SEMPRE, perché coinvolgono anche gli altri giocatori.
-- Ciò che resta (mazzi lasciati, partite, nomi giocatore, gruppi) rimane senza
-- proprietario, come le righe di prima degli account personali: modificabile da
-- chiunque abbia un account.

-- 1) Il proprietario di un mazzo resta immutabile, tranne quando lo toglie la
--    cancellazione dell'account (segnale impostato solo da delete_my_account).
create or replace function deck_private.guard_deck() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.cards := deck_private.canonical(new.cards);
  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by
      -- coalesce: senza il segnale current_setting vale null, e il controllo deve restare attivo.
      and not (new.created_by is null and coalesce(current_setting('zaff.deleting_account', true), '') = 'on') then
      raise exception 'DECK_OWNER_IMMUTABLE' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
  else
    new.revision := 0;
  end if;
  return new;
end;
$$;

-- 2) Cancella l'account di chi la chiama, dopo aver sistemato i suoi dati.
create or replace function public.delete_my_account(p_delete_decks boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  -- Vale solo fino alla fine di questa operazione.
  perform set_config('zaff.deleting_account', 'on', true);

  if p_delete_decks then
    delete from public.mazzi where created_by = uid;
  else
    update public.mazzi set created_by = null where created_by = uid;
  end if;

  -- Le partite non si eliminano mai: restano nello storico del gruppo.
  update public.partite set created_by = null where created_by = uid;

  update public.giocatori set created_by = null where created_by = uid;
  update public.gruppi set created_by = null where created_by = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.delete_my_account(boolean) to authenticated;
