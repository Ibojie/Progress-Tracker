-- Progress Tracker: initial schema (Phase 1)
-- Every table carries user_id and is protected by Row Level Security (user_id = auth.uid()).

-- ---------------------------------------------------------------- enums
create type public.theme_preference as enum ('light', 'dark', 'system');
create type public.category_key as enum ('paid_job', 'business', 'investment', 'personal_development');
create type public.zero_progress_status as enum ('not_started', 'started', 'resource_delay');
create type public.element_status as enum (
  'not_started', 'started', 'resource_delay', 'in_progress', 'completed',
  'abandoned', 'restarted', 'decommissioned', 'recommissioned'
);
create type public.notification_channel as enum ('push', 'email', 'in_app');

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  timezone text not null default 'Africa/Lagos',
  theme_preference public.theme_preference not null default 'system',
  email_digest_enabled boolean not null default true,
  push_enabled boolean not null default false,
  in_app_enabled boolean not null default true,
  ai_summary_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key public.category_key not null,
  name text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, key),
  unique (id, user_id)
);

-- ---------------------------------------------------------------- elements
create table public.elements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  zero_progress_status public.zero_progress_status not null default 'not_started',
  is_decommissioned boolean not null default false,
  decommissioned_at timestamptz,
  recommissioned_at timestamptz,
  restarted_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- the category must belong to the same user (checked at end of statement, so deleting a user cascades cleanly)
  foreign key (category_id, user_id) references public.categories (id, user_id)
);

create index elements_user_category_idx on public.elements (user_id, category_id);

create trigger elements_set_updated_at before update on public.elements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  element_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  notes text check (char_length(notes) <= 2000),
  start_date date not null,
  due_date date not null,
  original_due_date date not null,
  is_done boolean not null default false,
  done_at timestamptz,
  -- last time the tick box changed; ends the Restarted / Recommissioned states and feeds stall detection
  tick_changed_at timestamptz,
  reset_count integer not null default 0 check (reset_count >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_due_after_start check (due_date >= start_date),
  foreign key (element_id, user_id) references public.elements (id, user_id) on delete cascade
);

create index goals_element_idx on public.goals (element_id);
create index goals_user_due_idx on public.goals (user_id, due_date) where not is_done;

create or replace function public.goals_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.original_due_date := coalesce(new.original_due_date, new.due_date);
    if new.is_done then
      new.done_at := coalesce(new.done_at, now());
    end if;
  elsif new.is_done is distinct from old.is_done then
    new.tick_changed_at := now();
    new.done_at := case when new.is_done then now() else null end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger goals_before_write before insert or update on public.goals
  for each row execute function public.goals_before_write();

-- An element holds at most 10 goals.
create or replace function public.goals_enforce_max()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  goal_count integer;
begin
  -- lock the parent so two concurrent inserts cannot both pass the check
  perform 1 from public.elements where id = new.element_id for update;
  select count(*) into goal_count from public.goals where element_id = new.element_id;
  if goal_count >= 10 then
    raise exception 'An element can have at most 10 goals.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger goals_enforce_max before insert on public.goals
  for each row execute function public.goals_enforce_max();

-- Moving goals between elements is not a feature; forbid it so the count rules stay simple.
create or replace function public.goals_forbid_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.element_id is distinct from old.element_id then
    raise exception 'A goal cannot be moved to another element.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger goals_forbid_move before update of element_id on public.goals
  for each row execute function public.goals_forbid_move();

