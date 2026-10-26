-- Phase 1 code-review fixes. The first migration is already applied, so changes go here.

-- 1. A date reset must point at one of the user's own goals (same pattern as elements/goals).
alter table public.goals add constraint goals_id_user_id_key unique (id, user_id);
alter table public.goal_date_resets drop constraint goal_date_resets_goal_id_fkey;
alter table public.goal_date_resets
  add constraint goal_date_resets_goal_owner_fkey
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade;

-- 2. Alerts with no goal or element (the weekly digest) must not collide across users.
alter table public.notification_log drop constraint notification_log_no_duplicates;
alter table public.notification_log
  add constraint notification_log_no_duplicates
  unique nulls not distinct (user_id, goal_id, element_id, kind, channel, sent_on);

-- 3. Users may only write a goal's own content. The bookkeeping columns
--    (original_due_date, reset_count, done_at, tick_changed_at) are set by triggers
--    and by the date-reset database function, never directly by the client.
revoke insert, update on public.goals from authenticated;
grant insert (element_id, title, notes, start_date, due_date, is_done, sort_order) on public.goals to authenticated;
grant update (title, notes, start_date, due_date, is_done, sort_order) on public.goals to authenticated;

create or replace function public.goals_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.original_due_date := new.due_date;
    new.reset_count := 0;
    new.tick_changed_at := null;
    new.done_at := case when new.is_done then now() else null end;
  elsif new.is_done is distinct from old.is_done then
    new.tick_changed_at := now();
    new.done_at := case when new.is_done then now() else null end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- 4. Signed-out visitors get nothing, now and for anything added later.
--    Functions are executable by PUBLIC by default in Postgres, which includes anon.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
-- the built-in "PUBLIC may execute" default is global, so it has to be revoked globally
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
