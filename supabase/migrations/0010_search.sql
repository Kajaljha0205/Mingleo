-- S18 / S19 Search (§9, §11): plain filters combined with AND, no ranking score.
-- Run after 0009. Safe to re-run.

create index if not exists user_interests_interest on public.user_interests (interest_id, user_id);
create index if not exists activities_open_interest on public.activities (interest_id, starts_at) where status = 'open';

-- S18: first name or interest name, interest; within the viewer's saved radius (Q-50); nearest first.
-- Same exclusions as Discover except connections and pending requests are shown (labelled);
-- people with "Show me in Discover" off stay findable by their connections only (Q-55).
create or replace function public.search_people(
  p_text text default null,
  p_interest_id smallint default null,
  p_limit integer default 60
) returns table (
  id uuid, first_name text, age integer, photo_path text, area_name text, distance_km numeric,
  interest_ids smallint[], mutual_count integer, relationship text
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select u.id, u.lat, u.lng, u.radius_km as r, lower(nullif(trim(p_text), '')) as q
    from public.users u
    where u.id = auth.uid() and u.onboarding_completed_at is not null
  ),
  hit as (
    select c.*, public.distance_km(me.lat, me.lng, c.lat, c.lng) as d
    from public.users c cross join me
    where c.id <> me.id
      and c.onboarding_completed_at is not null
      and (c.discoverable or public.are_connected(me.id, c.id))
      and c.lat is not null
      and not public.is_blocked(me.id, c.id)
      and (p_interest_id is null
        or exists (select 1 from public.user_interests ui where ui.user_id = c.id and ui.interest_id = p_interest_id))
      and (me.q is null
        or strpos(lower(c.first_name), me.q) > 0
        or exists (select 1 from public.user_interests ui join public.interests i on i.id = ui.interest_id
          where ui.user_id = c.id and strpos(lower(i.name), me.q) > 0))
  )
  select h.id, h.first_name,
    case when h.show_age then public.age_years(h.birth_date) end,
    h.photo_path, h.area_name, round(h.d::numeric, 1),
    array(select ui.interest_id from public.user_interests ui where ui.user_id = h.id order by ui.interest_id),
    jsonb_array_length(public.mutual_connections(me.id, h.id)),
    case
      when public.are_connected(me.id, h.id) then 'connected'
      when exists (select 1 from public.connection_requests q
        where q.status = 'pending' and q.from_user = me.id and q.to_user = h.id) then 'sent'
      when exists (select 1 from public.connection_requests q
        where q.status = 'pending' and q.from_user = h.id and q.to_user = me.id) then 'received'
      else 'none'
    end
  from hit h cross join me
  where h.d <= me.r
  order by h.d asc, h.first_name, h.id
  limit greatest(1, least(p_limit, 100))
$$;

-- S19: title, interest, local day (IST), within the viewer's saved radius; only open, not started activities
-- the viewer may see (§10 rules 5 & 7, can_view_activity); optional "From your people" (Q-18). Soonest first.
create or replace function public.search_activities(
  p_text text default null,
  p_interest_id smallint default null,
  p_date date default null,
  p_from_people boolean default false,
  p_limit integer default 60
) returns table (
  id uuid, interest_id smallint, title text,
  host_id uuid, host_first_name text, host_photo_path text,
  starts_at timestamptz, ends_at timestamptz, area_name text, distance_km numeric,
  participant_limit smallint, going integer, visibility text, viewer_state text
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select u.id, u.lat, u.lng, u.radius_km as r, lower(nullif(trim(p_text), '')) as q
    from public.users u
    where u.id = auth.uid() and u.onboarding_completed_at is not null
  )
  select a.id, a.interest_id, a.title, a.host_id, h.first_name, h.photo_path,
    a.starts_at, a.ends_at, a.area_name,
    round(public.distance_km(me.lat, me.lng, a.lat, a.lng)::numeric, 1),
    a.participant_limit, public.going_count(a.id), a.visibility,
    case when a.host_id = me.id then 'host' else
      coalesce((select public.participation_status(p.status, p.decline_at) from public.participations p
        where p.activity_id = a.id and p.user_id = me.id), 'none')
    end
  from public.activities a
  join public.users h on h.id = a.host_id
  cross join me
  where a.status = 'open' and a.starts_at > now()
    and public.can_view_activity(me.id, a)
    and not exists (select 1 from public.participations p
      where p.activity_id = a.id and p.status = 'accepted' and public.is_blocked(me.id, p.user_id))
    and public.distance_km(me.lat, me.lng, a.lat, a.lng) <= me.r
    and (p_interest_id is null or a.interest_id = p_interest_id)
    and (p_date is null or (a.starts_at at time zone 'Asia/Kolkata')::date = p_date)
    and (not p_from_people or public.are_connected(me.id, a.host_id))
    and (me.q is null or strpos(lower(a.title), me.q) > 0)
  order by a.starts_at asc, a.id
  limit greatest(1, least(p_limit, 100))
$$;

revoke all on function public.search_people(text, smallint, integer),
  public.search_activities(text, smallint, date, boolean, integer)
  from public, anon;
grant execute on function public.search_people(text, smallint, integer),
  public.search_activities(text, smallint, date, boolean, integer)
  to authenticated;
