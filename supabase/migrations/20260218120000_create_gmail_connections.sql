-- Per-user Gmail connection (one active per user). Tokens stored server-side only.
-- Used by Edge Functions for Gmail OAuth callback, sync, and send.

create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google',
  email_address text,
  access_token text,
  refresh_token text not null,
  token_expires_at timestamptz,
  scope text,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_gmail_connections_one_active_per_user
  on public.gmail_connections (user_id)
  where status = 'active';

create index idx_gmail_connections_user_id on public.gmail_connections (user_id);

comment on table public.gmail_connections is 'Per-user Gmail OAuth connection; one active per user. Tokens never exposed to client.';

alter table public.gmail_connections enable row level security;

create policy "Users can select own gmail_connections"
  on public.gmail_connections for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own gmail_connections"
  on public.gmail_connections for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update own gmail_connections"
  on public.gmail_connections for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete own gmail_connections"
  on public.gmail_connections for delete to authenticated
  using (user_id = (select auth.uid()));
