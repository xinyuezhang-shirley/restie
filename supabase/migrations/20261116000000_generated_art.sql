-- Rusty's drawings: images generated for hobbies that aren't in the built-in
-- set, and illustrations for keepsakes. Generated and checked by the
-- `rusty-art` Edge Function (OpenAI image model + automatic checks), within
-- a monthly cap the project owner sets (IMAGE_MONTHLY_CAP).

-- What a hobby / keepsake shows once the person keeps a drawing.
alter table public.hobbies add column if not exists art_path text;
alter table public.keepsakes add column if not exists art_path text;

-- Every generation, with its checks (kept even when it failed, for the team).
create table if not exists public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('hobby', 'keepsake')),
  subject text not null,
  path text,
  status text not null check (status in ('ready', 'failed')),
  attempts integer not null default 1,
  qa jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.generated_assets enable row level security;
create policy "own generated art: read" on public.generated_assets for select using (user_id = auth.uid());

-- Images generated this month per person (the cap). Written only by the function.
create table if not exists public.image_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  count integer not null default 0,
  primary key (user_id, month)
);
alter table public.image_usage enable row level security;
create policy "own image usage: read" on public.image_usage for select using (user_id = auth.uid());

-- The drawings themselves: private bucket, one folder per person.
insert into storage.buckets (id, name, public)
values ('generated', 'generated', false)
on conflict (id) do nothing;
create policy "own generated images: read" on storage.objects
  for select using (bucket_id = 'generated' and (storage.foldername(name))[1] = auth.uid()::text);
