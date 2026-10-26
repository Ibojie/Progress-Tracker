-- Phase 2 code-review fixes.

-- 1. Switch-off / switch-on times come from the server clock, so they compare correctly
--    with tick times (also server-set). The client only flips is_decommissioned.
create or replace function public.elements_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_decommissioned and not old.is_decommissioned then
    new.decommissioned_at := now();
  elsif not new.is_decommissioned and old.is_decommissioned then
    new.recommissioned_at := now();
  end if;
  return new;
end;
$$;

create trigger elements_before_update before update on public.elements
  for each row execute function public.elements_before_update();

-- The client may only write an element's own content; timestamps are set by the database.
revoke insert, update on public.elements from authenticated;
grant insert (category_id, name, description, zero_progress_status, sort_order) on public.elements to authenticated;
grant update (name, description, zero_progress_status, is_decommissioned, sort_order) on public.elements to authenticated;

-- 2. Reset history can only be written by reset_goal_date.
drop policy "goal_date_resets: insert own" on public.goal_date_resets;
revoke insert on public.goal_date_resets from authenticated;

-- 3. Two open tabs or devices can't log the same status change twice in a row.
create or replace function public.status_events_skip_repeat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.element_id::text, 0));
  if new.to_status = (
    select e.to_status from public.status_events e
    where e.element_id = new.element_id
    order by e.created_at desc, e.id desc
    limit 1
  ) then
    return null; -- same as the latest entry: silently skip
  end if;
  return new;
end;
$$;

create trigger status_events_skip_repeat before insert on public.status_events
  for each row execute function public.status_events_skip_repeat();

-- 4. Only real timezone names are accepted.
create or replace function public.profiles_check_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone "%".', new.timezone using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_check_timezone before insert or update of timezone on public.profiles
  for each row execute function public.profiles_check_timezone();

-- 5. Swap two goals' positions in one transaction (no half-finished reorder).
create or replace function public.swap_goal_order(p_goal_a uuid, p_goal_b uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a public.goals%rowtype;
  b public.goals%rowtype;
begin
  select * into a from public.goals where id = p_goal_a for update;
  select * into b from public.goals where id = p_goal_b for update;
  if a.id is null or b.id is null or a.element_id <> b.element_id then
    raise exception 'Goals not found in the same element.' using errcode = 'no_data_found';
  end if;
  if a.sort_order = b.sort_order then
    -- Positions collided earlier; give the pair distinct ones while swapping.
    update public.goals set sort_order = b.sort_order + 1 where id = a.id;
    update public.goals set sort_order = a.sort_order where id = b.id;
  else
    update public.goals set sort_order = b.sort_order where id = a.id;
    update public.goals set sort_order = a.sort_order where id = b.id;
  end if;
end;
$$;

revoke execute on function public.swap_goal_order(uuid, uuid) from public, anon;
grant execute on function public.swap_goal_order(uuid, uuid) to authenticated;
