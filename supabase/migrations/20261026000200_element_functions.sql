-- Phase 2: database functions the app calls.

-- Creates an element and its 1–10 goals in one transaction, so the
-- "at least one goal" rule (checked at commit) is satisfied. Runs as the caller,
-- so Row Level Security and the column grants still apply.
create or replace function public.create_element_with_goals(
  p_category_id uuid,
  p_name text,
  p_description text,
  p_goals jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_element_id uuid;
  v_goal jsonb;
  v_position integer := 0;
begin
  if p_goals is null or jsonb_typeof(p_goals) <> 'array'
     or jsonb_array_length(p_goals) not between 1 and 10 then
    raise exception 'An element needs between 1 and 10 goals.' using errcode = 'check_violation';
  end if;

  insert into public.elements (category_id, name, description, sort_order)
  values (
    p_category_id,
    btrim(p_name),
    nullif(btrim(p_description), ''),
    coalesce((select max(e.sort_order) + 1 from public.elements e where e.category_id = p_category_id), 0)
  )
  returning id into v_element_id;

  for v_goal in select value from jsonb_array_elements(p_goals) loop
    insert into public.goals (element_id, title, notes, start_date, due_date, sort_order)
    values (
      v_element_id,
      btrim(v_goal ->> 'title'),
      nullif(btrim(v_goal ->> 'notes'), ''),
      (v_goal ->> 'start_date')::date,
      (v_goal ->> 'due_date')::date,
      v_position
    );
    v_position := v_position + 1;
  end loop;

  return v_element_id;
end;
$$;

-- Moves a goal's due date (the only way to revive an abandoned goal, §4.3).
-- Security definer because reset_count is not writable by the client; it checks
-- ownership itself. "Today" is the user's own calendar day.
create or replace function public.reset_goal_date(
  p_goal_id uuid,
  p_new_due_date date,
  p_reason text,
  p_mark_restarted boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_goal public.goals%rowtype;
  v_today date;
begin
  if v_user is null then
    raise exception 'You need to be signed in.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_goal from public.goals where id = p_goal_id and user_id = v_user for update;
  if not found then
    raise exception 'Goal not found.' using errcode = 'no_data_found';
  end if;

  select (now() at time zone p.timezone)::date into v_today from public.profiles p where p.id = v_user;
  v_today := coalesce(v_today, (now() at time zone 'Africa/Lagos')::date);

  if p_new_due_date is null or p_new_due_date <= v_today then
    raise exception 'The new due date must be after today.' using errcode = 'check_violation';
  end if;
  if p_new_due_date < v_goal.start_date then
    raise exception 'The new due date cannot be before the start date.' using errcode = 'check_violation';
  end if;
  if char_length(p_reason) > 500 then
    raise exception 'The reason can be at most 500 characters.' using errcode = 'check_violation';
  end if;

  insert into public.goal_date_resets (user_id, goal_id, old_due_date, new_due_date, reason)
  values (v_user, p_goal_id, v_goal.due_date, p_new_due_date, nullif(btrim(p_reason), ''));

  update public.goals
     set due_date = p_new_due_date, reset_count = reset_count + 1
   where id = p_goal_id;

  -- The engine decides whether the element was Abandoned; resetting then shows Restarted (§4.3).
  if p_mark_restarted then
    update public.elements set restarted_at = now() where id = v_goal.element_id and user_id = v_user;
  end if;
end;
$$;

revoke execute on function public.create_element_with_goals(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.reset_goal_date(uuid, date, text, boolean) from public, anon;
grant execute on function public.create_element_with_goals(uuid, text, text, jsonb) to authenticated;
grant execute on function public.reset_goal_date(uuid, date, text, boolean) to authenticated;
