-- S10–S15 Activities: activities, participations, feed / details / create / join / manage / cancel.
-- Every §10 rule is enforced here in SECURITY DEFINER functions; clients can't read or write the tables.
-- Run after 0001–0004. Safe to re-run.

-- ---------- Notification settings used by activities (S22 defaults, §12) ----------
alter table public.users
  add column if not exists notify_new_activities boolean not null default true,
  add column if not exists notify_join_decisions boolean not null default true;
grant update (notify_new_activities, notify_join_decisions) on public.users to authenticated;

-- ---------- Tables ----------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.users (id) on delete cascade,
  interest_id smallint not null references public.interests (id),
  title text not null check (char_length(title) between 1 and 60),
  description text check (char_length(description) <= 500),
  area_name text not null,
  city text not null,
  -- Exact venue / address: host and accepted participants only (§10 rule 8).
  address text check (char_length(address) <= 120),
  lat double precision not null,
  lng double precision not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  participant_limit smallint not null check (participant_limit between 2 and 20),
  visibility text not null check (visibility in ('connections', 'connections_and_nearby')),
  status text not null default 'open' check (status in ('open', 'cancelled', 'completed')),
  cancel_note text check (char_length(cancel_note) <= 200),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists activities_open_starts on public.activities (starts_at) where status = 'open';
create index if not exists activities_host on public.activities (host_id, starts_at desc);

create table if not exists public.participations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'participant' check (role in ('host', 'participant')),
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'declined', 'withdrawn', 'closed')),
  -- A host decline waits out the 10 s Undo window and counts as declined once this passes (§8 S14).
  decline_at timestamptz,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (activity_id, user_id)
);
create index if not exists participations_user on public.participations (user_id);

-- §10 rule 6: only title and details change after publishing (status / cancel note via cancel_activity).
create or replace function public.lock_published_activity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.host_id, new.interest_id, new.area_name, new.city, new.address, new.lat, new.lng, new.starts_at,
      new.ends_at, new.participant_limit, new.visibility, new.created_at)
     is distinct from
     (old.host_id, old.interest_id, old.area_name, old.city, old.address, old.lat, old.lng, old.starts_at,
      old.ends_at, old.participant_limit, old.visibility, old.created_at) then
    raise exception 'locked_field' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists activities_locked on public.activities;
create trigger activities_locked before update on public.activities
  for each row execute function public.lock_published_activity();

alter table public.activities enable row level security;
alter table public.participations enable row level security;
revoke all on public.activities, public.participations from anon, authenticated;

-- ---------- Activity notifications (§12) ----------
alter table public.notifications
  add column if not exists activity_id uuid references public.activities (id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'connection_request', 'connection_accepted', 'connection_declined',
  'activity_created', 'join_requested', 'join_accepted', 'join_declined',
  'activity_cancelled', 'participant_withdrew'
));

-- Queued notifications (a decline inside its Undo window) are dated in the future and stay hidden until then.
drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and created_at <= now());

-- ---------- Internal helpers (not callable by clients) ----------
create or replace function public.participation_status(p_status text, p_decline_at timestamptz) returns text
language sql stable set search_path = '' as $$
  select case when p_status = 'requested' and p_decline_at is not null and p_decline_at <= now()
    then 'declined' else p_status end
$$;

-- open → started → completed (end time, or start + 3 h); "Full" is derived separately.
create or replace function public.activity_phase(a public.activities) returns text
language sql stable set search_path = '' as $$
  select case
    when a.status = 'cancelled' then 'cancelled'
    when a.status = 'completed' or now() >= coalesce(a.ends_at, a.starts_at + interval '3 hours') then 'completed'
    when now() >= a.starts_at then 'started'
    else 'open'
  end
$$;

