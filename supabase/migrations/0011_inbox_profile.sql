-- S20 Inbox, S21 My profile, S21-C Connections list (§9, §12). Run after 0010. Safe to re-run.

create index if not exists notifications_user_unread on public.notifications (user_id) where read_at is null;
create index if not exists participations_user_status on public.participations (user_id, status);
create index if not exists connection_requests_to_pending on public.connection_requests (to_user) where status = 'pending';

-- Shared interests between two users.
create or replace function public.shared_interest_count(a uuid, b uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.user_interests x
  join public.user_interests y on y.interest_id = x.interest_id and y.user_id = b
  where x.user_id = a
$$;
revoke all on function public.shared_interest_count(uuid, uuid) from public, anon, authenticated;

-- ---------- S20 Notifications tab ----------
-- "Needs your reply" = connection requests / join requests that are still open; everything else is "Earlier".
create or replace function public.inbox_notifications() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.users;
begin
  select * into me from public.users where id = auth.uid() and onboarding_completed_at is not null;
  if not found then return null; end if;

  return (
    with n as (
      select x.*,
        case x.type
          when 'connection_request' then exists (select 1 from public.connection_requests r
            where r.id = x.request_id and r.status = 'pending')
          when 'join_requested' then exists (select 1 from public.participations p
            join public.activities a on a.id = p.activity_id
            where p.activity_id = x.activity_id and p.user_id = x.actor_id and p.status = 'requested'
              and p.decline_at is null and public.activity_phase(a) = 'open')
          else false
        end as needs_reply
      from public.notifications x
      where x.user_id = me.id and x.created_at <= now()
        and (x.actor_id is null or not public.is_blocked(me.id, x.actor_id))
    ),
    shown as (
      (select * from n where needs_reply)
      union all
      (select * from n where not needs_reply and type not in ('connection_request', 'join_requested')
        order by created_at desc limit 50)
    )
    select jsonb_build_object(
      'unread', (select count(*) from n where read_at is null),
      'items', coalesce(jsonb_agg(jsonb_build_object(
          'id', s.id, 'type', s.type, 'created_at', s.created_at, 'needs_reply', s.needs_reply,
          'actor', case when u.id is null then null else jsonb_build_object(
            'id', u.id, 'first_name', u.first_name, 'photo_path', u.photo_path,
            'connected', public.are_connected(me.id, u.id),
            'distance_km', round(public.distance_km(me.lat, me.lng, u.lat, u.lng)::numeric, 1),
            'shared_count', public.shared_interest_count(me.id, u.id)) end,
          'activity', case when a.id is null then null else jsonb_build_object(
            'id', a.id, 'title', a.title, 'host_first_name', h.first_name, 'cancel_note', a.cancel_note) end)
        order by s.needs_reply desc, s.created_at desc), '[]'::jsonb)
    )
    from shown s
    left join public.users u on u.id = s.actor_id
    left join public.activities a on a.id = s.activity_id
    left join public.users h on h.id = a.host_id
  );
end $$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and created_at <= now()
$$;

-- Decline now lands after a 10 s Undo window (like S14 join declines), so the requester never sees an undone decline.
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
    insert into public.notifications (user_id, type, actor_id, request_id, created_at)
      values (r.from_user, 'connection_declined', r.to_user, r.id, now() + interval '10 seconds');
  end if;
  return 'none';
end $$;

create or replace function public.undo_connection_decline(p_from uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  update public.connection_requests set status = 'pending', responded_at = null
    where from_user = p_from and to_user = auth.uid() and status = 'declined'
      and responded_at > now() - interval '10 seconds'
      and not public.is_blocked(p_from, auth.uid())
    returning id into rid;
  if rid is null then raise exception 'too_late'; end if;
  delete from public.notifications where request_id = rid and type = 'connection_declined';
  update public.notifications set read_at = null where request_id = rid and type = 'connection_request';
  return 'received';
end $$;

-- ---------- S20 Chats tab (ST-141.1, ST-146) ----------
create or replace function public.inbox_conversations() returns table (
  id uuid, type text, activity_id uuid, title text, interest_id smallint,
  other_id uuid, other_first_name text, other_photo_path text,
  last_body text, last_sender_id uuid, last_sender_first_name text, last_at timestamptz, unread integer
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.type, a.id, a.title, a.interest_id, o.id, o.first_name, o.photo_path,
    l.body, l.sender_id, s.first_name, l.created_at,
    (select count(*)::integer from public.messages m
      where m.conversation_id = c.id and m.sender_id <> me.user_id and m.created_at > me.last_read_at
        and not public.is_blocked(me.user_id, m.sender_id))
  from public.conversation_members me
  join public.users v on v.id = me.user_id and v.onboarding_completed_at is not null
  join public.conversations c on c.id = me.conversation_id
  left join public.activities a on a.id = c.activity_id
  left join public.users o on c.type = 'direct'
    and o.id = case when c.user_a = me.user_id then c.user_b else c.user_a end
  left join lateral (select m.body, m.sender_id, m.created_at from public.messages m
    where m.conversation_id = c.id and (m.sender_id = me.user_id or not public.is_blocked(me.user_id, m.sender_id))
    order by m.created_at desc limit 1) l on true
  left join public.users s on s.id = l.sender_id
  where me.user_id = auth.uid()
    and (c.type = 'activity' or not public.is_blocked(c.user_a, c.user_b))
  order by coalesce(l.created_at, c.created_at) desc
  limit 100
$$;

-- 'Chats · n' and the messages icon: total unread messages (Q-58).
create or replace function public.unread_chat_count() returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(unread), 0)::integer from public.inbox_conversations()
$$;

-- ---------- S21 My profile ----------
-- Tabs (ST-173): created = hosting, not finished; joined = going / requested, not finished; past = completed or cancelled.
create or replace function public.my_profile() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.users;
begin
  select * into me from public.users where id = auth.uid() and onboarding_completed_at is not null;
  if not found then return null; end if;

  return (
    with mine as (
      select a.*, h.first_name as host_first_name, public.activity_phase(a) as phase, public.going_count(a.id) as going,
        case when a.host_id = me.id then 'host' else public.participation_status(p.status, p.decline_at) end as my_status
      from public.participations p
      join public.activities a on a.id = p.activity_id
      join public.users h on h.id = a.host_id
      where p.user_id = me.id and (a.host_id = me.id or not public.is_blocked(me.id, a.host_id))
    ),
    tabbed as (
      select m.*, case
          when m.phase = 'cancelled' and m.my_status in ('host', 'closed') then 'past'
          when m.phase = 'completed' and m.my_status in ('host', 'accepted') then 'past'
          when m.phase in ('open', 'started') and m.my_status = 'host' then 'created'
          when m.phase in ('open', 'started') and m.my_status = 'accepted' then 'joined'
          when m.phase = 'open' and m.my_status = 'requested' then 'joined'
        end as tab
      from mine m
    ),
    friends as (select c.uid from public.connections_of(me.id) as c(uid) where not public.is_blocked(me.id, c.uid))
    select jsonb_build_object(
      'connections_count', (select count(*) from friends),
      -- Q-59: cancelled activities don't count.
      'created_count', (select count(*) from public.activities where host_id = me.id and status <> 'cancelled'),
      'joined_count', (select count(*) from public.participations p join public.activities a on a.id = p.activity_id
        where p.user_id = me.id and p.role = 'participant' and p.status = 'accepted' and a.status <> 'cancelled'),
      'pending_count', (select count(*) from public.connection_requests r
        where r.to_user = me.id and r.status = 'pending' and not public.is_blocked(me.id, r.from_user)),
      'connections_preview', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'first_name', u.first_name,
          'photo_path', u.photo_path) order by u.first_name)
        from (select u.* from public.users u join friends f on f.uid = u.id order by u.first_name limit 3) u), '[]'::jsonb),
      'activities', coalesce((select jsonb_agg(jsonb_build_object(
          'id', t.id, 'interest_id', t.interest_id, 'title', t.title, 'starts_at', t.starts_at,
          'participant_limit', t.participant_limit, 'going', t.going, 'phase', t.phase, 'tab', t.tab,
          'my_status', t.my_status, 'host_first_name', t.host_first_name)
        order by t.tab, case when t.tab = 'past' then -extract(epoch from t.starts_at) else extract(epoch from t.starts_at) end)
        from tabbed t where t.tab is not null), '[]'::jsonb)
    )
  );
