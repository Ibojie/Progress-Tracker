-- Phase 6: AI weekly narrative (§7.2). The database prepares a compact, anonymous summary of
-- the user's progress; the Edge Functions send only that to Claude and store the reply here.

-- 'weekly' = the Monday run, 'manual' = the Refresh insight button (5 a day).
alter table public.ai_summaries
  add column trigger text not null default 'manual' check (trigger in ('weekly', 'manual'));

create index ai_summaries_user_trigger_idx on public.ai_summaries (user_id, trigger, created_at desc);

-- Every attempt to write an insight, successful or not. Limits count attempts, so a failing
-- or refused request can't be retried without end. Server only: no policies for users.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger text not null check (trigger in ('weekly', 'manual')),
  used_on date not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_day_idx on public.ai_usage (user_id, trigger, used_on);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- ---------------------------------------------------------------- what Claude sees
-- Category and element names, % complete, status, urgency band, days left, pace and the
-- week-on-week counts. No goal titles, notes, emails or ids (§7.2: "send no other personal data").
-- Bands and pace mirror src/lib/engine/bands.ts and pace.ts.
create or replace function public.ai_summary_input(p_user uuid, p_today date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_result jsonb;
begin
  select timezone into v_tz from public.profiles where id = p_user;
  if v_tz is null then
    return null;
  end if;

  with els as (
    select e.id, e.name, c.name as category, c.sort_order as category_order, s.*,
           (select min(g.due_date) - p_today from public.goals g where g.element_id = e.id and not g.is_done) as days_left,
           (select round(avg(case
                     when g.due_date <= g.start_date then case when p_today >= g.start_date then 1 else 0 end
                     else least(1, greatest(0, (p_today - g.start_date)::numeric / (g.due_date - g.start_date)))
                   end) * 100)
              from public.goals g where g.element_id = e.id) as expected_pct
      from public.elements e
      join public.categories c on c.id = e.category_id
      cross join lateral public.engine_element_status(e.id, p_today) s
     where e.user_id = p_user and not e.is_decommissioned
  ),
  live_goals as (
    select g.* from public.goals g
      join public.elements e on e.id = g.element_id
     where g.user_id = p_user and not e.is_decommissioned
  )
  select jsonb_build_object(
    'today', p_today,
    'week', jsonb_build_object(
      'goals_completed', (select count(*) from live_goals
                           where is_done and (done_at at time zone v_tz)::date between p_today - 7 and p_today - 1),
      'goals_completed_week_before', (select count(*) from live_goals
                           where is_done and (done_at at time zone v_tz)::date between p_today - 14 and p_today - 8),
      'overall_pct', (select case when count(*) = 0 then 0 else round(count(*) filter (where is_done) * 100.0 / count(*)) end from live_goals),
      'overdue_goals', (select count(*) from live_goals
                         where not is_done and start_date <= p_today and p_today - due_date between 1 and 7),
      'abandoned_goals', (select count(*) from live_goals
                           where not is_done and start_date <= p_today and p_today - due_date > 7)
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', c.name,
               'pct', (select case when sum(x.goals_total) = 0 then 0 else round(sum(x.goals_done) * 100.0 / sum(x.goals_total)) end
                         from els x where x.category = c.name),
               'elements', (select count(*) from els x where x.category = c.name)
             ) order by c.sort_order)
        from public.categories c where c.user_id = p_user
    ), '[]'::jsonb),
    'elements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', x.name,
               'category', x.category,
               'pct', x.pct,
               'status', x.status,
               'days_left', x.days_left,
               'band', case
                 when x.days_left is null then null
                 when x.days_left < 0 then 'overdue'
                 when x.days_left <= 14 then 'immediate'
                 when x.days_left <= 29 then 'short'
                 when x.days_left <= 59 then 'medium'
                 else 'long' end,
               'pace', case
                 when x.status = 'completed' then 'n/a'
                 when x.pct < x.expected_pct - 15 then 'behind'
                 else 'on track' end
             ) order by x.days_left nulls last, x.category_order, x.name)
        from els x
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------- limits and schedule
-- Refresh insight: at most 5 attempts per user per day (in the user's timezone).
create or replace function public.ai_manual_left(p_user uuid, p_now timestamptz default now())
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, 5 - count(*))::integer
    from public.ai_usage u
    join public.profiles p on p.id = u.user_id
   where u.user_id = p_user and u.trigger = 'manual'
     and u.used_on = (p_now at time zone p.timezone)::date