-- An element holds at least 1 goal. Checked at commit, so an element and its goals
-- can be created in one transaction (see the create_element_with_goals RPC in Phase 2).
create or replace function public.assert_element_has_goals(target uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- skipped when the element itself is gone (deleted along with its goals)
  if exists (select 1 from public.elements where id = target)
     and not exists (select 1 from public.goals where element_id = target) then
    raise exception 'An element needs at least 1 goal.' using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.elements_min_goals_on_create()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_element_has_goals(new.id);
  return null;
end;
$$;

create or replace function public.goals_min_goals_on_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_element_has_goals(old.element_id);
  return null;
end;
$$;

create constraint trigger elements_min_goals_on_create
  after insert on public.elements
  deferrable initially deferred
  for each row execute function public.elements_min_goals_on_create();

create constraint trigger goals_min_goals_on_delete
  after delete on public.goals
  deferrable initially deferred
  for each row execute function public.goals_min_goals_on_delete();

-- ---------------------------------------------------------------- history
create table public.goal_date_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  old_due_date date not null,
  new_due_date date not null,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index goal_date_resets_goal_idx on public.goal_date_resets (goal_id);

-- Append-only: users may read and insert, never update or delete.
create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  element_id uuid not null,
  from_status public.element_status,
  to_status public.element_status not null,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  foreign key (element_id, user_id) references public.elements (id, user_id) on delete cascade
);

create index status_events_element_idx on public.status_events (element_id, created_at);
create index status_events_user_time_idx on public.status_events (user_id, created_at);

-- Written nightly by pg_cron (Phase 3); read by the trend charts.
create table public.daily_snapshots (
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  element_id uuid not null references public.elements (id) on delete cascade,
  pct_complete smallint not null check (pct_complete between 0 and 100),
  goals_total smallint not null check (goals_total between 0 and 10),
  goals_done smallint not null check (goals_done between 0 and goals_total),
  status public.element_status not null,
  primary key (element_id, snapshot_date)
);

create index daily_snapshots_user_date_idx on public.daily_snapshots (user_id, snapshot_date);

-- ---------------------------------------------------------------- notifications
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  device_label text check (char_length(device_label) <= 120),
  created_at timestamptz not null default now()
);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete cascade,
  element_id uuid references public.elements (id) on delete cascade,
  kind text not null,
  channel public.notification_channel not null,
  title text,
  body text,
  sent_at timestamptz not null default now(),
  -- the Lagos calendar day the alert belongs to; part of the no-duplicates key
  sent_on date not null default (now() at time zone 'Africa/Lagos')::date,
  read_at timestamptz,
  constraint notification_log_no_duplicates unique nulls not distinct (goal_id, element_id, kind, channel, sent_on)
);

create index notification_log_user_idx on public.notification_log (user_id, sent_at desc);

-- ---------------------------------------------------------------- AI summaries
create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  content_md text not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index ai_summaries_user_idx on public.ai_summaries (user_id, created_at desc);

-- ---------------------------------------------------------------- new-user setup
-- Creates the profile and the four fixed categories when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));

  insert into public.categories (user_id, key, name, sort_order) values
    (new.id, 'paid_job', 'Paid Job', 1),
    (new.id, 'business', 'Business', 2),
    (new.id, 'investment', 'Investment', 3),
    (new.id, 'personal_development', 'Personal Development', 4);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.elements enable row level security;
alter table public.goals enable row level security;
alter table public.goal_date_resets enable row level security;
alter table public.status_events enable row level security;
alter table public.daily_snapshots enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;
alter table public.ai_summaries enable row level security;

-- profiles: read and edit your own row (created by the signup trigger)
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- categories: seeded on signup, renamable, never inserted or deleted by users
create policy "categories: read own" on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "categories: update own" on public.categories
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- elements, goals, push subscriptions: full control of your own rows
create policy "elements: own" on public.elements
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "goals: own" on public.goals
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push_subscriptions: own" on public.push_subscriptions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- history: read and append only
create policy "goal_date_resets: read own" on public.goal_date_resets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "goal_date_resets: insert own" on public.goal_date_resets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "status_events: read own" on public.status_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "status_events: insert own" on public.status_events
  for insert to authenticated with check (user_id = (select auth.uid()));

-- written by server jobs (service role bypasses RLS); users read their own
create policy "daily_snapshots: read own" on public.daily_snapshots
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_summaries: read own" on public.ai_summaries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_log: read own" on public.notification_log
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_log: mark read" on public.notification_log
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- the only column a user may change is read_at
revoke update on public.notification_log from authenticated;
grant update (read_at) on public.notification_log to authenticated;

-- Signed-out visitors get nothing.
revoke all on all tables in schema public from anon;
