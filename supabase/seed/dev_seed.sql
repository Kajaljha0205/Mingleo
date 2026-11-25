-- DEV ONLY demo people for Discover (ST-042). Never run against production.
-- Run in Supabase → SQL editor after migrations 0001–0004. Safe to re-run.
-- Also connects every real (non-seed) user to Rohan and Sneha, and sends them a request from Kabir,
-- so mutual connections and the "received" state can be seen.

do $$
begin
  if (select count(*) from auth.users where coalesce(raw_app_meta_data ->> 'provider', '') <> 'seed') > 50 then
    raise exception 'Refusing to seed: this looks like a production database.';
  end if;
end $$;

drop table if exists seed_people;
create temporary table seed_people (
  id uuid, first_name text, years int, show_age boolean, bio text, photo_path text,
  area_name text, lat double precision, lng double precision, interests smallint[]
);

insert into seed_people values
  ('00000000-0000-4000-8000-000000000001', 'Meera', 27, true,
   'Product manager, weekend shuttler. Always up for a board-game café or an early hike. Looking for a regular Saturday doubles group.',
   '/images/people/meera.svg', 'Koramangala', 12.9352, 77.6245, '{1,4,6,10,8}'),
  ('00000000-0000-4000-8000-000000000002', 'Ananya', 28, true,
   'Always up for good food, great conversations and new adventures.',
   '/images/people/ananya.svg', 'BTM Layout', 12.9166, 77.6101, '{8,6,14}'),
  ('00000000-0000-4000-8000-000000000003', 'Kabir', 30, true,
   'Weekend gamer and movie buff. Always down for a poker night.',
   '/images/people/kabir.svg', 'Bellandur', 12.9304, 77.6784, '{5,3,12,11}'),
  ('00000000-0000-4000-8000-000000000004', 'Aarav', 26, true,
   'New to Bengaluru, product designer. Weekend badminton and the city''s best filter coffee.',
   '/images/people/aarav.svg', 'HSR Layout', 12.9116, 77.6474, '{1,7,8}'),
  ('00000000-0000-4000-8000-000000000005', 'Rohan', 29, true,
   'Early-morning swimmer, evening cyclist.',
   '/images/people/rohan.svg', 'BTM Layout', 12.9166, 77.6101, '{1,2,7}'),
  ('00000000-0000-4000-8000-000000000006', 'Priya', 25, false,
   'Board games, live music and finding new places to eat.',
   '/images/people/priya.svg', 'HSR Layout', 12.9116, 77.6474, '{4,11,10,14}'),
  ('00000000-0000-4000-8000-000000000007', 'Sneha', 31, true,
   'Hikes, road trips and the occasional shopping spree.',
   '/images/people/sneha.svg', 'Sarjapur Road', 12.9105, 77.6857, '{6,13,9}'),
  ('00000000-0000-4000-8000-000000000008', 'Vikram', 33, true,
   'Poker on Fridays, PS5 on Sundays, board games in between.',
   '/images/people/vikram.svg', 'Indiranagar', 12.9784, 77.6408, '{3,4,5}');

-- The auth trigger (0001) creates each public.users row.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
  lower(first_name) || '@seed.mingleo.test', '', now(),
  '{"provider":"seed","providers":["seed"]}'::jsonb, jsonb_build_object('given_name', first_name), now(), now(),
  '', '', '', ''
from seed_people
on conflict (id) do nothing;

insert into public.user_interests (user_id, interest_id)
select id, unnest(interests) from seed_people
on conflict do nothing;

update public.users u set
  birth_date = (current_date - make_interval(years => p.years) - interval '40 days')::date,
  show_age = p.show_age,
  bio = p.bio,
  photo_path = p.photo_path,
  area_name = p.area_name,
  city = 'Bengaluru',
  lat = p.lat,
  lng = p.lng,
  radius_km = 5
from seed_people p
where u.id = p.id;

update public.users u set onboarding_completed_at = coalesce(u.onboarding_completed_at, now())
from seed_people p
where u.id = p.id;

-- Seed people's own connections (gives "You both know …" once you connect to Rohan / Sneha).
insert into public.connections (user_a, user_b) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000007'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000006')
on conflict do nothing;

-- Every real user: connected to Rohan + Sneha, and a pending request from Kabir.
insert into public.connections (user_a, user_b)
select least(u.id, s.id), greatest(u.id, s.id)
from public.users u
join auth.users a on a.id = u.id and coalesce(a.raw_app_meta_data ->> 'provider', '') <> 'seed'
cross join (values ('00000000-0000-4000-8000-000000000005'::uuid), ('00000000-0000-4000-8000-000000000007'::uuid)) s(id)
on conflict do nothing;

insert into public.connection_requests (from_user, to_user)
select '00000000-0000-4000-8000-000000000003', u.id
from public.users u
join auth.users a on a.id = u.id and coalesce(a.raw_app_meta_data ->> 'provider', '') <> 'seed'
where not public.are_connected(u.id, '00000000-0000-4000-8000-000000000003')
on conflict do nothing;

drop table if exists seed_people;
