-- Local development seed only (runs on `npx supabase db reset`). Never applied to production.
-- Creates a demo user (sign in at http://localhost:5173 with demo@progress.test; the magic link
-- arrives in the local mail viewer at http://127.0.0.1:54324) and a few example elements.
begin;

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
  'demo@progress.test', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo User"}', now(), now()
);

-- The signup trigger has created the profile and the four categories.
with cat as (
  select key, id from public.categories where user_id = '11111111-1111-1111-1111-111111111111'
), el as (
  insert into public.elements (user_id, category_id, name, description)
  select '11111111-1111-1111-1111-111111111111', cat.id, e.name, e.description
  from (values
    ('paid_job', 'Performance Management (PMI)', 'Quarterly PMI follow-ups with my line manager'),
    ('personal_development', 'NEBOSH', 'NEBOSH International General Certificate'),
    ('business', 'Naija Commerce', 'Launch the first product line')
  ) as e(cat_key, name, description)
  join cat on cat.key::text = e.cat_key
  returning id, name
)
insert into public.goals (user_id, element_id, title, start_date, due_date, is_done)
select '11111111-1111-1111-1111-111111111111', el.id, g.title, current_date + g.start_offset, current_date + g.due_offset, g.done
from el
join (values
  ('Performance Management (PMI)', 'Agree Q1 objectives', -40, -10, true),
  ('Performance Management (PMI)', 'Mid-year review evidence pack', -10, 12, false),
  ('Performance Management (PMI)', 'Self-assessment submitted', 0, 45, false),
  ('Performance Management (PMI)', 'Final review meeting', 0, 90, false),
  ('NEBOSH', 'Unit IG1 assignment', -30, -3, false),
  ('NEBOSH', 'Unit IG2 practical', -5, 25, false),
  ('Naija Commerce', 'Supplier shortlist', -20, 40, false)
) as g(element_name, title, start_offset, due_offset, done) on g.element_name = el.name;

commit;
