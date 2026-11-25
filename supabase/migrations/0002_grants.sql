-- Explicit table privileges. Newer Supabase projects don't auto-grant API roles on tables
-- created in the SQL editor, so RLS policies alone aren't enough. Safe to re-run.

grant usage on schema public to anon, authenticated;

grant select on public.interests to anon, authenticated;

grant select, insert, delete on public.user_interests to authenticated;

-- users: read own row (RLS) and update profile columns only (as in 0001).
grant select on public.users to authenticated;
grant update (first_name, birth_date, show_age, bio, photo_path, area_name, city, lat, lng,
  radius_km, onboarding_completed_at) on public.users to authenticated;
