-- DEV ONLY demo activities for S10–S14. Run after migrations 0001–0005 and dev_seed.sql. Safe to re-run.
-- Times are relative to today (Asia/Kolkata) so the feed always has upcoming activities.
-- Every real (non-seed) user also gets one hosted "Poker Night" with two requests and one person going.

do $$
begin
  if (select count(*) from auth.users where coalesce(raw_app_meta_data ->> 'provider', '') <> 'seed') > 50 then
    raise exception 'Refusing to seed: this looks like a production database.';
  end if;
end $$;

drop table if exists seed_activities;
create temporary table seed_activities (
  id uuid, host uuid, interest smallint, title text, description text, area text, lat double precision,
  lng double precision, address text, day_offset int, start_hour numeric, hours numeric, lim smallint, vis text,
  going uuid[]
);

insert into seed_activities values
  -- Rohan / Sneha are connected to every real user → "From your people".
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-8000-000000000005', 2, 'Early swim at the club',
   'Easy laps, then breakfast nearby.', 'BTM Layout', 12.9166, 77.6101, 'Aquatic Centre, 16th Main', 2, 6.5, 1.5, 4,
   'connections', '{00000000-0000-4000-8000-000000000002}'),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-8000-000000000007', 6, 'Nandi Hills sunrise hike',
   'Pickup at Agara lake, back by 11.', 'Sarjapur Road', 12.9105, 77.6857, 'Agara lake gate', 6, 4.5, 6, 5,
   'connections_and_nearby', '{00000000-0000-4000-8000-000000000001}'),
  -- Non-connections nearby → "Nearby activities" when the interest matches.
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-8000-000000000001', 1, 'Saturday morning doubles',
   'Friendly intermediate doubles. I''ve booked the court and we split it four ways. Bring your own racquet, shuttles are on me.',
   'Koramangala', 12.9352, 77.6245, 'Court 3, Koramangala Indoor Stadium', 5, 7, 2, 4,
   'connections_and_nearby', '{00000000-0000-4000-8000-000000000007,00000000-0000-4000-8000-000000000005}'),
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-4000-8000-000000000002', 8, 'Coffee exploration',
   'Trying three third-wave cafés in one morning.', 'BTM Layout', 12.9166, 77.6101, null, 5, 10, 3, 5,
   'connections_and_nearby', '{}'),
  ('00000000-0000-4000-a000-000000000005', '00000000-0000-4000-8000-000000000004', 7, 'Sunday ride to Hosa Road',
   null, 'HSR Layout', 12.9116, 77.6474, 'HSR BDA complex', 6, 6, 2, 2,
   'connections_and_nearby', '{00000000-0000-4000-8000-000000000005}'),
  ('00000000-0000-4000-a000-000000000006', '00000000-0000-4000-8000-000000000006', 4, 'Board game evening',
   'Catan and Codenames. Snacks sorted.', 'HSR Layout', 12.9116, 77.6474, null, 4, 19.5, 3, 6,
   'connections_and_nearby', '{00000000-0000-4000-8000-000000000002}'),
  ('00000000-0000-4000-a000-000000000007', '00000000-0000-4000-8000-000000000003', 5, 'FIFA night',
   null, 'Bellandur', 12.9304, 77.6784, null, 4, 20, 3, 4,
   'connections_and_nearby', '{00000000-0000-4000-8000-000000000008}');

insert into public.activities (id, host_id, interest_id, title, description, area_name, city, address, lat, lng,
  starts_at, ends_at, participant_limit, visibility)
select s.id, s.host, s.interest, s.title, s.description, s.area, 'Bengaluru', s.address, s.lat, s.lng,
  (date_trunc('day', now() at time zone 'Asia/Kolkata') + make_interval(days => s.day_offset)
    + make_interval(mins => (s.start_hour * 60)::int)) at time zone 'Asia/Kolkata',
  (date_trunc('day', now() at time zone 'Asia/Kolkata') + make_interval(days => s.day_offset)
    + make_interval(mins => ((s.start_hour + s.hours) * 60)::int)) at time zone 'Asia/Kolkata',
  s.lim, s.vis
from seed_activities s
on conflict (id) do nothing;

insert into public.participations (activity_id, user_id, role, status, decided_at)
select s.id, s.host, 'host', 'accepted', now() from seed_activities s
union all
select s.id, g, 'participant', 'accepted', now() from seed_activities s, unnest(s.going) g
on conflict (activity_id, user_id) do nothing;

-- One hosted activity per real user, to try S14 (Kabir + Meera waiting, Rohan going).
with real_users as (
  select u.id from public.users u
  join auth.users a on a.id = u.id and coalesce(a.raw_app_meta_data ->> 'provider', '') <> 'seed'
  where u.onboarding_completed_at is not null
    and not exists (select 1 from public.activities x where x.host_id = u.id and x.title = 'Poker Night')
),
created as (
  insert into public.activities (host_id, interest_id, title, description, area_name, city, address, lat, lng,
    starts_at, participant_limit, visibility)
  select r.id, 3, 'Poker Night', 'Friendly low-stakes Texas Hold''em. Beginners welcome, I''ll explain the rules.',
    coalesce(u.area_name, 'HSR Layout'), 'Bengaluru', 'Flat 4B, 27th Main', coalesce(u.lat, 12.9116), coalesce(u.lng, 77.6474),
    (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '5 days 19 hours') at time zone 'Asia/Kolkata',
    5, 'connections_and_nearby'
  from real_users r join public.users u on u.id = r.id
  returning id, host_id
)
insert into public.participations (activity_id, user_id, role, status, requested_at, decided_at)
select c.id, c.host_id, 'host', 'accepted', now(), now() from created c
union all
select c.id, '00000000-0000-4000-8000-000000000005', 'participant', 'accepted', now(), now() from created c
union all
select c.id, '00000000-0000-4000-8000-000000000003', 'participant', 'requested', now() - interval '2 hours', null from created c
union all
select c.id, '00000000-0000-4000-8000-000000000001', 'participant', 'requested', now() - interval '1 hour', null from created c;

drop table if exists seed_activities;