end $$;

-- ---------- S21-C Connections list (ST-085) ----------
create or replace function public.my_connections() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.users;
begin
  select * into me from public.users where id = auth.uid() and onboarding_completed_at is not null;
  if not found then return null; end if;
  return jsonb_build_object(
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'first_name', u.first_name,
        'photo_path', u.photo_path, 'area_name', u.area_name,
        'distance_km', round(public.distance_km(me.lat, me.lng, u.lat, u.lng)::numeric, 1),
        'shared_count', public.shared_interest_count(me.id, u.id)) order by r.created_at desc)
      from public.connection_requests r join public.users u on u.id = r.from_user
      where r.to_user = me.id and r.status = 'pending' and not public.is_blocked(me.id, u.id)), '[]'::jsonb),
    'connections', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'first_name', u.first_name,
        'photo_path', u.photo_path, 'area_name', u.area_name) order by u.first_name, u.id)
      from public.connections_of(me.id) as c(uid) join public.users u on u.id = c.uid
      where not public.is_blocked(me.id, u.id)), '[]'::jsonb)
  );
end $$;

revoke all on function public.inbox_notifications(), public.mark_notifications_read(),
  public.respond_connection_request(uuid, boolean), public.undo_connection_decline(uuid),
  public.inbox_conversations(), public.unread_chat_count(), public.my_profile(), public.my_connections()
  from public, anon;
grant execute on function public.inbox_notifications(), public.mark_notifications_read(),
  public.respond_connection_request(uuid, boolean), public.undo_connection_decline(uuid),
  public.inbox_conversations(), public.unread_chat_count(), public.my_profile(), public.my_connections()
  to authenticated;
