-- Mingleo onboarding (S03–S07): users, interests, user_interests, avatars bucket.
-- Run once in Supabase → SQL editor. Safe to re-run.

-- ---------- Interest catalogue (fixed order, not user-editable) ----------
create table if not exists public.interests (
  id smallint primary key,
  slug text not null unique,
  name text not null,
  sort_order smallint not null unique
);

insert into public.interests (id, slug, name, sort_order) values
  (1, 'badminton', 'Badminton', 1),
  (2, 'swimming', 'Swimming', 2),
  (3, 'poker', 'Poker', 3),
  (4, 'boardgames', 'Board games', 4),
  (5, 'gaming', 'PS5 / Gaming', 5),
  (6, 'hike', 'Hiking', 6),
  (7, 'cycling', 'Cycling', 7),
  (8, 'coffee', 'Cafe exploration', 8),
  (9, 'shopping', 'Shopping', 9),
  (10, 'concert', 'Concerts', 10),
  (11, 'music', 'Music', 11),
  (12, 'movies', 'Movies', 12),
  (13, 'roadtrip', 'Road trips', 13),
  (14, 'food', 'Food exploration', 14)
on conflict (id) do nothing;

alter table public.interests enable row level security;
drop policy if exists "interests readable" on public.interests;
create policy "interests readable" on public.interests for select using (true);

-- ---------- Users (1:1 with auth.users) ----------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  google_id text unique,
  first_name text check (char_length(first_name) between 1 and 40),
  birth_date date,
  show_age boolean not null default true,
  bio text check (char_length(bio) <= 150),
  photo_path text,
  area_name text,
  city text,
  lat double precision,
  lng double precision,
  radius_km smallint not null default 5 check (radius_km in (2, 5, 10, 25)),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_interests (
  user_id uuid not null references public.users (id) on delete cascade,
  interest_id smallint not null references public.interests (id),
  primary key (user_id, interest_id)
);

-- Server-side rules the browser cannot bypass: 18+, and completion only when every step is done.
create or replace function public.enforce_user_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.birth_date is not null and new.birth_date > (current_date - interval '18 years')::date then
    raise exception 'must_be_18' using errcode = 'check_violation';
  end if;
  if new.onboarding_completed_at is not null and old.onboarding_completed_at is null then
    if new.first_name is null or new.birth_date is null or new.photo_path is null
       or new.area_name is null
       or (select count(*) from public.user_interests ui where ui.user_id = new.id) < 3 then
      raise exception 'onboarding_incomplete' using errcode = 'check_violation';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists users_rules on public.users;
create trigger users_rules before update on public.users
  for each row execute function public.enforce_user_rules();

-- Create the profile row on first Google sign-in; prefill first name from Google.
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, google_id, first_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'sub',
    nullif(left(trim(coalesce(
      new.raw_user_meta_data ->> 'given_name',
      split_part(new.raw_user_meta_data ->> 'full_name', ' ', 1),
      ''
    )), 40), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill anyone who signed in before this migration.
insert into public.users (id, google_id, first_name)
select
  u.id,
  u.raw_user_meta_data ->> 'sub',
  nullif(left(trim(coalesce(
    u.raw_user_meta_data ->> 'given_name',
    split_part(u.raw_user_meta_data ->> 'full_name', ' ', 1),
    ''
  )), 40), '')
from auth.users u
on conflict (id) do nothing;

-- ---------- Row Level Security ----------
alter table public.users enable row level security;
alter table public.user_interests enable row level security;

drop policy if exists "users read own" on public.users;
create policy "users read own" on public.users for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists "users update own" on public.users;
create policy "users update own" on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Only profile fields are writable by the signed-in user (not id / google_id / timestamps).
revoke insert, update, delete on public.users from anon, authenticated;
grant select on public.users to authenticated;
grant update (first_name, birth_date, show_age, bio, photo_path, area_name, city, lat, lng,
  radius_km, onboarding_completed_at) on public.users to authenticated;

drop policy if exists "user_interests own" on public.user_interests;
create policy "user_interests own" on public.user_interests for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- Avatars bucket (public read, owner-only writes, WebP only) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 10485760, array['image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatars select own" on storage.objects;
create policy "avatars select own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
