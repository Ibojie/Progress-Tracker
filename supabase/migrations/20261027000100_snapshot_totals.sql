-- Phase 3 code-review fixes for the snapshot history.

-- 1. Daily totals per category, summed on the server. The app used to download one row per
--    element per day, which the API caps at 1,000 rows. This returns at most days × 4 rows.
-- 2. Only elements that are active NOW are counted, on every past day too, so switching an
--    element off removes it from the history comparisons as well (§4.5, acceptance test 9).
create or replace function public.snapshot_totals(p_from date)
returns table (
  snapshot_date date,
  category_id uuid,
  goals_total integer,
  goals_done integer,
  overdue integer,
  abandoned integer,
  due_soon integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.snapshot_date,
    s.category_id,
    sum(s.goals_total)::integer,
    sum(s.goals_done)::integer,
    sum(s.overdue_count)::integer,
    sum(s.abandoned_count)::integer,
    sum(s.due_soon_count)::integer
  from public.daily_snapshots s
  join public.elements e on e.id = s.element_id
  where s.snapshot_date >= p_from
    and not e.is_decommissioned
  group by s.snapshot_date, s.category_id
  order by s.snapshot_date, s.category_id;
$$;

revoke execute on function public.snapshot_totals(date) from public, anon;
grant execute on function public.snapshot_totals(date) to authenticated;

-- 3. Take each user's snapshot at the end of THEIR day, not at a fixed UTC time.
--    The job now runs hourly and, by default, only snapshots users whose local time is 23:xx.
create or replace function public.take_daily_snapshots(p_now timestamptz default now(), p_end_of_day_only boolean default true)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  el record;
  s record;
  v_today date;
  v_last public.element_status;
  v_count integer := 0;
begin
  for p in select id, timezone from public.profiles loop
    if p_end_of_day_only and extract(hour from (p_now at time zone p.timezone)) <> 23 then
      continue;
    end if;
    v_today := (p_now at time zone p.timezone)::date;
    for el in select id, category_id from public.elements where user_id = p.id loop
      select * into s from public.engine_element_status(el.id, v_today);

      insert into public.daily_snapshots (
        user_id, snapshot_date, category_id, element_id, pct_complete, goals_total, goals_done, status,
        overdue_count, abandoned_count, due_soon_count
      ) values (
        p.id, v_today, el.category_id, el.id, s.pct, s.goals_total, s.goals_done, s.status,
        s.overdue, s.abandoned, s.due_soon
      )
      on conflict (element_id, snapshot_date) do update set
        category_id = excluded.category_id,
        pct_complete = excluded.pct_complete,
        goals_total = excluded.goals_total,
        goals_done = excluded.goals_done,
        status = excluded.status,
        overdue_count = excluded.overdue_count,
        abandoned_count = excluded.abandoned_count,
        due_soon_count = excluded.due_soon_count;

      select se.to_status into v_last from public.status_events se
       where se.element_id = el.id order by se.created_at desc, se.id desc limit 1;
      if v_last is distinct from s.status then
        insert into public.status_events (user_id, element_id, from_status, to_status, reason)
        values (p.id, el.id, v_last, s.status, 'Nightly check');
      end if;

      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

drop function public.take_daily_snapshots(timestamptz);
revoke execute on function public.take_daily_snapshots(timestamptz, boolean) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Same job name: this replaces the 22:55 UTC schedule with an hourly one at :55.
    perform cron.schedule('nightly-snapshots', '55 * * * *', 'select public.take_daily_snapshots()');
  end if;
end;
$$;
