-- S22 Settings: blocked people + Unblock (ST-182, ST-191); report review query (ST-194). Run after 0011. Safe to re-run.

create or replace function public.blocked_people() returns table (id uuid, first_name text, photo_path text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.first_name, u.photo_path, b.created_at
  from public.blocks b join public.users u on u.id = b.blocked
  where b.blocker = auth.uid()
  order by b.created_at desc
$$;

-- Removes only my block; the connection is not restored, and a block they placed on me stays.
create or replace function public.unblock_user(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker = auth.uid() and blocked = p_id
$$;

revoke all on function public.blocked_people(), public.unblock_user(uuid) from public, anon;
grant execute on function public.blocked_people(), public.unblock_user(uuid) to authenticated;

-- ST-194 manual review: run `select * from public.reports_review` in the Supabase SQL editor (no app access).
create or replace view public.reports_review with (security_invoker = true) as
  select r.id, r.created_at, r.reason, r.note,
    r.reporter, rep.first_name as reporter_name,
    r.reported_user, u.first_name as reported_name,
    r.target_activity_id, a.title as activity_title, a.host_id as activity_host,
    (select count(*) from public.reports x
      where x.reported_user = r.reported_user and r.reported_user is not null) as reports_on_user
  from public.reports r
  join public.users rep on rep.id = r.reporter
  left join public.users u on u.id = r.reported_user
  left join public.activities a on a.id = r.target_activity_id
  order by r.created_at desc;
revoke all on public.reports_review from public, anon, authenticated;
