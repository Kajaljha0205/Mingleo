-- S08 Discover / S09 Person profile: connections, requests, blocks, skips, reports, notifications.
-- Every rule (§10, §11) is enforced here in SECURITY DEFINER functions; tables aren't writable by clients.
-- Run after 0001–0003. Safe to re-run.

-- ---------- Settings used by discovery / privacy / notifications (S22 defaults) ----------
alter table public.users
  add column if not exists discoverable boolean not null default true,
  add column if not exists history_visibility text not null default 'connections',
  add column if not exists notify_connection_requests boolean not null default true,
  add column if not exists notify_request_declined boolean not null default false,
  add column if not exists discover_round integer not null default 1;

do $$ begin
  alter table public.users add constraint users_history_visibility_check
    check (history_visibility in ('connections', 'nearby', 'only_me'));
exception when duplicate_object then null; end $$;

grant update (discoverable, history_visibility, notify_connection_requests, notify_request_declined)
  on public.users to authenticated;

-- ---------- Tables ----------
create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.users (id) on delete cascade,
  to_user uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);
-- One open request per pair, in either direction.
create unique index if not exists connection_requests_one_open_per_pair
  on public.connection_requests (least(from_user, to_user), greatest(from_user, to_user))
  where status = 'pending';
create index if not exists connection_requests_from_created on public.connection_requests (from_user, created_at);

