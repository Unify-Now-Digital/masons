-- Partial payments + Revise invoice flow: invoices columns, invoice_payments table, RLS.
-- Purpose: support Stripe-hosted invoice with multiple partial payments; payment history; lock and revise flow.
-- Affected: public.invoices (new columns), public.invoice_payments (new table).

-- ---------------------------------------------------------------------------
-- 1. Invoices: add user_id (nullable) for RLS and for populating invoice_payments.user_id
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists user_id uuid references auth.users(id) on delete set null;

comment on column public.invoices.user_id is 'Invoice owner; used for RLS and invoice_payments.user_id. NULL = legacy.';

create index if not exists idx_invoices_user_id
  on public.invoices (user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Invoices: add columns for partial payments and revise flow
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists hosted_invoice_url text,
  add column if not exists amount_paid bigint default 0,
  add column if not exists amount_remaining bigint,
  add column if not exists revised_from_invoice_id uuid references public.invoices(id) on delete set null,
  add column if not exists locked_at timestamptz;

comment on column public.invoices.hosted_invoice_url is 'Stripe hosted invoice page URL after finalize/send';
comment on column public.invoices.amount_paid is 'Total paid in smallest currency unit (pence); synced from Stripe';
comment on column public.invoices.amount_remaining is 'Remaining in smallest currency unit; synced from Stripe';
comment on column public.invoices.revised_from_invoice_id is 'Set on new invoice when created via Revise (links to previous invoice)';
comment on column public.invoices.locked_at is 'Set when first payment received; editing disabled';

-- stripe_invoice_status already exists from 20260205120000_add_stripe_invoice_columns.sql

-- ---------------------------------------------------------------------------
-- 3. invoice_payments: one row per payment (history + webhook idempotency)
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  stripe_invoice_id text not null,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  amount bigint not null,
  status text not null,
  created_at timestamptz not null default now()
);

comment on table public.invoice_payments is 'One row per payment against a Stripe invoice; synced via webhook';
comment on column public.invoice_payments.user_id is 'Owner (from invoice); NULL for legacy invoices';
comment on column public.invoice_payments.amount is 'Amount in smallest currency unit (pence)';
comment on column public.invoice_payments.status is 'paid | failed | pending';

create index if not exists idx_invoice_payments_invoice_id
  on public.invoice_payments (invoice_id);

create index if not exists idx_invoice_payments_stripe_invoice_id
  on public.invoice_payments (stripe_invoice_id);

-- Idempotency: one row per charge (webhook retries must not duplicate)
create unique index if not exists idx_invoice_payments_unique_charge
  on public.invoice_payments (stripe_invoice_id, stripe_charge_id)
  where stripe_charge_id is not null;

create unique index if not exists idx_invoice_payments_unique_payment_intent
  on public.invoice_payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ---------------------------------------------------------------------------
-- 4. RLS on invoice_payments
-- ---------------------------------------------------------------------------
alter table public.invoice_payments enable row level security;

-- Authenticated: select own rows or legacy (user_id null)
create policy "invoice_payments_select_own"
  on public.invoice_payments
  for select
  to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

-- Authenticated: insert own rows only (user_id must match auth.uid() or null)
create policy "invoice_payments_insert_own"
  on public.invoice_payments
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) or user_id is null);

-- Authenticated: update own rows only
create policy "invoice_payments_update_own"
  on public.invoice_payments
  for update
  to authenticated
  using (user_id = (select auth.uid()) or user_id is null)
  with check (user_id = (select auth.uid()) or user_id is null);

-- Authenticated: delete own rows only
create policy "invoice_payments_delete_own"
  on public.invoice_payments
  for delete
  to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

-- Anon: no access (no policies = denied)
-- Service role bypasses RLS for webhook inserts; webhook must set user_id from invoice.user_id
