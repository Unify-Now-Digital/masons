-- ============================================================
-- Migration: create_proof_renders_bucket
-- Apply via: Supabase dashboard → SQL editor (after T001)
-- Creates a private storage bucket for AI-rendered proof images.
-- Access is restricted to the owning user via path prefix = user_id.
-- Signed URLs are generated client-side via createSignedUrl (requires SELECT policy).
-- ============================================================

-- Create the private bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('proof-renders', 'proof-renders', false)
on conflict (id) do nothing;

-- Storage object policies
-- Path convention: {user_id}/{order_id}/{proof_id}.png
-- (storage.foldername(name))[1] extracts the first path segment = user_id

drop policy if exists "Users can upload own proof renders" on storage.objects;
create policy "Users can upload own proof renders"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proof-renders'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can read own proof renders" on storage.objects;
create policy "Users can read own proof renders"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'proof-renders'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Users can delete own proof renders" on storage.objects;
create policy "Users can delete own proof renders"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'proof-renders'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