create table if not exists public.connections (
  user_a uuid not null references public.users (id) on delete cascade,
  user_b uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists connections_user_b on public.connections (user_b);

create table if not exists public.blocks (
  blocker uuid not null references public.users (id) on delete cascade,
  blocked uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table if not exists public.skips (
  viewer uuid not null references public.users (id) on delete cascade,
  skipped uuid not null references public.users (id) on delete cascade,
  round integer not null,
  created_at timestamptz not null default now(),
  primary key (viewer, skipped, round)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.users (id) on delete cascade,
  reported_user uuid not null references public.users (id) on delete cascade,
  reason text not null check (reason in ('fake_profile', 'inappropriate', 'harassment', 'spam', 'underage', 'other')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('connection_request', 'connection_accepted', 'connection_declined')),
  actor_id uuid references public.users (id) on delete cascade,
  request_id uuid references public.connection_requests (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created on public.notifications (user_id, created_at desc);

alter table public.connection_requests enable row level security;
alter table public.connections enable row level security;
alter table public.blocks enable row level security;
alter table public.skips enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

revoke all on public.connection_requests, public.connections, public.blocks, public.skips,
  public.reports, public.notifications from anon, authenticated;

-- Inbox (later) and the bell's unread dot read the user's own notifications.
grant select on public.notifications to authenticated;
drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------- Internal helpers (not callable by clients) ----------
create or replace function public.distance_km(lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision) returns double precision
language sql immutable set search_path = '' as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

create or replace function public.age_years(d date) returns integer
language sql stable set search_path = '' as $$
  select extract(year from age(current_date, d))::integer
$$;

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;

create or replace function public.are_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.connections
    where user_a = least(a, b) and user_b = greatest(a, b))
$$;

create or replace function public.connections_of(u uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select case when user_a = u then user_b else user_a end
  from public.connections where user_a = u or user_b = u
$$;

-- People both users are connected to (and neither has blocked), ordered by name.
create or replace function public.mutual_connections(a uuid, b uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'first_name', u.first_name, 'photo_path', u.photo_path)
    order by u.first_name), '[]'::jsonb)
  from public.users u
  where u.id in (select public.connections_of(a) intersect select public.connections_of(b))
    and not public.is_blocked(a, u.id)
$$;

-- §10 rule 11: owner's "Who sees my activity history" (connections / everyone nearby / only me).
create or replace function public.can_view_history(viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case o.history_visibility
    when 'only_me' then viewer = owner
    when 'connections' then viewer = owner or public.are_connected(viewer, owner)
    else viewer = owner or public.are_connected(viewer, owner)
      or public.distance_km(o.lat, o.lng, v.lat, v.lng) <= o.radius_km
  end
  from public.users o, public.users v
  where o.id = owner and v.id = viewer
$$;

create or replace function public.accept_request_internal(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.connection_requests;
begin
  update public.connection_requests set status = 'accepted', responded_at = now()
    where id = p_request_id and status = 'pending' returning * into r;
  if not found then return; end if;
  insert into public.connections (user_a, user_b)
    values (least(r.from_user, r.to_user), greatest(r.from_user, r.to_user))
    on conflict do nothing;
  update public.notifications set read_at = coalesce(read_at, now()) where request_id = r.id;
  insert into public.notifications (user_id, type, actor_id, request_id)
    values (r.from_user, 'connection_accepted', r.to_user, r.id);
end $$;

revoke all on function public.distance_km(double precision, double precision, double precision, double precision),
  public.age_years(date), public.is_blocked(uuid, uuid), public.are_connected(uuid, uuid),
  public.connections_of(uuid), public.mutual_connections(uuid, uuid), public.can_view_history(uuid, uuid),
  public.accept_request_internal(uuid)
  from public, anon, authenticated;

-- ---------- S08: ranked candidates (§11) ----------
-- Weights come from app config; they only change the caller's own ordering.
create or replace function public.discover_candidates(
  p_interest_id smallint default null,
  p_w_sim double precision default 0.8,
  p_w_dist double precision default 0.2,
  p_limit integer default 30
) returns table (
  id uuid, first_name text, age integer, photo_path text, area_name text, distance_km numeric,
  bio text, interest_ids smallint[], shared_count integer, mutual jsonb, hosted_count integer,
  score double precision
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select u.id, u.lat, u.lng, u.radius_km, u.discover_round,
      array(select ui.interest_id from public.user_interests ui where ui.user_id = u.id) as ints
    from public.users u
    where u.id = auth.uid() and u.onboarding_completed_at is not null
  ),
  cand as (
    select c.id, c.first_name, c.show_age, c.birth_date, c.photo_path, c.area_name, c.bio,
      public.distance_km(me.lat, me.lng, c.lat, c.lng) as d,
      array(select ui.interest_id from public.user_interests ui where ui.user_id = c.id
        order by ui.interest_id) as ints
    from public.users c cross join me
    where c.id <> me.id
      and c.onboarding_completed_at is not null
      and c.discoverable
      and c.lat is not null
      and not public.is_blocked(me.id, c.id)
      and not public.are_connected(me.id, c.id)
      and not exists (select 1 from public.connection_requests r where r.status = 'pending'
        and ((r.from_user = me.id and r.to_user = c.id) or (r.from_user = c.id and r.to_user = me.id)))
      and not exists (select 1 from public.skips s
        where s.viewer = me.id and s.skipped = c.id and s.round = me.discover_round)
  ),
  scored as (
    select cand.*,
      cardinality(array(select unnest(cand.ints) intersect select unnest(me.ints))) as shared
    from cand cross join me
    where cand.d <= me.radius_km
      and (p_interest_id is null or (p_interest_id = any (cand.ints) and p_interest_id = any (me.ints)))
  )
  select s.id, s.first_name,
    case when s.show_age then public.age_years(s.birth_date) end,
    s.photo_path, s.area_name, round(s.d::numeric, 1), s.bio, s.ints, s.shared,
    public.mutual_connections(me.id, s.id),
    0,
    p_w_sim * (case when cardinality(s.ints) = 0 or cardinality(me.ints) = 0 then 0
      else s.shared / sqrt(cardinality(s.ints)::double precision * cardinality(me.ints)) end)
      + p_w_dist * (1 - s.d / me.radius_km)
  from scored s cross join me
  order by 12 desc, s.d asc
  limit greatest(1, least(p_limit, 100))
$$;

-- ---------- S09: one person's public profile + relationship ----------
create or replace function public.person_profile(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.users;
  p public.users;
  rel text := 'none';
begin
  select * into me from public.users where id = auth.uid() and onboarding_completed_at is not null;
  if not found or p_id = me.id then return null; end if;
  select * into p from public.users where id = p_id and onboarding_completed_at is not null;
  if not found or public.is_blocked(me.id, p.id) then return null; end if;

  if public.are_connected(me.id, p.id) then rel := 'connected';
  elsif exists (select 1 from public.connection_requests
    where status = 'pending' and from_user = me.id and to_user = p.id) then rel := 'sent';
  elsif exists (select 1 from public.connection_requests
    where status = 'pending' and from_user = p.id and to_user = me.id) then rel := 'received';
  end if;

  return jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'age', case when p.show_age then public.age_years(p.birth_date) end,
    'photo_path', p.photo_path,
    'area_name', p.area_name,
    'distance_km', round(public.distance_km(me.lat, me.lng, p.lat, p.lng)::numeric, 1),
    'bio', p.bio,
    'interest_ids', array(select interest_id from public.user_interests where user_id = p.id order by interest_id),
    'viewer_interest_ids', array(select interest_id from public.user_interests where user_id = me.id),
    'mutual', public.mutual_connections(me.id, p.id),
    'hosted_count', 0,
    'history_visible', public.can_view_history(me.id, p.id),
    -- Activities aren't built yet (EP-10/11); filled in when they are.
    'recent_activities', '[]'::jsonb,
    'relationship', rel
  );
end $$;

-- ---------- Connection lifecycle (§10 transition table) ----------
create or replace function public.send_connection_request(p_to uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  rid uuid;
  sent_today integer;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_to = me or not exists (select 1 from public.users where id = p_to and onboarding_completed_at is not null)
     or public.is_blocked(me, p_to) then
    raise exception 'not_found';
  end if;
  if public.are_connected(me, p_to) then return 'connected'; end if;

  -- If they already asked me, my Connect accepts theirs.
  select id into rid from public.connection_requests
    where from_user = p_to and to_user = me and status = 'pending';
  if found then
    perform public.accept_request_internal(rid);
    return 'connected';
  end if;

  if exists (select 1 from public.connection_requests
    where from_user = me and to_user = p_to and status = 'pending') then
    return 'sent';
  end if;

  if exists (select 1 from public.connection_requests
    where from_user = me and to_user = p_to and status = 'declined'
      and responded_at > now() - interval '30 days') then
    raise exception 'cooldown';
  end if;

  -- Keep in sync with CONNECT_DAILY_LIMIT in web/src/lib/config.ts.
  select count(*) into sent_today from public.connection_requests
    where from_user = me and created_at > now() - interval '1 day';
  if sent_today >= 30 then raise exception 'rate_limited'; end if;

  insert into public.connection_requests (from_user, to_user) values (me, p_to) returning id into rid;
  if (select notify_connection_requests from public.users where id = p_to) then
    insert into public.notifications (user_id, type, actor_id, request_id)
      values (p_to, 'connection_request', me, rid);
  end if;
  return 'sent';
end $$;

create or replace function public.withdraw_connection_request(p_to uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  update public.connection_requests set status = 'withdrawn', responded_at = now()
    where from_user = auth.uid() and to_user = p_to and status = 'pending'
    returning id into rid;
  if rid is not null then delete from public.notifications where request_id = rid; end if;
  return 'none';
end $$;

create or replace function public.respond_connection_request(p_from uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare r public.connection_requests;
begin
  select * into r from public.connection_requests
    where from_user = p_from and to_user = auth.uid() and status = 'pending';
  if not found then raise exception 'not_found'; end if;

  if p_accept then
    perform public.accept_request_internal(r.id);
    return 'connected';
  end if;

  update public.connection_requests set status = 'declined', responded_at = now() where id = r.id;
  update public.notifications set read_at = coalesce(read_at, now()) where request_id = r.id;
  if (select notify_request_declined from public.users where id = r.from_user) then
    insert into public.notifications (user_id, type, actor_id, request_id)
      values (r.from_user, 'connection_declined', r.to_user, r.id);
  end if;
  return 'none';
end $$;

create or replace function public.remove_connection(p_other uuid) returns text
language sql security definer set search_path = '' as $$
  delete from public.connections
    where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other);
  select 'none'
$$;

-- ---------- Skip & rounds ----------
create or replace function public.skip_profile(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.skips (viewer, skipped, round)
    select u.id, p_id, u.discover_round from public.users u
    where u.id = auth.uid() and p_id <> u.id
  on conflict do nothing
$$;

create or replace function public.start_over_discover() returns void
language sql security definer set search_path = '' as $$
  update public.users set discover_round = discover_round + 1 where id = auth.uid()
$$;

-- ---------- Safety ----------
create or replace function public.block_user(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_id = me then raise exception 'invalid_target'; end if;
  insert into public.blocks (blocker, blocked) values (me, p_id) on conflict do nothing;
  delete from public.connections where user_a = least(me, p_id) and user_b = greatest(me, p_id);
  update public.connection_requests set status = 'withdrawn', responded_at = now()
    where status = 'pending'
      and ((from_user = me and to_user = p_id) or (from_user = p_id and to_user = me));
  delete from public.notifications
    where (user_id = me and actor_id = p_id) or (user_id = p_id and actor_id = me);
end $$;

create or replace function public.report_user(p_id uuid, p_reason text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_id = auth.uid() then raise exception 'invalid_target'; end if;
  insert into public.reports (reporter, reported_user, reason, note)
    values (auth.uid(), p_id, p_reason, nullif(trim(p_note), ''));
end $$;

revoke all on function public.discover_candidates(smallint, double precision, double precision, integer),
  public.person_profile(uuid), public.send_connection_request(uuid), public.withdraw_connection_request(uuid),
  public.respond_connection_request(uuid, boolean), public.remove_connection(uuid), public.skip_profile(uuid),
  public.start_over_discover(), public.block_user(uuid), public.report_user(uuid, text, text)
  from public, anon;
grant execute on function public.discover_candidates(smallint, double precision, double precision, integer),
  public.person_profile(uuid), public.send_connection_request(uuid), public.withdraw_connection_request(uuid),
  public.respond_connection_request(uuid, boolean), public.remove_connection(uuid), public.skip_profile(uuid),
  public.start_over_discover(), public.block_user(uuid), public.report_user(uuid, text, text)
  to authenticated;
