-- Album Kenangan Saya — skema satu keluarga
-- Jalankan di SQL Editor Supabase atau: supabase db push

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create type family_role as enum ('admin', 'anggota');
create type photo_status as enum ('pending', 'ready', 'failed');
create type photo_category as enum (
  'keluarga',
  'liburan',
  'hari-raya',
  'pernikahan',
  'kenangan-rumah',
  'cucu-liburan'
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  nama text not null,
  role family_role not null default 'anggota',
  avatar_url text,
  email text,
  no_hp text,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.family_members (id),
  status photo_status not null default 'pending',
  original_path text,
  thumbnail_path text,
  display_path text,
  mime_type text,
  file_size_bytes integer,
  width integer,
  height integer,
  title text not null default 'Kenangan Baru',
  caption text not null default '',
  place text,
  category photo_category not null default 'keluarga',
  chip text not null default 'Keluarga',
  taken_year integer,
  taken_date date,
  year_from_exif boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  deskripsi text not null default '',
  cover_photo_id uuid references public.photos (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.album_photos (
  album_id uuid not null references public.albums (id) on delete cascade,
  photo_id uuid not null references public.photos (id) on delete cascade,
  urutan integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (album_id, photo_id)
);

create table if not exists public.photo_people (
  photo_id uuid not null references public.photos (id) on delete cascade,
  family_member_id uuid not null references public.family_members (id) on delete cascade,
  primary key (photo_id, family_member_id)
);

create table if not exists public.photo_hearts (
  photo_id uuid not null references public.photos (id) on delete cascade,
  member_id uuid not null references public.family_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, member_id)
);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  photo_id uuid not null references public.photos (id) on delete cascade,
  created_by uuid not null references public.family_members (id),
  expires_at timestamptz not null,
  view_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  photo_count integer not null default 0,
  catatan text
);

create index if not exists photos_not_deleted_idx
  on public.photos (created_at desc)
  where deleted_at is null and status = 'ready';

create index if not exists photos_category_idx
  on public.photos (category)
  where deleted_at is null;

create index if not exists photos_year_idx
  on public.photos (taken_year)
  where deleted_at is null;

create index if not exists photos_search_idx
  on public.photos
  using gin (
    (
      coalesce(title, '') || ' ' ||
      coalesce(caption, '') || ' ' ||
      coalesce(place, '') || ' ' ||
      coalesce(chip, '') || ' ' ||
      coalesce(taken_year::text, '')
    )
    gin_trgm_ops
  );

create index if not exists share_links_token_idx on public.share_links (token);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists photos_touch on public.photos;
create trigger photos_touch
before update on public.photos
for each row execute function public.touch_updated_at();

drop trigger if exists albums_touch on public.albums;
create trigger albums_touch
before update on public.albums
for each row execute function public.touch_updated_at();

-- RLS: anggota keluarga yang login boleh baca/tulis data keluarga.
-- Operasi storage & purge memakai service role (bypass RLS) dari backend.
alter table public.family_members enable row level security;
alter table public.photos enable row level security;
alter table public.albums enable row level security;
alter table public.album_photos enable row level security;
alter table public.photo_people enable row level security;
alter table public.photo_hearts enable row level security;
alter table public.share_links enable row level security;
alter table public.backup_runs enable row level security;

create or replace function public.current_member_id()
returns uuid
language sql
stable
as $$
  select id from public.family_members
  where auth_user_id = auth.uid() and aktif = true
  limit 1
$$;

create or replace function public.is_family_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.family_members
    where auth_user_id = auth.uid()
      and aktif = true
      and role = 'admin'
  )
$$;

drop policy if exists family_members_select on public.family_members;
create policy family_members_select on public.family_members
  for select to authenticated
  using (auth.uid() is not null);

drop policy if exists family_members_admin_write on public.family_members;
create policy family_members_admin_write on public.family_members
  for all to authenticated
  using (public.is_family_admin())
  with check (public.is_family_admin());

drop policy if exists photos_family_read on public.photos;
create policy photos_family_read on public.photos
  for select to authenticated
  using (public.current_member_id() is not null);

drop policy if exists photos_family_write on public.photos;
create policy photos_family_write on public.photos
  for all to authenticated
  using (public.current_member_id() is not null)
  with check (uploader_id = public.current_member_id() or public.is_family_admin());

drop policy if exists albums_family on public.albums;
create policy albums_family on public.albums
  for all to authenticated
  using (public.current_member_id() is not null)
  with check (public.current_member_id() is not null);

drop policy if exists album_photos_family on public.album_photos;
create policy album_photos_family on public.album_photos
  for all to authenticated
  using (public.current_member_id() is not null)
  with check (public.current_member_id() is not null);

drop policy if exists photo_people_family on public.photo_people;
create policy photo_people_family on public.photo_people
  for all to authenticated
  using (public.current_member_id() is not null)
  with check (public.current_member_id() is not null);

drop policy if exists photo_hearts_family on public.photo_hearts;
create policy photo_hearts_family on public.photo_hearts
  for all to authenticated
  using (public.current_member_id() is not null)
  with check (member_id = public.current_member_id() or public.is_family_admin());

drop policy if exists share_links_family on public.share_links;
create policy share_links_family on public.share_links
  for all to authenticated
  using (public.current_member_id() is not null)
  with check (created_by = public.current_member_id());

drop policy if exists backup_admin on public.backup_runs;
create policy backup_admin on public.backup_runs
  for all to authenticated
  using (public.is_family_admin())
  with check (public.is_family_admin());

-- Bucket privat. Versioning bucket diaktifkan dari Dashboard Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kenangan',
  'kenangan',
  false,
  20971520,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit)
values ('kenangan-cadangan', 'kenangan-cadangan', false, 52428800)
on conflict (id) do update set public = false;

-- Tidak ada akses publik langsung ke objek. Frontend hanya memakai signed URL.
drop policy if exists kenangan_no_public on storage.objects;
create policy kenangan_no_public on storage.objects
  for select to public
  using (false);

drop policy if exists kenangan_authenticated_forbidden_direct on storage.objects;
create policy kenangan_authenticated_forbidden_direct on storage.objects
  for all to authenticated
  using (false)
  with check (false);
