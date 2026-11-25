-- S10: the feed also returns the viewer's join state so cards can offer "Request to join" inline.
-- Run after 0005. Safe to re-run.

drop function if exists public.activities_feed();

create function public.activities_feed() returns table (
  id uuid, section text, interest_id smallint, title text,
  host_id uuid, host_first_name text, host_photo_path text,
  starts_at timestamptz, ends_at timestamptz, area_name text, distance_km numeric,
  participant_limit smallint, going integer, visibility text, viewer_state text
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select u.id, u.lat, u.lng, u.radius_km from public.users u
    where u.id = auth.uid() and u.onboarding_completed_at is not null
  ),
  friends as (select c.uid from me, public.connections_of(me.id) as c(uid))
  select a.id,
    case when a.host_id in (select uid from friends) then 'people' else 'nearby' end,
    a.interest_id, a.title, a.host_id, h.first_name, h.photo_path,
    a.starts_at, a.ends_at, a.area_name,
    round(public.distance_km(me.lat, me.lng, a.lat, a.lng)::numeric, 1),
    a.participant_limit, public.going_count(a.id), a.visibility,
    coalesce((select public.participation_status(p.status, p.decline_at) from public.participations p
      where p.activity_id = a.id and p.user_id = me.id), 'none')
  from public.activities a
  join public.users h on h.id = a.host_id
  cross join me
  where a.status = 'open' and a.starts_at > now()
    and a.host_id <> me.id
    and not public.is_blocked(me.id, a.host_id)
    and not exists (select 1 from public.participations p
      where p.activity_id = a.id and p.status = 'accepted' and public.is_blocked(me.id, p.user_id))
    and (
      a.host_id in (select uid from friends)
      or (a.visibility = 'connections_and_nearby'
        and exists (select 1 from public.user_interests ui where ui.user_id = me.id and ui.interest_id = a.interest_id)
        and public.distance_km(me.lat, me.lng, a.lat, a.lng) <= me.radius_km)
    )
  order by a.starts_at asc
  limit 200
$$;

revoke all on function public.activities_feed() from public, anon;
grant execute on function public.activities_feed() to authenticated;
