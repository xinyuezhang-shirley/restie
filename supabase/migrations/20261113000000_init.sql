-- Restie schema. Every row belongs to one (anonymous) auth user, and Row
-- Level Security makes sure people only ever see their own data.
-- Ids are generated on the device (uuid v4) so the app can work offline.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  onboarded_at timestamptz,
  tutorial_done_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  mind jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.hobbies (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  icon text not null default 'other',
  kind text not null check (kind in ('goal', 'keep')),
  goal text,
  why text,
  rhythm text,
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  created_at timestamptz not null default now(),
  last_done_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.milestones (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hobby_id uuid not null,
  title text not null,
  position integer not null default 0,
  steps_target integer not null default 3,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Tiny hobby steps ("promises") and everyday to-dos share one list.
create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('promise', 'todo')),
  hobby_id uuid,
  milestone_id uuid,
  title text not null,
  minutes integer,
  due_at timestamptz,
  timed boolean not null default false,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'done', 'let_go')),
  not_yet_count integer not null default 0,
  defer_count integer not null default 0,
  kept_at timestamptz,
  note text,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.keepsakes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('photo', 'note', 'rusty')),
  hobby_id uuid,
  task_id uuid,
  caption text not null default '',
  note text,
  photo_path text,
  sticker text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.activities (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hobby_id uuid,
  kind text not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.messages (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'rusty')),
  text text not null,
  suggestion jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.focus_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hobby_id uuid,
  task_id uuid,
  label text not null,
  minutes integer not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  outcome text check (outcome in ('did_it', 'progress', 'not_today')),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Incremental pulls filter on (user_id, updated_at).
create index if not exists hobbies_sync on public.hobbies (user_id, updated_at);
create index if not exists milestones_sync on public.milestones (user_id, updated_at);
create index if not exists tasks_sync on public.tasks (user_id, updated_at);
create index if not exists keepsakes_sync on public.keepsakes (user_id, updated_at);
create index if not exists activities_sync on public.activities (user_id, updated_at);
create index if not exists messages_sync on public.messages (user_id, updated_at);
create index if not exists focus_sessions_sync on public.focus_sessions (user_id, updated_at);

-- Row Level Security: own rows only.
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['hobbies','milestones','tasks','keepsakes','activities','messages','focus_sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- Keepsake photos: private bucket, one folder per user (<user_id>/<keepsake_id>.jpg).
insert into storage.buckets (id, name, public)
values ('keepsakes', 'keepsakes', false)
on conflict (id) do nothing;

create policy "own keepsake photos: read" on storage.objects
  for select using (bucket_id = 'keepsakes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own keepsake photos: write" on storage.objects
  for insert with check (bucket_id = 'keepsakes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own keepsake photos: update" on storage.objects
  for update using (bucket_id = 'keepsakes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own keepsake photos: delete" on storage.objects
  for delete using (bucket_id = 'keepsakes' and (storage.foldername(name))[1] = auth.uid()::text);