-- Accepted participants, host included (§10 rule 3).
create or replace function public.going_count(p_activity uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.participations where activity_id = p_activity and status = 'accepted'
$$;

-- §10 rules 5 and 7. Anyone already involved keeps access (e.g. to see "Cancelled by host").
create or replace function public.can_view_activity(viewer uuid, a public.activities) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when a.host_id = viewer then true
    when public.is_blocked(viewer, a.host_id) then false
    when exists (select 1 from public.participations p where p.activity_id = a.id and p.user_id = viewer) then true
    when a.status = 'cancelled' then false
    when public.are_connected(viewer, a.host_id) then true
    when a.visibility = 'connections_and_nearby' then exists (
      select 1 from public.users v
      where v.id = viewer
        and exists (select 1 from public.user_interests ui where ui.user_id = viewer and ui.interest_id = a.interest_id)
        and public.distance_km(v.lat, v.lng, a.lat, a.lng) <= v.radius_km)
    else false
  end
$$;

revoke all on function public.participation_status(text, timestamptz), public.activity_phase(public.activities),
  public.going_count(uuid), public.can_view_activity(uuid, public.activities)
  from public, anon, authenticated;

-- ---------- S10: feed (§8 S10) ----------
create or replace function public.activities_feed() returns table (
  id uuid, section text, interest_id smallint, title text,
  host_id uuid, host_first_name text, host_photo_path text,
  starts_at timestamptz, ends_at timestamptz, area_name text, distance_km numeric,
  participant_limit smallint, going integer, visibility text
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
    a.participant_limit, public.going_count(a.id), a.visibility
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

-- ---------- S11: details with viewer state ----------
create or replace function public.activity_details(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.users;
  a public.activities;
  h public.users;
  part public.participations;
  vstate text := 'none';
  insider boolean;
begin
  select * into me from public.users where id = auth.uid() and onboarding_completed_at is not null;
  if not found then return null; end if;
  select * into a from public.activities where id = p_id;
  if not found or not public.can_view_activity(me.id, a) then return null; end if;
  select * into h from public.users where id = a.host_id;

  select * into part from public.participations where activity_id = a.id and user_id = me.id;
  if a.host_id = me.id then vstate := 'host';
  elsif found then vstate := public.participation_status(part.status, part.decline_at);
  end if;
  insider := vstate in ('host', 'accepted');

  return jsonb_build_object(
    'id', a.id,
    'interest_id', a.interest_id,
    'title', a.title,
    'description', a.description,
    'area_name', a.area_name,
    'city', a.city,
    'address', case when insider then a.address end,
    'distance_km', round(public.distance_km(me.lat, me.lng, a.lat, a.lng)::numeric, 1),
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'participant_limit', a.participant_limit,
    'visibility', a.visibility,
    'phase', public.activity_phase(a),
    'cancel_note', case when vstate <> 'none' then a.cancel_note end,
    'going', public.going_count(a.id),
    'viewer_state', vstate,
    'host', jsonb_build_object(
      'id', h.id,
      'first_name', h.first_name,
      'photo_path', h.photo_path,
      'connected', public.are_connected(me.id, h.id),
      'shared_count', (select count(*) from public.user_interests x
        join public.user_interests y on y.interest_id = x.interest_id and y.user_id = me.id
        where x.user_id = h.id),
      'hosted_count', (select count(*) from public.activities z where z.host_id = h.id and z.status <> 'cancelled')
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'first_name', u.first_name, 'photo_path', u.photo_path,
          'role', p.role)
        order by (p.role = 'host') desc, p.decided_at, u.first_name)
      from public.participations p join public.users u on u.id = p.user_id
      where p.activity_id = a.id and p.status = 'accepted'
        and (u.id = me.id or not public.is_blocked(me.id, u.id))
    ), '[]'::jsonb)
  );
end $$;

