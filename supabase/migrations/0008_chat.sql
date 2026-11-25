-- S16 / S16-D / S17: conversations, members, messages (§12, §13), after-activity data, activity reports.
-- Membership follows participations and connections through triggers. Run after 0007. Safe to re-run.

-- ---------- Tables ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'activity')),
  activity_id uuid unique references public.activities (id) on delete cascade,
  user_a uuid references public.users (id) on delete cascade,
  user_b uuid references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (type = 'activity' and activity_id is not null and user_a is null and user_b is null)
    or (type = 'direct' and activity_id is null and user_a < user_b)
  )
);
create unique index if not exists conversations_direct_pair on public.conversations (user_a, user_b) where type = 'direct';

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  -- New members start "read up to now", so earlier history doesn't count as unread.
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user on public.conversation_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created on public.messages (conversation_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.conversation_members, public.messages from anon, authenticated;

-- ---------- Activity reports (ST-193): same reasons, target an activity instead of a person ----------
alter table public.reports alter column reported_user drop not null;
alter table public.reports add column if not exists target_activity_id uuid references public.activities (id) on delete cascade;
alter table public.reports drop constraint if exists reports_target_check;
alter table public.reports add constraint reports_target_check check (reported_user is not null or target_activity_id is not null);

-- ---------- Membership sync (ST-140) ----------
create or replace function public.sync_activity_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.conversations (type, activity_id) values ('activity', new.id) on conflict (activity_id) do nothing;
  return new;
end $$;

drop trigger if exists activities_conversation on public.activities;
create trigger activities_conversation after insert on public.activities
  for each row execute function public.sync_activity_conversation();

-- Accepted → member; withdrawn → removed. "closed" (activity cancelled) keeps read-only access.
create or replace function public.sync_participation_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select id into cid from public.conversations where activity_id = new.activity_id;
  if cid is null then return new; end if;
  if new.status = 'accepted' then
    insert into public.conversation_members (conversation_id, user_id) values (cid, new.user_id) on conflict do nothing;
  elsif new.status in ('withdrawn', 'declined', 'requested') then
    delete from public.conversation_members where conversation_id = cid and user_id = new.user_id;
  end if;
  return new;
end $$;

drop trigger if exists participations_member on public.participations;
create trigger participations_member after insert or update of status on public.participations
  for each row execute function public.sync_participation_member();

-- One direct conversation per connected pair; removing the connection (or blocking) ends it.
create or replace function public.sync_connection_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.conversations (type, user_a, user_b) values ('direct', new.user_a, new.user_b)
      on conflict (user_a, user_b) where type = 'direct' do nothing;
    select id into cid from public.conversations where type = 'direct' and user_a = new.user_a and user_b = new.user_b;
    insert into public.conversation_members (conversation_id, user_id)
      values (cid, new.user_a), (cid, new.user_b) on conflict do nothing;
    return new;
  end if;
  delete from public.conversation_members m using public.conversations c
    where c.id = m.conversation_id and c.type = 'direct' and c.user_a = old.user_a and c.user_b = old.user_b;
  return old;
end $$;

drop trigger if exists connections_conversation on public.connections;
create trigger connections_conversation after insert or delete on public.connections
  for each row execute function public.sync_connection_conversation();

-- Backfill what existed before this migration.
insert into public.conversations (type, activity_id) select 'activity', id from public.activities
  on conflict (activity_id) do nothing;
insert into public.conversation_members (conversation_id, user_id)
  select c.id, p.user_id from public.participations p join public.conversations c on c.activity_id = p.activity_id
  where p.status = 'accepted'
  on conflict do nothing;
insert into public.conversations (type, user_a, user_b) select 'direct', user_a, user_b from public.connections
  on conflict (user_a, user_b) where type = 'direct' do nothing;
insert into public.conversation_members (conversation_id, user_id)
  select c.id, u from public.conversations c, unnest(array[c.user_a, c.user_b]) u
  where c.type = 'direct' and public.are_connected(c.user_a, c.user_b)
  on conflict do nothing;

-- ---------- Helpers ----------
create or replace function public.is_member(p_conversation uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = p_user)
$$;

-- null = writable; otherwise why it's read-only (§12, ST-145).
create or replace function public.chat_read_only(p_conversation uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when c.type = 'direct' then case when public.are_connected(c.user_a, c.user_b) then null else 'ended' end
    when a.status = 'cancelled' then 'cancelled'
    when now() > coalesce(a.ends_at, a.starts_at + interval '3 hours') + interval '7 days' then 'closed'
    else null
  end
  from public.conversations c left join public.activities a on a.id = c.activity_id
  where c.id = p_conversation
$$;

-- Realtime + RLS: members read their conversations' messages, except from people they've blocked / who blocked them (Q-19).
create or replace function public.can_read_message(p_conversation uuid, p_sender uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member(p_conversation, auth.uid())
    and (p_sender = auth.uid() or not public.is_blocked(auth.uid(), p_sender))
$$;

revoke all on function public.sync_activity_conversation(), public.sync_participation_member(),
  public.sync_connection_conversation(), public.is_member(uuid, uuid), public.chat_read_only(uuid)
  from public, anon, authenticated;
revoke all on function public.can_read_message(uuid, uuid) from public, anon;
grant execute on function public.can_read_message(uuid, uuid) to authenticated;

grant select on public.messages to authenticated;
drop policy if exists "messages read as member" on public.messages;
create policy "messages read as member" on public.messages for select to authenticated
  using (public.can_read_message(conversation_id, sender_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------- Chat RPCs (ST-141, ST-144) ----------
create or replace function public.activity_conversation(p_activity uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.conversations c
  where c.activity_id = p_activity and public.is_member(c.id, auth.uid())
$$;

-- Get-or-create for a connected pair; null when not connected.
create or replace function public.direct_conversation(p_other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null or p_other = me or not public.are_connected(me, p_other) then return null; end if;
  insert into public.conversations (type, user_a, user_b) values ('direct', least(me, p_other), greatest(me, p_other))
    on conflict (user_a, user_b) where type = 'direct' do nothing;
  select id into cid from public.conversations
    where type = 'direct' and user_a = least(me, p_other) and user_b = greatest(me, p_other);
  insert into public.conversation_members (conversation_id, user_id) values (cid, me), (cid, p_other) on conflict do nothing;
  return cid;
end $$;

create or replace function public.chat_thread(p_conversation uuid, p_before timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.users;
  c public.conversations;
  a public.activities;
  other uuid;
  last_own public.messages;
  page_size constant integer := 50;
begin
  select * into me from public.users where id = auth.uid() and onboarding_completed_at is not null;
  if not found or not public.is_member(p_conversation, me.id) then return null; end if;
  select * into c from public.conversations where id = p_conversation;
  if c.type = 'activity' then
    select * into a from public.activities where id = c.activity_id;
  else
    other := case when c.user_a = me.id then c.user_b else c.user_a end;
  end if;

  select * into last_own from public.messages
    where conversation_id = c.id and sender_id = me.id order by created_at desc limit 1;

  return jsonb_build_object(
    'id', c.id,
    'type', c.type,
    'read_only', public.chat_read_only(c.id),
    'activity', case when c.type = 'activity' then jsonb_build_object(
      'id', a.id, 'interest_id', a.interest_id, 'title', a.title, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
      'area_name', a.area_name, 'address', a.address,
      'distance_km', round(public.distance_km(me.lat, me.lng, a.lat, a.lng)::numeric, 1),
      'participant_limit', a.participant_limit, 'going', public.going_count(a.id),
      'phase', public.activity_phase(a), 'host_id', a.host_id,
      'viewer_role', case when a.host_id = me.id then 'host' else 'participant' end,
      'host_first_name', (select first_name from public.users where id = a.host_id)
    ) end,
    'other', case when c.type = 'direct' then (
      select jsonb_build_object('id', u.id, 'first_name', u.first_name, 'photo_path', u.photo_path)
      from public.users u where u.id = other
    ) end,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'first_name', u.first_name, 'photo_path', u.photo_path,
          'is_host', a.host_id is not null and u.id = a.host_id)
        order by (u.id = a.host_id) desc, m.joined_at)
      from public.conversation_members m join public.users u on u.id = m.user_id
      where m.conversation_id = c.id and (u.id = me.id or not public.is_blocked(me.id, u.id))
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'sender_id', x.sender_id, 'body', x.body, 'created_at', x.created_at)
        order by x.created_at)
      from (
        select * from public.messages
        where conversation_id = c.id and (p_before is null or created_at < p_before)
          and (sender_id = me.id or not public.is_blocked(me.id, sender_id))
        order by created_at desc limit page_size
      ) x
    ), '[]'::jsonb),
    'has_more', (
      select count(*) > page_size from public.messages
      where conversation_id = c.id and (p_before is null or created_at < p_before)
    ),
    'last_own_id', last_own.id,
    'seen_by', case when last_own.id is null then 0 else (
      select count(*)::integer from public.conversation_members m
      where m.conversation_id = c.id and m.user_id <> me.id and m.last_read_at >= last_own.created_at
        and not public.is_blocked(me.id, m.user_id)
    ) end
  );
end $$;

create or replace function public.send_message(p_conversation uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  body text := trim(p_body);
  msg public.messages;
begin
  if me is null or not public.is_member(p_conversation, me) then raise exception 'not_found'; end if;
  if public.chat_read_only(p_conversation) is not null then raise exception 'read_only'; end if;
  if body is null or char_length(body) = 0 or char_length(body) > 1000 then raise exception 'invalid_body'; end if;
  insert into public.messages (conversation_id, sender_id, body) values (p_conversation, me, body) returning * into msg;
  update public.conversation_members set last_read_at = msg.created_at where conversation_id = p_conversation and user_id = me;
  return jsonb_build_object('id', msg.id, 'sender_id', msg.sender_id, 'body', msg.body, 'created_at', msg.created_at);
end $$;

create or replace function public.mark_read(p_conversation uuid) returns void
language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid()
$$;

-- ---------- S17 (ST-131): only completed activities the viewer took part in ----------
create or replace function public.after_activity(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.users;
  a public.activities;
  cid uuid;
begin
  select * into me from public.users where id = auth.uid() and onboarding_completed_at is not null;
  if not found then return null; end if;
  select * into a from public.activities where id = p_id;
  if not found or not exists (select 1 from public.participations
    where activity_id = a.id and user_id = me.id and status = 'accepted') then return null; end if;
  select id into cid from public.conversations where activity_id = a.id;

  return jsonb_build_object(
    'id', a.id, 'interest_id', a.interest_id, 'title', a.title, 'description', a.description,
    'area_name', a.area_name, 'address', a.address, 'starts_at', a.starts_at,
    'participant_limit', a.participant_limit, 'visibility', a.visibility,
    'phase', public.activity_phase(a),
    'viewer_first_name', me.first_name,
    'chat_read_only', public.chat_read_only(cid),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', u.id, 'first_name', u.first_name, 'photo_path', u.photo_path, 'is_host', p.role = 'host',
          'relationship', case
            when public.are_connected(me.id, u.id) then 'connected'
            when exists (select 1 from public.connection_requests r where r.status = 'pending'
              and r.from_user = me.id and r.to_user = u.id) then 'sent'
            when exists (select 1 from public.connection_requests r where r.status = 'pending'
              and r.from_user = u.id and r.to_user = me.id) then 'received'
            else 'none' end,
          'together', (select count(*)::integer from public.participations x
            join public.participations y on y.activity_id = x.activity_id and y.user_id = u.id and y.status = 'accepted'
            join public.activities z on z.id = x.activity_id
            where x.user_id = me.id and x.status = 'accepted' and public.activity_phase(z) = 'completed'))
        order by (p.role = 'host') desc, u.first_name)
      from public.participations p join public.users u on u.id = p.user_id
      where p.activity_id = a.id and p.status = 'accepted' and u.id <> me.id and not public.is_blocked(me.id, u.id)
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.report_activity(p_id uuid, p_reason text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.activities;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into a from public.activities where id = p_id;
  if not found or not public.can_view_activity(auth.uid(), a) then raise exception 'not_found'; end if;
  insert into public.reports (reporter, target_activity_id, reason, note)
    values (auth.uid(), p_id, p_reason, nullif(trim(p_note), ''));
end $$;

revoke all on function public.activity_conversation(uuid), public.direct_conversation(uuid),
  public.chat_thread(uuid, timestamptz), public.send_message(uuid, text), public.mark_read(uuid),
  public.after_activity(uuid), public.report_activity(uuid, text, text)
  from public, anon;
grant execute on function public.activity_conversation(uuid), public.direct_conversation(uuid),
  public.chat_thread(uuid, timestamptz), public.send_message(uuid, text), public.mark_read(uuid),
  public.after_activity(uuid), public.report_activity(uuid, text, text)
  to authenticated;
