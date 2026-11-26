-- motzo.online accounts: run once in the Supabase SQL editor.
-- Each owner's garage, chats, quotes and settings live in one private row, and
-- their photos and files in a private storage folder named after their user id.
-- Row level security means a signed-in owner can only ever reach their own data.

create table if not exists public.motzo_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  device_id text,
  updated_at timestamptz not null default now()
);

alter table public.motzo_accounts enable row level security;

drop policy if exists "owner reads own data" on public.motzo_accounts;
create policy "owner reads own data" on public.motzo_accounts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "owner adds own data" on public.motzo_accounts;
create policy "owner adds own data" on public.motzo_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "owner changes own data" on public.motzo_accounts;
create policy "owner changes own data" on public.motzo_accounts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "owner deletes own data" on public.motzo_accounts;
create policy "owner deletes own data" on public.motzo_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Private bucket for photos, videos, documents and voice notes (50 MB per file).
insert into storage.buckets (id, name, public, file_size_limit)
values ('motzo-files', 'motzo-files', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "owner reads own files" on storage.objects;
create policy "owner reads own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'motzo-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "owner adds own files" on storage.objects;
create policy "owner adds own files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'motzo-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "owner changes own files" on storage.objects;
create policy "owner changes own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'motzo-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "owner deletes own files" on storage.objects;
create policy "owner deletes own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'motzo-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