-- ---------- S12/S13: publish (§10 draft → open) ----------
create or replace function public.create_activity(
  p_interest_id smallint, p_title text, p_description text,
  p_area_name text, p_city text, p_lat double precision, p_lng double precision, p_address text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_limit smallint, p_visibility text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  aid uuid;
begin
  if me is null or not exists (select 1 from public.users where id = me and onboarding_completed_at is not null) then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_starts_at is null or p_starts_at <= now() then raise exception 'start_in_past'; end if;

  insert into public.activities (host_id, interest_id, title, description, area_name, city, address, lat, lng,
    starts_at, ends_at, participant_limit, visibility)
  values (me, p_interest_id, trim(p_title), nullif(trim(p_description), ''), p_area_name, p_city,
    nullif(trim(p_address), ''), p_lat, p_lng, p_starts_at, p_ends_at, p_limit, p_visibility)
  returning id into aid;

  -- The host is the first accepted participant and counts toward the limit.
  insert into public.participations (activity_id, user_id, role, status, decided_at)
    values (aid, me, 'host', 'accepted', now());

  -- Connections who share the interest, if "New activities from connections" is on (§12).
  insert into public.notifications (user_id, type, actor_id, activity_id)
    select c.uid, 'activity_created', me, aid
    from public.connections_of(me) as c(uid)
    join public.users u on u.id = c.uid
    where u.notify_new_activities
      and exists (select 1 from public.user_interests ui where ui.user_id = c.uid and ui.interest_id = p_interest_id)
      and not public.is_blocked(me, c.uid);
  return aid;
end $$;

-- ST-114: title and details only — there are no parameters for anything else.
create or replace function public.update_activity_details(p_id uuid, p_title text, p_description text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.activities set title = trim(p_title), description = nullif(trim(p_description), '')
    where id = p_id and host_id = auth.uid() and status = 'open';
  if not found then raise exception 'not_found'; end if;
end $$;

-- ---------- Join requests (§10 join request and participation) ----------
create or replace function public.request_to_join(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  a public.activities;
  part public.participations;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into a from public.activities where id = p_id for update;
  if not found or a.host_id = me or not public.can_view_activity(me, a) then raise exception 'not_found'; end if;
  if public.activity_phase(a) <> 'open' then raise exception 'closed'; end if;

  select * into part from public.participations where activity_id = a.id and user_id = me;
  if found then
    case public.participation_status(part.status, part.decline_at)
      when 'requested' then return 'requested';
      when 'accepted' then return 'accepted';
      when 'declined' then raise exception 'declined';
      when 'closed' then raise exception 'closed';
      else null; -- withdrawn: may ask again
    end case;
  end if;
  if public.going_count(a.id) >= a.participant_limit then raise exception 'full'; end if;

  if part.id is not null then
    update public.participations
      set status = 'requested', decline_at = null, requested_at = now(), decided_at = null
      where id = part.id;
  else
    insert into public.participations (activity_id, user_id) values (a.id, me);
  end if;
  insert into public.notifications (user_id, type, actor_id, activity_id)
    values (a.host_id, 'join_requested', me, a.id);
  return 'requested';
end $$;

create or replace function public.withdraw_join_request(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  delete from public.participations
    where activity_id = p_id and user_id = me and status = 'requested'
      and (decline_at is null or decline_at > now());
  if found then
    delete from public.notifications where activity_id = p_id
      and ((type = 'join_requested' and actor_id = me) or (type = 'join_declined' and user_id = me));
  end if;
  return 'none';
end $$;

create or replace function public.withdraw_from_activity(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  host uuid;
begin
  select a.host_id into host from public.activities a where a.id = p_id and a.status = 'open';
  if not found then raise exception 'not_found'; end if;
  update public.participations set status = 'withdrawn', decided_at = now()
    where activity_id = p_id and user_id = me and role = 'participant' and status = 'accepted';
  if not found then raise exception 'not_found'; end if;
  insert into public.notifications (user_id, type, actor_id, activity_id)
    values (host, 'participant_withdrew', me, p_id);
  return 'withdrawn';
end $$;

-- ---------- S14: host view ----------
create or replace function public.manage_activity(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.users;
  a public.activities;
begin
  select * into me from public.users where id = auth.uid() and onboarding_completed_at is not null;
  if not found then return null; end if;
  select * into a from public.activities where id = p_id and host_id = me.id;
  if not found then return null; end if;

  return jsonb_build_object(
    'id', a.id,
    'interest_id', a.interest_id,
    'title', a.title,
    'description', a.description,
    'area_name', a.area_name,
    'city', a.city,
    'address', a.address,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'participant_limit', a.participant_limit,
    'visibility', a.visibility,
    'phase', public.activity_phase(a),
    'cancel_note', a.cancel_note,
    'going', public.going_count(a.id),
    -- Declines inside their Undo window are already off the list.
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'user_id', u.id,
          'first_name', u.first_name,
          'age', case when u.show_age then public.age_years(u.birth_date) end,
          'photo_path', u.photo_path,
          'connected', public.are_connected(me.id, u.id),
          'distance_km', round(public.distance_km(me.lat, me.lng, u.lat, u.lng)::numeric, 1),
          'shared_interest_ids', array(select x.interest_id from public.user_interests x
            join public.user_interests y on y.interest_id = x.interest_id and y.user_id = me.id
            where x.user_id = u.id order by x.interest_id))
        order by p.requested_at)
      from public.participations p join public.users u on u.id = p.user_id
      where p.activity_id = a.id and p.status = 'requested' and p.decline_at is null
        and not public.is_blocked(me.id, u.id)
    ), '[]'::jsonb),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'first_name', u.first_name, 'photo_path', u.photo_path,
          'role', p.role, 'connected', public.are_connected(me.id, u.id))
        order by (p.role = 'host') desc, p.decided_at, u.first_name)
      from public.participations p join public.users u on u.id = p.user_id
      where p.activity_id = a.id and p.status = 'accepted'
        and (u.id = me.id or not public.is_blocked(me.id, u.id))
    ), '[]'::jsonb)
  );
end $$;