$$;

-- Takes one attempt before Claude is called. The user's profile row is locked, so parallel
-- requests queue up and can't all see "5 left". Returns the attempts left after this one,
-- or -1 when the limit (5 manual a day, 3 weekly tries a Monday) is already used up.
create or replace function public.ai_claim(p_user uuid, p_trigger text, p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_used integer;
  v_limit integer := case p_trigger when 'manual' then 5 when 'weekly' then 3 end;
begin
  if v_limit is null then
    raise exception 'unknown trigger %', p_trigger;
  end if;
  select (p_now at time zone timezone)::date into v_today from public.profiles where id = p_user for update;
  if v_today is null then
    return -1;
  end if;
  select count(*) into v_used from public.ai_usage where user_id = p_user and trigger = p_trigger and used_on = v_today;
  if v_used >= v_limit then
    return -1;
  end if;
  insert into public.ai_usage (user_id, trigger, used_on) values (p_user, p_trigger, v_today);
  return v_limit - v_used - 1;
end;
$$;

-- Users due a Monday summary: AI switched on, Monday in their timezone, past their send hour
-- (07:00 or after quiet hours, like the reminders), outside quiet hours, none written yet today,
-- and fewer than 3 tries so far (a failing call is retried on the next two hourly runs, then left).
create or replace function public.ai_weekly_due(p_now timestamptz default now())
returns table (user_id uuid, today date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, (p_now at time zone p.timezone)::date
    from public.profiles p
   where p.ai_summary_enabled
     and extract(isodow from (p_now at time zone p.timezone)) = 1
     and extract(hour from (p_now at time zone p.timezone)) >= public.notify_send_hour(p.quiet_hours_start, p.quiet_hours_end)
     and not public.notify_in_quiet((p_now at time zone p.timezone)::time, p.quiet_hours_start, p.quiet_hours_end)
     and exists (select 1 from public.elements e where e.user_id = p.id and not e.is_decommissioned)
     and not exists (
       select 1 from public.ai_summaries a
        where a.user_id = p.id and a.trigger = 'weekly'
          and a.period_end = (p_now at time zone p.timezone)::date
     )
     and (select count(*) from public.ai_usage u
           where u.user_id = p.id and u.trigger = 'weekly' and u.used_on = (p_now at time zone p.timezone)::date) < 3
$$;

-- The latest summary written for the digest's week (the Monday it belongs to), if any.
create or replace function public.ai_weekly_for(p_user uuid, p_today date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select content_md from public.ai_summaries
   where user_id = p_user and period_end = p_today
   order by created_at desc limit 1
$$;

revoke execute on function public.ai_summary_input(uuid, date) from public, anon, authenticated;
revoke execute on function public.ai_manual_left(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.ai_weekly_due(timestamptz) from public, anon, authenticated;
revoke execute on function public.ai_claim(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.ai_weekly_for(uuid, date) from public, anon, authenticated;
grant execute on function public.ai_summary_input(uuid, date) to service_role;
grant execute on function public.ai_manual_left(uuid, timestamptz) to service_role;
grant execute on function public.ai_weekly_due(timestamptz) to service_role;
grant execute on function public.ai_claim(uuid, text, timestamptz) to service_role;
grant execute on function public.ai_weekly_for(uuid, date) to service_role;
