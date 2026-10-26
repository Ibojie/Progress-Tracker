-- Phase 3: nightly snapshots (§3.1) for the trend charts and period comparisons.

alter table public.daily_snapshots
  add column overdue_count smallint not null default 0 check (overdue_count >= 0),
  add column abandoned_count smallint not null default 0 check (abandoned_count >= 0),
  add column due_soon_count smallint not null default 0 check (due_soon_count >= 0);

-- The status engine (src/lib/engine) mirrored in SQL for the nightly job.
-- tests/db/engineParity.test.ts checks it gives the same answer as the TypeScript engine.
create or replace function public.engine_element_status(p_element_id uuid, p_today date)
returns table (
  status public.element_status,
  pct smallint,
  goals_total smallint,
  goals_done smallint,
  overdue smallint,
  abandoned smallint,
  due_soon smallint
)
language plpgsql
stable
set search_path = ''
as $$
declare
  e public.elements%rowtype;
  v_total integer;
  v_done integer;
  v_overdue integer;
  v_abandoned integer;
  v_due_soon integer;
  v_start date;
begin
  select * into e from public.elements where id = p_element_id;
  if not found then
    return;
  end if;

  select
    count(*),
    count(*) filter (where g.is_done),
    -- overdue: days 1–7 past due (§4.3); a goal not yet started can't be late since due >= start
    count(*) filter (where not g.is_done and g.start_date <= p_today and p_today - g.due_date between 1 and 7),
    count(*) filter (where not g.is_done and g.start_date <= p_today and p_today - g.due_date > 7),
    count(*) filter (where not g.is_done and g.due_date - p_today between 0 and 14),
    min(g.start_date)
  into v_total, v_done, v_overdue, v_abandoned, v_due_soon, v_start
  from public.goals g
  where g.element_id = p_element_id;

  pct := case when v_total = 0 then 0 else round(v_done * 100.0 / v_total) end;
  goals_total := v_total;
  goals_done := v_done;
  overdue := v_overdue;
  abandoned := v_abandoned;
  due_soon := v_due_soon;

  -- Resolution order (§4.2, §4.6)
  status := case
    when e.is_decommissioned then 'decommissioned'
    when v_total - v_done > 0 and v_abandoned = v_total - v_done then 'abandoned'
    when e.recommissioned_at is not null and not exists (
      select 1 from public.goals g where g.element_id = p_element_id and g.tick_changed_at > e.recommissioned_at
    ) then 'recommissioned'
    when e.restarted_at is not null and not exists (
      select 1 from public.goals g where g.element_id = p_element_id and g.tick_changed_at > e.restarted_at
    ) then 'restarted'
    when v_total > 0 and v_done = v_total then 'completed'
    when v_done > 0 then 'in_progress'
    when v_start is not null and v_start > p_today then 'not_started'
    when e.zero_progress_status = 'resource_delay' then 'resource_delay'
    else 'started'
  end::public.element_status;

  return next;
end;
$$;

-- Writes one snapshot per element for each user's own "today", and records any status change
-- (for example Not Started → Started on a start date) even on days the app isn't opened.
create or replace function public.take_daily_snapshots(p_now timestamptz default now())
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

-- Only the scheduler runs these (as the database owner); nobody can call them through the API.
revoke execute on function public.engine_element_status(uuid, date) from public, anon, authenticated;
revoke execute on function public.take_daily_snapshots(timestamptz) from public, anon, authenticated;

-- Schedule: 23:55 Africa/Lagos = 22:55 UTC (Lagos has no daylight saving).
-- Skipped where pg_cron isn't available (the in-memory test database).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('nightly-snapshots', '55 22 * * *', 'select public.take_daily_snapshots()');
  end if;
end;
$$;