-- §10 rule 3: the activity row lock serialises simultaneous accepts, so accepted (incl. host) ≤ limit.
create or replace function public.accept_join_request(p_participation uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  part public.participations;
  a public.activities;
begin
  select * into part from public.participations where id = p_participation;
  if not found then raise exception 'not_found'; end if;
  select * into a from public.activities where id = part.activity_id and host_id = me for update;
  if not found then raise exception 'not_found'; end if;
  select * into part from public.participations where id = p_participation;
  if part.status <> 'requested' or part.decline_at is not null then raise exception 'not_found'; end if;
  if public.activity_phase(a) <> 'open' then raise exception 'closed'; end if;
  if public.going_count(a.id) >= a.participant_limit then raise exception 'full'; end if;

  update public.participations set status = 'accepted', decided_at = now() where id = part.id;
  update public.notifications set read_at = coalesce(read_at, now())
    where user_id = me and type = 'join_requested' and activity_id = a.id and actor_id = part.user_id;
  if (select notify_join_decisions from public.users where id = part.user_id) then
    insert into public.notifications (user_id, type, actor_id, activity_id)
      values (part.user_id, 'join_accepted', me, a.id);
  end if;
  return 'accepted';
end $$;

-- The decline (and its notification) only takes effect when the 10 s Undo window closes — no job needed.
create or replace function public.decline_join_request(p_participation uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  part public.participations;
  commit_at timestamptz := now() + interval '10 seconds';
begin
  select p.* into part from public.participations p join public.activities a on a.id = p.activity_id
    where p.id = p_participation and a.host_id = me and a.status = 'open';
  if not found or part.status <> 'requested' or part.decline_at is not null then raise exception 'not_found'; end if;

  update public.participations set decline_at = commit_at, decided_at = commit_at where id = part.id;
  update public.notifications set read_at = coalesce(read_at, now())
    where user_id = me and type = 'join_requested' and activity_id = part.activity_id and actor_id = part.user_id;
  if (select notify_join_decisions from public.users where id = part.user_id) then
    insert into public.notifications (user_id, type, actor_id, activity_id, created_at)
      values (part.user_id, 'join_declined', me, part.activity_id, commit_at);
  end if;
  return commit_at;
end $$;

create or replace function public.undo_decline(p_participation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare part public.participations;
begin
  update public.participations p set decline_at = null, decided_at = null
    from public.activities a
    where p.id = p_participation and a.id = p.activity_id and a.host_id = auth.uid()
      and p.status = 'requested' and p.decline_at > now()
    returning p.* into part;
  if not found then raise exception 'too_late'; end if;
  delete from public.notifications
    where user_id = part.user_id and type = 'join_declined' and activity_id = part.activity_id and created_at > now();
end $$;

-- ---------- S15: cancel (§10 open → cancelled) ----------
create or replace function public.cancel_activity(p_id uuid, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  a public.activities;
begin
  select * into a from public.activities where id = p_id and host_id = me for update;
  if not found then raise exception 'not_found'; end if;
  if public.activity_phase(a) not in ('open', 'started') then raise exception 'closed'; end if;

  update public.activities set status = 'cancelled', cancel_note = nullif(trim(p_note), '') where id = a.id;
  -- Queued declines are dropped; everyone still waiting or going gets the cancellation instead.
  delete from public.notifications where activity_id = a.id and type = 'join_declined' and created_at > now();
  with closed as (
    update public.participations set status = 'closed', decided_at = now(), decline_at = null
      where activity_id = a.id and role = 'participant'
        and (status = 'accepted' or (status = 'requested' and (decline_at is null or decline_at > now())))
      returning user_id
  )
  insert into public.notifications (user_id, type, actor_id, activity_id)
    select c.user_id, 'activity_cancelled', me, a.id
    from closed c join public.users u on u.id = c.user_id
    where u.notify_join_decisions;
  update public.notifications set read_at = coalesce(read_at, now())
    where user_id = me and activity_id = a.id and type = 'join_requested';
  return 'cancelled';
end $$;

revoke all on function public.activities_feed(), public.activity_details(uuid),
  public.create_activity(smallint, text, text, text, text, double precision, double precision, text,
    timestamptz, timestamptz, smallint, text),
  public.update_activity_details(uuid, text, text), public.request_to_join(uuid), public.withdraw_join_request(uuid),
  public.withdraw_from_activity(uuid), public.manage_activity(uuid), public.accept_join_request(uuid),
  public.decline_join_request(uuid), public.undo_decline(uuid), public.cancel_activity(uuid, text)
  from public, anon;
grant execute on function public.activities_feed(), public.activity_details(uuid),
  public.create_activity(smallint, text, text, text, text, double precision, double precision, text,
    timestamptz, timestamptz, smallint, text),
  public.update_activity_details(uuid, text, text), public.request_to_join(uuid), public.withdraw_join_request(uuid),
  public.withdraw_from_activity(uuid), public.manage_activity(uuid), public.accept_join_request(uuid),
  public.decline_join_request(uuid), public.undo_decline(uuid), public.cancel_activity(uuid, text)
  to authenticated;
