-- Phase 5: notifications (§9). The database decides what to send and when; the `notify`
-- Edge Function only delivers what is queued here (push and email) and records the result.

-- ---------------------------------------------------------------- notification_log additions
alter table public.notification_log
  add column link text check (char_length(link) <= 300),
  -- Push and email rows wait here until the Edge Function delivers them. In-app rows are
  -- delivered the moment they're written.
  add column delivered_at timestamptz,
  add column claimed_at timestamptz,
  add column attempts smallint not null default 0,
  add column last_error text check (char_length(last_error) <= 500);

create index notification_log_pending_idx on public.notification_log (sent_at)
  where delivered_at is null and channel <> 'in_app';
create index notification_log_unread_idx on public.notification_log (user_id)
  where channel = 'in_app' and read_at is null;

-- ---------------------------------------------------------------- send hour
-- Alerts go out at 07:00 in the user's own timezone. If quiet hours cover 07:00, they wait
-- until the hour quiet hours end (rounded up to the next whole hour).
create or replace function public.notify_send_hour(p_quiet_start time, p_quiet_end time)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_quiet_start is null or p_quiet_end is null or p_quiet_start = p_quiet_end then 7
    when (p_quiet_start < p_quiet_end and time '07:00' >= p_quiet_start and time '07:00' < p_quiet_end)
      or (p_quiet_start > p_quiet_end and (time '07:00' >= p_quiet_start or time '07:00' < p_quiet_end))
      then (extract(hour from p_quiet_end)::int + case when extract(minute from p_quiet_end) > 0 then 1 else 0 end) % 24
    else 7
  end::smallint
$$;

-- True when a local time falls inside quiet hours (a window may cross midnight; the end is exclusive).
create or replace function public.notify_in_quiet(p_local time, p_quiet_start time, p_quiet_end time)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_quiet_start is null or p_quiet_end is null or p_quiet_start = p_quiet_end then false
    when p_quiet_start < p_quiet_end then p_local >= p_quiet_start and p_local < p_quiet_end
    else p_local >= p_quiet_start or p_local < p_quiet_end
  end
$$;

-- ---------------------------------------------------------------- queue alerts
-- Writes every alert due for users whose local time has reached their send hour (and isn't in
-- quiet hours). Later runs the same day catch up if an earlier one failed. The unique key on
-- notification_log (user, goal, element, kind, channel, day) means re-running never duplicates.
create or replace function public.queue_notifications(p_now timestamptz default now(), p_send_hour_only boolean default true)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  g record;
  el record;
  s record;
  v_today date;
  v_left integer;
  v_kind text;
  v_title text;
  v_body text;
  v_link text;
  v_push boolean;
  v_email boolean;
  v_in_app boolean;
  v_want_push boolean;
  v_want_email boolean;
  v_count integer := 0;
  v_rows integer;
  v_since timestamptz;
  v_last_tick timestamptz;
  v_start timestamptz;
  v_status_since timestamptz;
