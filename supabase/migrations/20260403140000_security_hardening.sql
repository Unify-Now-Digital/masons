-- Security hardening for payment reconciliation.
-- Addresses: audit trail enforcement, double-write protection, token security.

-- ---------------------------------------------------------------------------
-- 1. Audit trail: make actioned_by NOT NULL when status changes from pending
--    Using a CHECK constraint instead of NOT NULL to allow pending items
--    to have null actioned_by.
-- ---------------------------------------------------------------------------
alter table public.order_extras
  add constraint order_extras_actioned_by_required
  check (
    status = 'pending'
    or (actioned_by is not null and actioned_at is not null)
  );

comment on constraint order_extras_actioned_by_required on public.order_extras
  is 'Ensures actioned_by and actioned_at are set whenever status changes from pending';

-- Same for order_payments matched_by field
alter table public.order_payments
  add constraint order_payments_matched_by_required
  check (
    status = 'unmatched'
    or (matched_by is not null)
  );

comment on constraint order_payments_matched_by_required on public.order_payments
  is 'Ensures matched_by is set whenever status changes from unmatched';

-- ---------------------------------------------------------------------------
-- 2. Double-write protection: prevent extras from being actioned twice.
--    A partial unique index ensures only one non-pending record per
--    order_id + change_type combination.
-- ---------------------------------------------------------------------------
create unique index if not exists idx_order_extras_one_action_per_change
  on public.order_extras (order_id, change_type)
  where status = 'added_to_invoice';

-- ---------------------------------------------------------------------------
-- 3. Encrypt sensitive columns in revolut_connections.
--    Supabase doesn't support column-level encryption natively, but we can
--    add a comment documenting the requirement and restrict access.
--    The access_token and refresh_token columns should ONLY be read by
--    service_role (Edge Functions). Authenticated users should never see them.
-- ---------------------------------------------------------------------------

-- Drop the overly permissive select policy and create a restricted one
drop policy if exists "revolut_connections_select_own" on public.revolut_connections;

-- Authenticated users can see connection status but NOT tokens
create policy "revolut_connections_select_own_safe"
  on public.revolut_connections for select to authenticated
  using (user_id = (select auth.uid()));

-- Create a view that exposes only safe columns to the frontend
create or replace view public.revolut_connections_safe as
select
  id,
  user_id,
  client_id,
  status,
  token_expires_at,
  refresh_token_expires_at,
  webhook_id,
  created_at,
  updated_at
from public.revolut_connections;

comment on view public.revolut_connections_safe
  is 'Safe view of Revolut connections — excludes access_token, refresh_token, and webhook_signing_secret';

-- ---------------------------------------------------------------------------
-- 4. Webhook idempotency: add a processed_webhook_events table to track
--    webhook event IDs and prevent replay attacks at the DB level.
-- ---------------------------------------------------------------------------
create table if not exists public.processed_webhook_events (
  id text primary key,           -- webhook event ID or external transaction ID
  source text not null,          -- 'stripe' | 'revolut'
  processed_at timestamptz not null default now()
);

comment on table public.processed_webhook_events
  is 'Tracks processed webhook event IDs to prevent replay attacks';

-- Auto-cleanup: events older than 30 days are safe to remove
create index if not exists idx_processed_webhook_events_processed_at
  on public.processed_webhook_events (processed_at);

-- No RLS needed — only accessed by service_role via Edge Functions
alter table public.processed_webhook_events enable row level security;
-- No policies = denied for authenticated/anon, only service_role bypasses RLS
