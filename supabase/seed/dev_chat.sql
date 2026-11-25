-- DEV ONLY demo chats + a finished activity for S16 / S16-D / S17. Run after 0008_chat.sql and dev_activities.sql.
-- Safe to re-run. For every real (non-seed) user:
--   • "Friday board games" (hosted by Priya) that ended yesterday, with you, Rohan, Sneha and Kabir going → S17
--   • a few messages in that chat and in your "Poker Night" chat, and a direct message from Rohan.

do $$
begin
  if (select count(*) from auth.users where coalesce(raw_app_meta_data ->> 'provider', '') <> 'seed') > 50 then
    raise exception 'Refusing to seed: this looks like a production database.';
  end if;
end $$;

drop table if exists seed_real;
create temporary table seed_real as
  select u.id, u.lat, u.lng, u.area_name from public.users u
  join auth.users a on a.id = u.id and coalesce(a.raw_app_meta_data ->> 'provider', '') <> 'seed'
  where u.onboarding_completed_at is not null;

-- Finished activity (one per real user).
with created as (
  insert into public.activities (host_id, interest_id, title, description, area_name, city, address, lat, lng,
    starts_at, ends_at, participant_limit, visibility)
  select '00000000-0000-4000-8000-000000000006', 4, 'Friday board games', 'Catan, Codenames and snacks.',
    coalesce(r.area_name, 'HSR Layout'), 'Bengaluru', 'Priya''s place, 19th Main', coalesce(r.lat, 12.9116), coalesce(r.lng, 77.6474),
    (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '1 day' + interval '19 hours') at time zone 'Asia/Kolkata',
    (date_trunc('day', now() at time zone 'Asia/Kolkata') - interval '1 day' + interval '22 hours') at time zone 'Asia/Kolkata',
    6, 'connections_and_nearby'
  from seed_real r
  where not exists (select 1 from public.activities x
    join public.participations p on p.activity_id = x.id and p.user_id = r.id
    where x.title = 'Friday board games')
  returning id
),
people as (
  select c.id as activity_id, r.id as user_id, 'participant' as role from created c, seed_real r
  union all select c.id, '00000000-0000-4000-8000-000000000006'::uuid, 'host' from created c
  union all select c.id, '00000000-0000-4000-8000-000000000005'::uuid, 'participant' from created c
  union all select c.id, '00000000-0000-4000-8000-000000000007'::uuid, 'participant' from created c
  union all select c.id, '00000000-0000-4000-8000-000000000003'::uuid, 'participant' from created c
)
insert into public.participations (activity_id, user_id, role, status, decided_at)
select activity_id, user_id, role, 'accepted', now() - interval '2 days' from people
on conflict (activity_id, user_id) do nothing;

-- Messages (only when the conversation has none yet).
insert into public.messages (conversation_id, sender_id, body, created_at)
select c.id, m.sender, m.body, now() - m.ago
from public.conversations c
join public.activities a on a.id = c.activity_id and a.title = 'Friday board games'
cross join (values
  ('00000000-0000-4000-8000-000000000006'::uuid, 'Doors open at 7. I''ll have Catan set up.', interval '30 hours'),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'Bringing chips!', interval '29 hours'),
  ('00000000-0000-4000-8000-000000000007'::uuid, 'That was so much fun, thanks Priya!', interval '20 hours')
) m(sender, body, ago)
where not exists (select 1 from public.messages x where x.conversation_id = c.id);

insert into public.messages (conversation_id, sender_id, body, created_at)
select c.id, '00000000-0000-4000-8000-000000000005', 'Count me in. Should I bring chips?', now() - interval '3 hours'
from public.conversations c
join public.activities a on a.id = c.activity_id and a.title = 'Poker Night'
where not exists (select 1 from public.messages x where x.conversation_id = c.id);

insert into public.messages (conversation_id, sender_id, body, created_at)
select c.id, '00000000-0000-4000-8000-000000000005', 'Hey! Up for a swim this week?', now() - interval '1 hour'
from public.conversations c
join seed_real r on c.type = 'direct'
  and least(r.id, '00000000-0000-4000-8000-000000000005'::uuid) = c.user_a
  and greatest(r.id, '00000000-0000-4000-8000-000000000005'::uuid) = c.user_b
where not exists (select 1 from public.messages x where x.conversation_id = c.id);

drop table if exists seed_real;
