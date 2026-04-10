-- Payment reconciliation: order_payments, order_extras, revolut_connections, orders columns, triggers.

-- ---------------------------------------------------------------------------
-- 1. order_payments: tracks all incoming payments from Stripe and Revolut
-- ---------------------------------------------------------------------------
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  source text not null,                    -- 'stripe' | 'revolut'
  external_id text not null unique,        -- Stripe payment_intent ID or Revolut txn ID
  amount numeric(10,2) not null,
  currency text default 'GBP',
  payment_type text,                       -- 'deposit' | 'final' | 'permit' | 'other'
  reference text,                          -- raw reference string from payment source
  match_reason text,                       -- why auto-match succeeded or failed
  match_candidates jsonb,                  -- AI-suggested matches [{order_id, confidence, reason}]
  matched_at timestamptz,
  matched_by text,                         -- 'auto' | user display name
  status text not null default 'unmatched', -- 'unmatched' | 'matched' | 'pass_through' | 'dismissed'
  received_at timestamptz not null,
  raw_data jsonb,                          -- full webhook payload for debugging
  created_at timestamptz not null default now()
);

comment on table public.order_payments is 'All incoming payments from Stripe and Revolut with reconciliation status';

create index if not exists idx_order_payments_user_id on public.order_payments (user_id) where user_id is not null;
create index if not exists idx_order_payments_order_id on public.order_payments (order_id) where order_id is not null;
create index if not exists idx_order_payments_status on public.order_payments (status);
create index if not exists idx_order_payments_source on public.order_payments (source);
create index if not exists idx_order_payments_received_at on public.order_payments (received_at desc);

-- RLS
alter table public.order_payments enable row level security;

create policy "order_payments_select_own"
  on public.order_payments for select to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

create policy "order_payments_insert_own"
  on public.order_payments for insert to authenticated
  with check (user_id = (select auth.uid()) or user_id is null);

create policy "order_payments_update_own"
  on public.order_payments for update to authenticated
  using (user_id = (select auth.uid()) or user_id is null)
  with check (user_id = (select auth.uid()) or user_id is null);

create policy "order_payments_delete_own"
  on public.order_payments for delete to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

-- ---------------------------------------------------------------------------
-- 2. order_extras: AI-detected additional costs from conversations
-- ---------------------------------------------------------------------------
create table if not exists public.order_extras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  source text not null,                    -- 'gmail' | 'whatsapp' | 'ghl' | 'phone_note'
  source_ref text,                         -- message/thread ID from source
  change_type text,                        -- 'photo_plaque' | 'inscription_increase' | 'colour_change' | 'vase' | 'other'
  description text not null,
  quote_snippet text,                      -- verbatim excerpt from conversation
  quote_date timestamptz,
  quote_sender text,
  confidence text not null default 'medium', -- 'high' | 'medium' | 'low'
  confidence_reason text,
  suggested_amount numeric(10,2),
  status text not null default 'pending',  -- 'pending' | 'added_to_invoice' | 'dismissed'
  invoice_line_item_id text,               -- set when added to invoice
  detected_at timestamptz not null default now(),
  actioned_by text,
  actioned_at timestamptz
);

comment on table public.order_extras is 'AI-flagged billable changes from customer conversations, pending user review';

create index if not exists idx_order_extras_order_id on public.order_extras (order_id);
create index if not exists idx_order_extras_status on public.order_extras (status);
create index if not exists idx_order_extras_user_id on public.order_extras (user_id) where user_id is not null;

-- Dedup: same order + change_type + quote_date should not be inserted twice
create unique index if not exists idx_order_extras_dedup
  on public.order_extras (order_id, change_type, quote_date)
  where quote_date is not null;

-- RLS
alter table public.order_extras enable row level security;

create policy "order_extras_select_own"
  on public.order_extras for select to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

create policy "order_extras_insert_own"
  on public.order_extras for insert to authenticated
  with check (user_id = (select auth.uid()) or user_id is null);

create policy "order_extras_update_own"
  on public.order_extras for update to authenticated
  using (user_id = (select auth.uid()) or user_id is null)
  with check (user_id = (select auth.uid()) or user_id is null);

create policy "order_extras_delete_own"
  on public.order_extras for delete to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

-- ---------------------------------------------------------------------------
-- 3. revolut_connections: OAuth tokens for Revolut Business API
-- ---------------------------------------------------------------------------
create table if not exists public.revolut_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  webhook_id text,
  webhook_signing_secret text,
  status text not null default 'active',   -- 'active' | 'expired' | 'revoked'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.revolut_connections is 'Revolut Business API OAuth tokens and webhook config';

create unique index if not exists idx_revolut_connections_user_id on public.revolut_connections (user_id);

-- RLS
alter table public.revolut_connections enable row level security;

create policy "revolut_connections_select_own"
  on public.revolut_connections for select to authenticated
  using (user_id = (select auth.uid()));

create policy "revolut_connections_insert_own"
  on public.revolut_connections for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "revolut_connections_update_own"
  on public.revolut_connections for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "revolut_connections_delete_own"
  on public.revolut_connections for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. orders: add payment-tracking columns
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists total_order_value numeric(10,2),
  add column if not exists amount_paid numeric(10,2) not null default 0,
  add column if not exists final_invoice_sent_at timestamptz,
  add column if not exists final_invoice_id uuid references public.invoices(id) on delete set null;

comment on column public.orders.total_order_value is 'Total value including extras; basis for balance_due calculation';
comment on column public.orders.amount_paid is 'Sum of matched order_payments; updated by trigger';
comment on column public.orders.final_invoice_sent_at is 'When the final invoice was sent to customer';
comment on column public.orders.final_invoice_id is 'Reference to the final invoice for this order';

-- balance_due as a view column instead of generated (Supabase doesn't support generated on ALTER easily)
-- We'll compute balance_due in a view instead.

-- ---------------------------------------------------------------------------
-- 5. View: orders_with_balance for outstanding tab
-- ---------------------------------------------------------------------------
create or replace view public.orders_with_balance as
select
  o.*,
  coalesce(o.total_order_value, 0) - coalesce(o.amount_paid, 0) as balance_due
from public.orders o;

-- ---------------------------------------------------------------------------
-- 6. Trigger: recalculate orders.amount_paid when order_payments changes
-- ---------------------------------------------------------------------------
create or replace function public.update_order_amount_paid()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_order_id uuid;
begin
  -- Determine which order to update
  if tg_op = 'DELETE' then
    target_order_id := old.order_id;
  else
    target_order_id := new.order_id;
  end if;

  -- Also handle the old order_id on UPDATE if it changed
  if tg_op = 'UPDATE' and old.order_id is distinct from new.order_id and old.order_id is not null then
    update public.orders
    set amount_paid = coalesce((
      select sum(amount) from public.order_payments
      where order_id = old.order_id and status = 'matched'
    ), 0)
    where id = old.order_id;
  end if;

  if target_order_id is not null then
    update public.orders
    set amount_paid = coalesce((
      select sum(amount) from public.order_payments
      where order_id = target_order_id and status = 'matched'
    ), 0)
    where id = target_order_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_order_payments_update_amount
  after insert or update or delete on public.order_payments
  for each row execute function public.update_order_amount_paid();
