-- Q-25: under-18 users can delete their own account (cascades to public.users + user_interests).
-- Only works for the signed-in user and only with an under-18 birth date. Safe to re-run.

create or replace function public.delete_underage_self(p_birth_date date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_birth_date > current_date or p_birth_date <= (current_date - interval '18 years')::date then
    raise exception 'not_underage' using errcode = 'check_violation';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_underage_self(date) from public, anon;
grant execute on function public.delete_underage_self(date) to authenticated;
