-- Phase 4 (owner request): a tick made offline keeps the time it was tapped, not the time it
-- reached the server, so "goals completed this period" counts it on the right day.

-- The goals trigger now takes the tick time from a transaction-local setting when one is given
-- (only tick_goal below sets it; the API can't call set_config), otherwise it uses now().
create or replace function public.goals_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tick_time timestamptz := coalesce(nullif(current_setting('app.tick_time', true), '')::timestamptz, now());
begin
  if tg_op = 'INSERT' then
    new.original_due_date := new.due_date;
    new.reset_count := 0;
    new.tick_changed_at := null;
    new.done_at := case when new.is_done then now() else null end;
  elsif new.is_done is distinct from old.is_done then
    new.tick_changed_at := v_tick_time;
    new.done_at := case when new.is_done then v_tick_time else null end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Tick or untick one of your own goals, recording when it was tapped on the device.
-- The time is clamped: never in the future, never more than 7 days back (offline data limit).
create or replace function public.tick_goal(p_goal_id uuid, p_is_done boolean, p_ticked_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_time timestamptz := least(greatest(coalesce(p_ticked_at, now()), now() - interval '7 days'), now());
begin
  if v_user is null then
    raise exception 'You need to be signed in.' using errcode = 'insufficient_privilege';
  end if;
  perform set_config('app.tick_time', v_time::text, true);
  update public.goals set is_done = p_is_done where id = p_goal_id and user_id = v_user;
  if not found then
    raise exception 'It no longer exists, or you were signed out. Reload to see the latest.' using errcode = 'no_data_found';
  end if;
  perform set_config('app.tick_time', '', true);
end;
$$;

revoke execute on function public.tick_goal(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.tick_goal(uuid, boolean, timestamptz) to authenticated;
