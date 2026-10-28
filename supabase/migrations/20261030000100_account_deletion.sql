-- Phase 7: delete my account (Google Play requires in-app account deletion).
-- Removing the auth user removes everything else: every table's user_id references
-- auth.users with "on delete cascade" (profiles, categories, elements, goals, history,
-- snapshots, push devices, notifications, AI insights and usage).

create or replace function public.delete_my_account(p_confirm text)
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
  -- The same word the user types in the app, so a stray call can't delete an account.
  if p_confirm is distinct from 'DELETE' then
    raise exception 'Type DELETE to confirm.' using errcode = 'invalid_parameter_value';
  end if;
  delete from auth.users where id = v_user;
end;
$$;

revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