begin
  for p in
    select pr.id, pr.timezone, pr.push_enabled, pr.email_digest_enabled, pr.in_app_enabled,
           pr.quiet_hours_start, pr.quiet_hours_end,
           exists (select 1 from public.push_subscriptions ps where ps.user_id = pr.id) as has_device
      from public.profiles pr
  loop
    if p_send_hour_only and (
         extract(hour from (p_now at time zone p.timezone)) < public.notify_send_hour(p.quiet_hours_start, p.quiet_hours_end)
         or public.notify_in_quiet((p_now at time zone p.timezone)::time, p.quiet_hours_start, p.quiet_hours_end)
       ) then
      continue;
    end if;
    v_today := (p_now at time zone p.timezone)::date;
    v_push := p.push_enabled and p.has_device;
    v_email := p.email_digest_enabled;
    v_in_app := p.in_app_enabled;

    -- Goal alerts: open goals of switched-on elements.
    for g in
      select gl.id, gl.title, gl.due_date, gl.start_date, e.id as element_id, e.name as element_name
        from public.goals gl
        join public.elements e on e.id = gl.element_id
       where gl.user_id = p.id and not gl.is_done and not e.is_decommissioned
    loop
      v_left := g.due_date - v_today;
      v_kind := null;
      v_want_push := true;
      v_want_email := false;
      v_link := '/elements/' || g.element_id;

      if v_left in (21, 14, 7, 3, 1) then
        v_kind := 'due_soon';
        v_title := format('Due in %s %s: %s', v_left, case when v_left = 1 then 'day' else 'days' end, g.title);
        v_body := format('%s · due %s', g.element_name, to_char(g.due_date, 'FMDD Mon YYYY'));
      elsif v_left = 0 then
        v_kind := 'due_today';
        v_want_email := true;
        v_title := format('Due today: %s', g.title);
        v_body := format('%s · tick it off once it''s done.', g.element_name);
      elsif v_left between -7 and -1 then
        -- Overdue days 1–7 (§4.3): a daily push, an email on day 1 and day 6.
        v_kind := 'overdue';
        v_want_email := -v_left in (1, 6);
        v_title := case when v_left = -7
          then format('Last day before it''s abandoned: %s', g.title)
          else format('%s %s left before this goal is abandoned: %s', 7 + v_left, case when 7 + v_left = 1 then 'day' else 'days' end, g.title)
        end;
        v_body := format('%s · was due %s', g.element_name, to_char(g.due_date, 'FMDD Mon YYYY'));
      elsif v_left = -8 then
        v_kind := 'abandoned';
        v_want_email := true;
        v_title := format('Abandoned: %s', g.title);
        v_body := format('%s · reset its date to pick it up again.', g.element_name);
      end if;

      if v_kind is not null then
        insert into public.notification_log (user_id, goal_id, element_id, kind, channel, title, body, link, sent_on, delivered_at)
        select p.id, g.id, g.element_id, v_kind, c.channel, v_title, v_body, v_link, v_today,
               case when c.channel = 'in_app' then p_now end
          from (values
                  ('push'::public.notification_channel, v_push and v_want_push),
                  ('email'::public.notification_channel, v_email and v_want_email),
                  ('in_app'::public.notification_channel, v_in_app)
               ) as c (channel, wanted)
         where c.wanted
        on conflict on constraint notification_log_no_duplicates do nothing;
        get diagnostics v_rows = row_count;
        v_count := v_count + v_rows;
      end if;
    end loop;

    -- Element alerts: an element that has become Abandoned (once), and weekly nudges for
    -- Resource Delay over 7 days or no ticks for 14+ days.
    for el in
      select e.id, e.name, e.created_at, e.restarted_at, e.recommissioned_at
        from public.elements e
       where e.user_id = p.id and not e.is_decommissioned
    loop
      select * into s from public.engine_element_status(el.id, v_today);
      v_kind := null;
      v_want_push := true;
      v_want_email := false;
      v_since := greatest(el.created_at, el.restarted_at, el.recommissioned_at);

      if s.status = 'abandoned' then
        if not exists (
          select 1 from public.notification_log nl
           where nl.element_id = el.id and nl.goal_id is null and nl.kind = 'element_abandoned' and nl.sent_at > v_since
        ) then
          v_kind := 'element_abandoned';
          v_want_email := true;
          v_title := format('Element abandoned: %s', el.name);
          v_body := 'Every open goal is more than 7 days late. Reset a goal''s date to restart it.';
        end if;
      elsif s.status = 'resource_delay' then
        select max(se.created_at) into v_since from public.status_events se
         where se.element_id = el.id and se.to_status = 'resource_delay';
        if coalesce(v_since, el.created_at) <= p_now - interval '7 days' and not exists (
          select 1 from public.notification_log nl
           where nl.element_id = el.id and nl.goal_id is null and nl.kind = 'resource_delay' and nl.sent_on > v_today - 7
        ) then
          v_kind := 'resource_delay';
          v_title := format('Still waiting on resources: %s', el.name);
          v_body := 'It has been on Resource Delay for over a week. Is there a first step you can take now?';
        end if;
      elsif s.status in ('started', 'in_progress', 'restarted', 'recommissioned') then
        -- Counted from the latest of: the last tick, creation/restart/recommission, the first
        -- start date (§4.6), and when the current status began.
        select max(gl.tick_changed_at), min(gl.start_date)::timestamp at time zone p.timezone
          into v_last_tick, v_start
          from public.goals gl where gl.element_id = el.id;
        select max(se.created_at) into v_status_since from public.status_events se
         where se.element_id = el.id and se.to_status = s.status;
        if greatest(v_last_tick, v_since, v_start, v_status_since) <= p_now - interval '14 days' and not exists (
          select 1 from public.notification_log nl
           where nl.element_id = el.id and nl.goal_id is null and nl.kind = 'stalled' and nl.sent_on > v_today - 7
        ) then
          v_kind := 'stalled';
          v_title := format('No progress for 2 weeks: %s', el.name);
          v_body := 'Nothing has been ticked for 14 days. Pick one small goal to move it forward.';
        end if;
      end if;

      if v_kind is not null then
        insert into public.notification_log (user_id, goal_id, element_id, kind, channel, title, body, link, sent_on, delivered_at)
        select p.id, null, el.id, v_kind, c.channel, v_title, v_body, '/elements/' || el.id, v_today,
               case when c.channel = 'in_app' then p_now end
          from (values
                  ('push'::public.notification_channel, v_push and v_want_push),
                  ('email'::public.notification_channel, v_email and v_want_email),
                  ('in_app'::public.notification_channel, v_in_app)
               ) as c (channel, wanted)
         where c.wanted
        on conflict on constraint notification_log_no_duplicates do nothing;
        get diagnostics v_rows = row_count;
        v_count := v_count + v_rows;
      end if;
    end loop;

    -- Weekly digest email, Mondays. Its content is built when it is sent (weekly_digest_data).
    if v_email and extract(isodow from v_today) = 1 then
      insert into public.notification_log (user_id, kind, channel, title, link, sent_on)
      values (p.id, 'weekly_digest', 'email', 'Your week in Progress Tracker', '/', v_today)
      on conflict on constraint notification_log_no_duplicates do nothing;
      get diagnostics v_rows = row_count;
      v_count := v_count + v_rows;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------- delivery (Edge Function)
