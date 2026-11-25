-- S16 live "Seen by n" (ST-143.6): members can read each other's last_read_at in their own chats
-- (never across a block), and changes are pushed by Supabase Realtime. Run after 0008. Safe to re-run.

grant select on public.conversation_members to authenticated;
drop policy if exists "members read members" on public.conversation_members;
create policy "members read members" on public.conversation_members for select to authenticated
  using (public.can_read_message(conversation_id, user_id));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_members') then
    alter publication supabase_realtime add table public.conversation_members;
  end if;
end $$;