-- Hands out up to p_limit undelivered push/email alerts from the last day, marking them
-- claimed so two overlapping runs never send the same one. Each alert gets up to 5 tries.
-- Alerts that no longer apply (goal ticked, element switched off) are dropped first (§4.5).
create or replace function public.claim_deliveries(p_limit integer default 200)
returns setof public.notification_log
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_log nl
     set attempts = 5, claimed_at = null, last_error = 'No longer needed'
   where nl.delivered_at is null and nl.channel <> 'in_app' and nl.attempts < 5
     and (exists (select 1 from public.goals g where g.id = nl.goal_id and g.is_done)
          or exists (select 1 from public.elements e where e.id = nl.element_id and e.is_decommissioned));

  return query
  update public.notification_log nl
     set claimed_at = now(), attempts = nl.attempts + 1
   where nl.id in (
     select x.id from public.notification_log x
      where x.delivered_at is null and x.channel <> 'in_app'
        and x.attempts < 5
        and x.sent_at > now() - interval '1 day'
        and (x.claimed_at is null or x.claimed_at < now() - interval '10 minutes')
      order by x.sent_at
      limit p_limit
      for update skip locked
   )
  returning nl.*;
end;
$$;

create or replace function public.finish_delivery(p_id uuid, p_ok boolean, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_log
     set delivered_at = case when p_ok then now() end,
         claimed_at = null,
         last_error = case when p_ok then null else left(p_error, 500) end
   where id = p_id
$$;

-- Figures for the Monday email: last week (Monday–Sunday) against the week before, plus the
-- goals to focus on now. Decommissioned elements are left out (§4.5).
create or replace function public.weekly_digest_data(p_user uuid, p_today date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_week_start date := p_today - 7;
  v_result jsonb;
begin
  select timezone into v_tz from public.profiles where id = p_user;
  if v_tz is null then
    return null;
  end if;

  with live_goals as (
    select gl.*, e.name as element_name
      from public.goals gl
      join public.elements e on e.id = gl.element_id
     where gl.user_id = p_user and not e.is_decommissioned
  )
  select jsonb_build_object(
    'week_start', v_week_start,
    'week_end', p_today - 1,
    'goals_total', (select count(*) from live_goals),
    'goals_done', (select count(*) from live_goals where is_done),
    'done_last_week', (select count(*) from live_goals
                        where is_done and (done_at at time zone v_tz)::date between v_week_start and p_today - 1),
    'done_week_before', (select count(*) from live_goals
                          where is_done and (done_at at time zone v_tz)::date between v_week_start - 7 and v_week_start - 1),
    'overdue', (select count(*) from live_goals
                 where not is_done and start_date <= p_today and p_today - due_date between 1 and 7),
    'abandoned', (select count(*) from live_goals
                   where not is_done and start_date <= p_today and p_today - due_date > 7),
    'due_soon', (select count(*) from live_goals where not is_done and due_date - p_today between 0 and 14),
    'focus', coalesce((
      select jsonb_agg(f order by f.due_date, f.title)
        from (
          select title, element_name, element_id, due_date, due_date - p_today as days_left
            from live_goals
           where not is_done and p_today - due_date <= 7 and due_date - p_today <= 14
           order by due_date, title
           limit 10
        ) f
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------- push devices
-- Push services only: the Edge Function posts to these addresses, so nothing else is allowed.
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_https check (endpoint ~ '^https://' and char_length(endpoint) <= 1000);

create or replace function public.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'
$$;

-- Saves this device for the signed-in user. A browser has one subscription per site, so if
-- someone else used this device before, the device moves to the current user.
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'You need to be signed in.' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_push_endpoint(p_endpoint) or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'This browser''s push service isn''t supported.' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, keys, device_label)
  values (v_user, p_endpoint, jsonb_build_object('p256dh', p_p256dh, 'auth', p_auth), left(p_label, 120))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, keys = excluded.keys, device_label = excluded.device_label, created_at = now();
end;
$$;

revoke insert, update on public.push_subscriptions from authenticated;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
revoke execute on function public.is_push_endpoint(text) from public, anon, authenticated;
grant execute on function public.is_push_endpoint(text) to service_role;
revoke execute on function public.notify_in_quiet(time, time, time) from public, anon, authenticated;

-- The scheduler's shared secret lives in Supabase Vault; the Edge Function checks it here.
create or replace function public.notify_token_ok(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return p_token is not null and length(p_token) >= 32 and exists (
    select 1 from vault.decrypted_secrets where name = 'notify_cron_token' and decrypted_secret = p_token
  );
end;
$$;

-- Server-only functions: the Edge Function calls them with the service role.
revoke execute on function public.notify_send_hour(time, time) from public, anon, authenticated;
revoke execute on function public.queue_notifications(timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.claim_deliveries(integer) from public, anon, authenticated;
revoke execute on function public.finish_delivery(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.weekly_digest_data(uuid, date) from public, anon, authenticated;
revoke execute on function public.notify_token_ok(text) from public, anon, authenticated;
grant execute on function public.queue_notifications(timestamptz, boolean) to service_role;
grant execute on function public.claim_deliveries(integer) to service_role;
grant execute on function public.finish_delivery(uuid, boolean, text) to service_role;
grant execute on function public.weekly_digest_data(uuid, date) to service_role;
grant execute on function public.notify_token_ok(text) to service_role;

-- ---------------------------------------------------------------- schedule
-- Every hour at :00, call the notify Edge Function, which queues alerts for users whose send
-- hour it is and delivers anything waiting. Skipped where pg_cron/pg_net/Vault are missing
-- (the in-memory test database).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_extension where extname = 'supabase_vault') then
    create extension if not exists pg_net;
    if not exists (select 1 from vault.secrets where name = 'notify_cron_token') then
      perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notify_cron_token',
                                  'Shared secret the hourly job sends to the notify Edge Function');
    end if;
    perform cron.schedule('notify', '0 * * * *', $job$
      select net.http_post(
        url := 'https://nvfhyxnmazhtnlqguerr.supabase.co/functions/v1/notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_token')
        ),
        body := '{"mode":"cron"}'::jsonb,
        timeout_milliseconds := 60000
      )
    $job$);
  end if;
end;
$$;
