-- =============================================================================
-- Unified payments ledger (Stripe + Revolut + manual) — schema, RLS, functions.
-- Spec: payments-ledger-spec.md v0.1, decisions 14 Oct 2026.
-- Expand step only: old order_payments / invoice_payments keep working until
-- 20261014120100_payments_ledger_backfill_freeze.sql runs (after the edge
-- functions that write to the ledger are deployed).
-- All money is bigint pence. Dates bucketed in Europe/London.
-- =============================================================================

-- 0. Legacy 2025 `payments` table (invoice_id, amount numeric, date…) blocks the name.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'payments' and column_name = 'date')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'payments' and column_name = 'gross_pence') then
    alter table public.payments rename to payments_legacy_2025;
    revoke insert, update, delete on public.payments_legacy_2025 from anon, authenticated;
  end if;
end $$;

-- 1. Types --------------------------------------------------------------------
do $$ begin
  create type public.payment_source as enum ('stripe', 'revolut', 'manual');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_kind as enum ('payment', 'refund', 'chargeback', 'chargeback_reversal', 'fee_adjustment');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_match_status as enum ('matched', 'suggested', 'unmatched', 'ignored', 'pending');
exception when duplicate_object then null; end $$;

-- 2. Finance permission helper (admin + member; staff excluded) ----------------
create or replace function public.user_can_view_org_finance(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'member')
  );
$$;
revoke all on function public.user_can_view_org_finance(uuid) from public, anon;
grant execute on function public.user_can_view_org_finance(uuid) to authenticated, service_role;

-- 3. Invoices: amount in pence (expand). `amount` (pounds) stays in sync until contract.
alter table public.invoices add column if not exists total_pence bigint;
update public.invoices set total_pence = round(amount * 100)::bigint where total_pence is null and amount is not null;

create or replace function public.trg_invoices_sync_total_pence()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.total_pence is null and new.amount is not null then
      new.total_pence := round(new.amount * 100)::bigint;
    elsif new.total_pence is not null and new.amount is null then
      new.amount := new.total_pence / 100.0;
    end if;
  else
    if new.amount is distinct from old.amount and new.total_pence is not distinct from old.total_pence then
      new.total_pence := round(new.amount * 100)::bigint;
    elsif new.total_pence is distinct from old.total_pence and new.amount is not distinct from old.amount then
      new.amount := new.total_pence / 100.0;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_invoices_sync_total_pence on public.invoices;
create trigger trg_invoices_sync_total_pence before insert or update of amount, total_pence on public.invoices
  for each row execute function public.trg_invoices_sync_total_pence();

-- 4. Ledger tables -------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source public.payment_source not null,
  external_id text not null,
  kind public.payment_kind not null default 'payment',
  parent_payment_id uuid references public.payments(id),
  gross_pence bigint not null,
  fee_pence bigint not null default 0,
  net_pence bigint generated always as (gross_pence - fee_pence) stored,
  currency char(3) not null default 'GBP',
  received_at timestamptz not null,
  payer_name text,
  payer_email text,
  payer_person_id uuid references public.people(id) on delete set null,
  reference_raw text,
  reference_normalized text,
  method text check (method is null or method in ('card', 'bank_transfer', 'cash', 'cheque', 'other')),
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  is_pass_through boolean not null default false,
  match_status public.payment_match_status not null default 'unmatched',
  match_confidence smallint,
  match_reason text,
  matched_by text,
  matched_by_user_id uuid,
  matched_at timestamptz,
  superseded_by uuid references public.payments(id),
  legacy_table text,
  legacy_id uuid,
  raw jsonb,
  raw_purged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_source_external_unique unique (organization_id, source, external_id),
  constraint payments_sign_check check (
    (kind = 'payment' and gross_pence > 0)
    or (kind in ('refund', 'chargeback') and gross_pence < 0)
    or kind in ('chargeback_reversal', 'fee_adjustment')
  ),
  constraint payments_refund_parent_check check (kind not in ('refund', 'chargeback') or parent_payment_id is not null or source = 'revolut')
);
create index if not exists payments_org_status_received_idx on public.payments (organization_id, match_status, received_at desc);
create index if not exists payments_reference_normalized_idx on public.payments (reference_normalized);
create unique index if not exists payments_stripe_pi_unique
  on public.payments (organization_id, stripe_payment_intent_id)
  where stripe_payment_intent_id is not null and kind = 'payment';
create index if not exists payments_parent_idx on public.payments (parent_payment_id) where parent_payment_id is not null;

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  amount_pence bigint not null check (amount_pence <> 0),
  allocation_type text not null check (allocation_type in ('deposit', 'balance', 'permit', 'extra', 'credit')),
  created_by text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  check (invoice_id is not null or order_id is not null)
);
-- One allocation per (payment, invoice, type): a Stripe charge can't be applied to the same invoice twice;
-- a permit split on the same invoice uses a separate 'permit' row.
create unique index if not exists payment_allocations_payment_invoice_unique
  on public.payment_allocations (payment_id, invoice_id, allocation_type) where invoice_id is not null;
create index if not exists payment_allocations_invoice_idx on public.payment_allocations (invoice_id) where invoice_id is not null;
create index if not exists payment_allocations_order_idx on public.payment_allocations (order_id) where order_id is not null;

create table if not exists public.payment_match_suggestions (
  payment_id uuid not null references public.payments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  score smallint not null,
  reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique nulls not distinct (payment_id, order_id, invoice_id)
);

create table if not exists public.payment_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  payment_id uuid,
  allocation_id uuid,
  action text not null,
  actor_user_id uuid,
  actor_label text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index if not exists payment_audit_log_payment_idx on public.payment_audit_log (payment_id, at desc);

-- 5. Guards --------------------------------------------------------------------
-- Allocations of a payment never exceed |gross| and keep the payment's sign.
create or replace function public.check_allocation_total()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_gross bigint;
  v_sum bigint;
begin
  select gross_pence into v_gross from public.payments where id = new.payment_id;
  select coalesce(sum(amount_pence), 0) into v_sum from public.payment_allocations where payment_id = new.payment_id;
  if sign(new.amount_pence) <> sign(v_gross) then
    raise exception 'allocation sign must match payment sign' using errcode = '23514';
  end if;
  if abs(v_sum) > abs(v_gross) then
    raise exception 'allocation exceeds payment (% > %)', abs(v_sum), abs(v_gross) using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_alloc_total on public.payment_allocations;
create constraint trigger trg_alloc_total after insert or update on public.payment_allocations
  deferrable initially deferred for each row execute function public.check_allocation_total();

-- Ledger rows are immutable except match / payer / pass-through / purge fields.
create or replace function public.trg_payments_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.source is distinct from old.source
     or new.external_id is distinct from old.external_id
     or new.kind is distinct from old.kind
     or new.gross_pence is distinct from old.gross_pence
     or new.currency is distinct from old.currency
     or new.parent_payment_id is distinct from old.parent_payment_id then
    raise exception 'payments are append-only: amount/source/id cannot change' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_payments_immutable on public.payments;
create trigger trg_payments_immutable before update on public.payments
  for each row execute function public.trg_payments_immutable();

-- Audit log: append-only.
create or replace function public.trg_audit_log_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'payment_audit_log is append-only' using errcode = '42501';
end $$;
drop trigger if exists trg_audit_log_append_only on public.payment_audit_log;
create trigger trg_audit_log_append_only before update or delete on public.payment_audit_log
  for each row execute function public.trg_audit_log_append_only();

-- 6. Audit triggers (who + when, for every path) --------------------------------
create or replace function public.ledger_actor_label()
returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('mason.actor', true), ''),
                  case when (select auth.uid()) is not null then 'user' else 'system' end);
$$;

create or replace function public.trg_payments_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.payment_audit_log (organization_id, payment_id, action, actor_user_id, actor_label, after)
    values (new.organization_id, new.id, 'payment_recorded', (select auth.uid()), public.ledger_actor_label(),
            jsonb_build_object('gross_pence', new.gross_pence, 'source', new.source, 'kind', new.kind, 'match_status', new.match_status));
  elsif new.match_status is distinct from old.match_status
     or new.is_pass_through is distinct from old.is_pass_through
     or new.superseded_by is distinct from old.superseded_by then
    insert into public.payment_audit_log (organization_id, payment_id, action, actor_user_id, actor_label, before, after)
    values (new.organization_id, new.id, 'match_status_changed', (select auth.uid()), public.ledger_actor_label(),
            jsonb_build_object('match_status', old.match_status, 'is_pass_through', old.is_pass_through, 'superseded_by', old.superseded_by),
            jsonb_build_object('match_status', new.match_status, 'is_pass_through', new.is_pass_through, 'superseded_by', new.superseded_by,
                               'reason', new.match_reason));
  end if;
  return null;
end $$;
drop trigger if exists trg_payments_audit on public.payments;
create trigger trg_payments_audit after insert or update on public.payments
  for each row execute function public.trg_payments_audit();

create or replace function public.trg_allocations_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  r := coalesce(new, old);
  insert into public.payment_audit_log (organization_id, payment_id, allocation_id, action, actor_user_id, actor_label, before, after)
  values (r.organization_id, r.payment_id, r.id,
          case tg_op when 'INSERT' then 'allocation_added' when 'DELETE' then 'allocation_removed' else 'allocation_changed' end,
          (select auth.uid()), public.ledger_actor_label(),
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'organization_id' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'organization_id' end);
  return null;
end $$;
drop trigger if exists trg_allocations_audit on public.payment_allocations;
create trigger trg_allocations_audit after insert or update or delete on public.payment_allocations
  for each row execute function public.trg_allocations_audit();

-- 7. Derived balances ------------------------------------------------------------
create or replace view public.invoice_balances with (security_invoker = true) as
select i.id as invoice_id,
       i.organization_id,
       coalesce(i.total_pence, round(i.amount * 100)::bigint) as total_pence,
       coalesce(sum(a.amount_pence), 0)::bigint as paid_pence,
       (coalesce(i.total_pence, round(i.amount * 100)::bigint) - coalesce(sum(a.amount_pence), 0))::bigint as remaining_pence
from public.invoices i
left join public.payment_allocations a on a.invoice_id = i.id
group by i.id;

-- Keep the invoice cache columns (read by the existing UI) derived from allocations only.
create or replace function public.ledger_refresh_invoice(p_invoice uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_total bigint;
  v_paid bigint;
  v_last timestamptz;
  v_status text;
begin
  if p_invoice is null then return; end if;
  select coalesce(i.total_pence, round(i.amount * 100)::bigint), i.status into v_total, v_status
  from public.invoices i where i.id = p_invoice;
  if not found then return; end if;
  select coalesce(sum(a.amount_pence), 0), max(p.received_at) into v_paid, v_last
  from public.payment_allocations a join public.payments p on p.id = a.payment_id
  where a.invoice_id = p_invoice;
  update public.invoices i set
    amount_paid = v_paid,
    amount_remaining = greatest(v_total - v_paid, 0),
    status = case
      when v_total > 0 and v_paid >= v_total and coalesce(v_status, '') <> 'cancelled' then 'paid'
      when v_paid < v_total and v_status = 'paid' then 'pending'
      else v_status end,
    paid_at = case when v_total > 0 and v_paid >= v_total then coalesce(i.paid_at, v_last) when v_paid < v_total then null else i.paid_at end,
    payment_date = case when v_total > 0 and v_paid >= v_total then coalesce(i.payment_date, (v_last at time zone 'Europe/London')::date) when v_paid < v_total then null else i.payment_date end,
    locked_at = case when v_paid > 0 then coalesce(i.locked_at, now()) else i.locked_at end,
    updated_at = now()
  where i.id = p_invoice
    and (i.amount_paid is distinct from v_paid
         or i.amount_remaining is distinct from greatest(v_total - v_paid, 0)
         or (v_total > 0 and v_paid >= v_total and i.status is distinct from 'paid' and coalesce(v_status, '') <> 'cancelled')
         or (v_paid < v_total and i.status = 'paid'));
end $$;
revoke all on function public.ledger_refresh_invoice(uuid) from public, anon, authenticated;

create or replace function public.trg_allocations_refresh()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ledger_refresh_invoice(old.invoice_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ledger_refresh_invoice(new.invoice_id);
  end if;
  return null;
end $$;
drop trigger if exists trg_allocations_refresh on public.payment_allocations;
create trigger trg_allocations_refresh after insert or update or delete on public.payment_allocations
  for each row execute function public.trg_allocations_refresh();

-- 8. Reference normaliser: OR-123, ORD-000123, "order 123", "#123", bare 123 → 123.
create or replace function public.ledger_reference_order_numbers(p_ref text)
returns bigint[] language plpgsql immutable set search_path = '' as $$
declare
  v text := upper(coalesce(p_ref, ''));
  out bigint[] := '{}';
  m text[];
begin
  for m in select regexp_matches(v, '(?:^|[^A-Z0-9])(?:ORDER|ORD|OR|#)[\s#:._-]*0*([0-9]{1,9})(?![0-9])', 'g') loop
    out := out || m[1]::bigint;
  end loop;
  if cardinality(out) = 0 and v ~ '^\s*0*[0-9]{1,7}\s*$' then
    out := array[trim(v)::bigint];
  end if;
  return (select coalesce(array_agg(distinct x), '{}') from unnest(out) x where x > 0);
end $$;

create or replace function public.ledger_reference_invoice_numbers(p_ref text)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct 'INV-' || lpad(ltrim(m[1], '0'), 6, '0')), '{}')
  from regexp_matches(upper(coalesce(p_ref, '')), 'INV[\s#:._-]*([0-9]{1,9})', 'g') m
  where ltrim(m[1], '0') <> '';
$$;

create or replace function public.ledger_normalize_reference(p_ref text)
returns text language sql immutable set search_path = '' as $$
  select nullif(concat_ws(' ',
    (select string_agg('ORD-' || lpad(n::text, 6, '0'), ' ') from unnest(public.ledger_reference_order_numbers(p_ref)) n),
    (select string_agg(x, ' ') from unnest(public.ledger_reference_invoice_numbers(p_ref)) x)), '');
$$;

-- 9. Matching ----------------------------------------------------------------------
-- Allocate a payment to one invoice (up to its remaining balance). Internal.
create or replace function public.ledger_allocate_internal(
  p_payment uuid, p_invoice uuid, p_order uuid, p_amount bigint, p_type text, p_by text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_org uuid;
begin
  select organization_id into v_org from public.payments where id = p_payment;
  insert into public.payment_allocations (organization_id, payment_id, invoice_id, order_id, amount_pence, allocation_type, created_by, created_by_user_id)
  values (v_org, p_payment, p_invoice, coalesce(p_order, (select order_id from public.invoices where id = p_invoice)), p_amount, p_type, p_by, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.ledger_allocate_internal(uuid, uuid, uuid, bigint, text, text) from public, anon, authenticated;

create or replace function public.ledger_invoice_alloc_type(p_invoice uuid)
returns text language sql stable set search_path = '' as $$
  select case when i.invoice_type = 'deposit' then 'deposit' else 'balance' end from public.invoices i where i.id = p_invoice;
$$;

-- Auto-match: ONLY exact links (Stripe invoice/metadata, or a reference naming one
-- order/invoice with exactly one open invoice). Everything else → scored suggestions.
create or replace function public.ledger_auto_match(p_payment uuid)
returns public.payment_match_status language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  v_invoice uuid;
  v_remaining bigint;
  v_orders bigint[];
  v_invnos text[];
  v_candidates uuid[];
  v_reason text;
  v_alloc bigint;
  r record;
  v_best smallint := 0;
  v_count int := 0;
  v_surname text;
begin
  select * into p from public.payments where id = p_payment for update;
  if not found or p.match_status in ('matched', 'ignored') then return p.match_status; end if;
  if exists (select 1 from public.payment_allocations where payment_id = p.id) then
    update public.payments set match_status = 'matched' where id = p.id;
    return 'matched';
  end if;
  delete from public.payment_match_suggestions where payment_id = p.id;

  -- Refunds / chargebacks follow their parent's allocation (reverse it).
  if p.kind in ('refund', 'chargeback') and p.parent_payment_id is not null then
    select a.invoice_id, a.order_id, a.allocation_type into r
    from public.payment_allocations a where a.payment_id = p.parent_payment_id order by a.created_at limit 1;
    if found then
      perform public.ledger_allocate_internal(p.id, r.invoice_id, r.order_id, p.gross_pence, r.allocation_type, 'auto:refund');
      update public.payments set match_status = 'matched', match_reason = 'Refund of a matched payment', match_confidence = 100,
        matched_by = 'auto', matched_at = now() where id = p.id;
      return 'matched';
    end if;
    update public.payments set match_status = 'unmatched', match_reason = 'Refund of an unmatched payment' where id = p.id;
    return 'unmatched';
  end if;
  if p.kind <> 'payment' then
    update public.payments set match_status = 'ignored', match_reason = 'Not a customer payment (' || p.kind || ')' where id = p.id;
    return 'ignored';
  end if;

  -- Stripe payout landing in Revolut: never a customer payment.
  if p.source = 'revolut' and (p.payer_name ~* '^\s*stripe' or p.reference_raw ~* 'stripe') then
    update public.payments set match_status = 'ignored', match_reason = 'stripe_payout' where id = p.id;
    return 'ignored';
  end if;

  -- (a) Stripe-linked: invoice id from metadata / Stripe invoice.
  if p.source = 'stripe' then
    select i.id into v_invoice from public.invoices i
    where i.organization_id = p.organization_id and i.deleted_at is null
      and ((p.stripe_invoice_id is not null and i.stripe_invoice_id = p.stripe_invoice_id)
        or (p.raw ? 'mason_invoice_id' and i.id::text = p.raw->>'mason_invoice_id')
        or (p.stripe_payment_intent_id is not null and i.stripe_payment_intent_id = p.stripe_payment_intent_id))
    limit 1;
    v_reason := 'Stripe invoice link';
  end if;

  -- (b) Reference names an invoice number or an order number.
  if v_invoice is null then
    v_invnos := public.ledger_reference_invoice_numbers(p.reference_raw);
    if cardinality(v_invnos) = 1 then
      select array_agg(i.id) into v_candidates from public.invoices i
      where i.organization_id = p.organization_id and i.deleted_at is null and upper(i.invoice_number) = v_invnos[1];
      if cardinality(v_candidates) = 1 then v_invoice := v_candidates[1]; v_reason := 'Reference ' || v_invnos[1]; end if;
    end if;
  end if;
  if v_invoice is null then
    v_orders := public.ledger_reference_order_numbers(p.reference_raw);
    if cardinality(v_orders) = 1 then
      select array_agg(b.invoice_id order by i.issue_date, i.created_at) into v_candidates
      from public.orders o
      join public.invoices i on i.order_id = o.id and i.deleted_at is null and coalesce(i.status, '') not in ('cancelled', 'draft')
      join public.invoice_balances b on b.invoice_id = i.id
      where o.organization_id = p.organization_id and o.order_number = v_orders[1] and b.remaining_pence > 0;
      if cardinality(v_candidates) = 1 then
        v_invoice := v_candidates[1];
        v_reason := 'Reference ORD-' || lpad(v_orders[1]::text, 6, '0');
      elsif coalesce(cardinality(v_candidates), 0) > 1 then
        -- Several open invoices on that order: suggest each, a person picks.
        insert into public.payment_match_suggestions (payment_id, organization_id, order_id, invoice_id, score, reasons)
        select p.id, p.organization_id, i.order_id, i.id, 80,
               array['Reference ORD-' || lpad(v_orders[1]::text, 6, '0'), 'Order has ' || cardinality(v_candidates) || ' open invoices']
        from public.invoices i where i.id = any(v_candidates)
        on conflict do nothing;
        update public.payments set match_status = 'suggested', match_confidence = 80,
          match_reason = 'Reference names an order with several open invoices' where id = p.id;
        return 'suggested';
      else
        -- Order named but no open invoice (decision 4: every deposit gets its own invoice).
        insert into public.payment_match_suggestions (payment_id, organization_id, order_id, invoice_id, score, reasons)
        select p.id, p.organization_id, o.id, null, 70,
               array['Reference ORD-' || lpad(v_orders[1]::text, 6, '0'), 'No open invoice — raise a deposit invoice first']
        from public.orders o where o.organization_id = p.organization_id and o.order_number = v_orders[1]
        on conflict do nothing;
        if found then
          update public.payments set match_status = 'suggested', match_confidence = 70,
            match_reason = 'Order has no open invoice' where id = p.id;
          return 'suggested';
        end if;
      end if;
    end if;
  end if;

  if v_invoice is not null then
    select remaining_pence into v_remaining from public.invoice_balances where invoice_id = v_invoice;
    v_alloc := least(p.gross_pence, greatest(coalesce(v_remaining, 0), 0));
    if v_alloc > 0 then
      perform public.ledger_allocate_internal(p.id, v_invoice, null, v_alloc, public.ledger_invoice_alloc_type(v_invoice), 'auto');
      update public.payments set match_status = 'matched', match_confidence = 100, match_reason = v_reason
        || case when v_alloc < p.gross_pence then ' · £' || to_char((p.gross_pence - v_alloc) / 100.0, 'FM999999990.00') || ' over the balance left unallocated' else '' end,
        matched_by = 'auto', matched_at = now() where id = p.id;
      return 'matched';
    end if;
    -- Linked invoice already fully paid → a person decides (overpayment / duplicate).
    insert into public.payment_match_suggestions (payment_id, organization_id, order_id, invoice_id, score, reasons)
    select p.id, p.organization_id, i.order_id, i.id, 90, array[v_reason, 'Invoice already fully paid']
    from public.invoices i where i.id = v_invoice on conflict do nothing;
    update public.payments set match_status = 'suggested', match_confidence = 90, match_reason = 'Linked invoice already paid' where id = p.id;
    return 'suggested';
  end if;

  -- (c) Scored suggestions (decision 3: never auto-confirmed).
  v_surname := lower(coalesce(substring(trim(p.payer_name) from '([^\s]+)\s*$'), ''));
  for r in
    with open_inv as (
      select i.id, i.order_id, i.issue_date, i.intended_deposit_pence, b.remaining_pence, b.total_pence,
             lower(coalesce(pe.last_name, '')) as last_name
      from public.invoices i
      join public.invoice_balances b on b.invoice_id = i.id
      left join public.people pe on pe.id = i.person_id
      where i.organization_id = p.organization_id and i.deleted_at is null
        and coalesce(i.status, '') not in ('cancelled', 'draft') and b.remaining_pence > 0
    ), scored as (
      select o.*,
        (case when p.gross_pence = o.intended_deposit_pence then 50
              when p.gross_pence = o.remaining_pence or p.gross_pence = o.total_pence then 40 else 0 end)
        + (case when length(v_surname) >= 3 and o.last_name <> '' and (o.last_name = v_surname or position(o.last_name in lower(coalesce(p.payer_name, '') || ' ' || coalesce(p.reference_raw, ''))) > 0) then 30 else 0 end)
        + (case when o.issue_date is not null and (p.received_at at time zone 'Europe/London')::date >= o.issue_date then 10 else 0 end) as score,
        array_remove(array[
          case when p.gross_pence = o.intended_deposit_pence then 'Amount = deposit'
               when p.gross_pence = o.remaining_pence then 'Amount = balance left'
               when p.gross_pence = o.total_pence then 'Amount = invoice total' end,
          case when length(v_surname) >= 3 and o.last_name <> '' and (o.last_name = v_surname or position(o.last_name in lower(coalesce(p.payer_name, '') || ' ' || coalesce(p.reference_raw, ''))) > 0) then 'Payer surname matches customer' end,
          case when o.issue_date is not null and (p.received_at at time zone 'Europe/London')::date >= o.issue_date then 'Paid after invoice date' end
        ], null) as reasons
      from open_inv o
    )
    select * from scored where score >= 40 order by score desc limit 5
  loop
    v_count := v_count + 1;
    insert into public.payment_match_suggestions (payment_id, organization_id, order_id, invoice_id, score, reasons)
    values (p.id, p.organization_id, r.order_id, r.id, r.score, r.reasons) on conflict do nothing;
    v_best := greatest(v_best, r.score);
  end loop;
  if v_count = 1 then
    update public.payment_match_suggestions set score = least(score + 20, 100), reasons = array_append(reasons, 'Only open candidate')
    where payment_id = p.id;
    v_best := least(v_best + 20, 100);
  end if;
  if v_best >= 50 then
    update public.payments set match_status = 'suggested', match_confidence = v_best, match_reason = 'Suggested: confirm the match' where id = p.id;
    return 'suggested';
  end if;
  delete from public.payment_match_suggestions where payment_id = p.id;
  update public.payments set match_status = 'unmatched', match_confidence = null, match_reason = 'No candidate scored 50+' where id = p.id;
  return 'unmatched';
end $$;
revoke all on function public.ledger_auto_match(uuid) from public, anon, authenticated;
grant execute on function public.ledger_auto_match(uuid) to service_role;

-- 10. Ingestion (service role only: Stripe / Revolut webhooks + polling) -----------
-- Idempotent: same (org, source, external_id) updates non-match fields only.
create or replace function public.ledger_ingest_payment(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_inserted boolean;
  v_status public.payment_match_status;
  v_parent uuid;
  v_org uuid := (p->>'organization_id')::uuid;
  v_state text := coalesce(p->>'state', 'completed');
begin
  if v_org is null or p->>'source' is null or p->>'external_id' is null then
    raise exception 'organization_id, source and external_id are required';
  end if;
  perform set_config('mason.actor', 'ingest:' || (p->>'source'), true);
  if p->>'parent_external_id' is not null then
    select id into v_parent from public.payments
    where organization_id = v_org and source = (p->>'source')::public.payment_source and external_id = p->>'parent_external_id';
  end if;

  insert into public.payments as t (
    organization_id, source, external_id, kind, parent_payment_id, gross_pence, fee_pence, currency, received_at,
    payer_name, payer_email, reference_raw, reference_normalized, method, stripe_payment_intent_id, stripe_invoice_id,
    is_pass_through, match_status, raw)
  values (
    v_org, (p->>'source')::public.payment_source, p->>'external_id', coalesce((p->>'kind')::public.payment_kind, 'payment'), v_parent,
    (p->>'gross_pence')::bigint, coalesce((p->>'fee_pence')::bigint, 0), upper(coalesce(p->>'currency', 'GBP')),
    coalesce((p->>'received_at')::timestamptz, now()),
    nullif(trim(p->>'payer_name'), ''), nullif(trim(p->>'payer_email'), ''), p->>'reference',
    public.ledger_normalize_reference(p->>'reference'), p->>'method', p->>'stripe_payment_intent_id', p->>'stripe_invoice_id',
    coalesce((p->>'is_pass_through')::boolean, false),
    case when v_state = 'completed' then 'unmatched' else 'pending' end::public.payment_match_status,
    p->'raw')
  on conflict (organization_id, source, external_id) do update set
    fee_pence = case when excluded.fee_pence <> 0 then excluded.fee_pence else t.fee_pence end,
    payer_name = coalesce(t.payer_name, excluded.payer_name),
    payer_email = coalesce(t.payer_email, excluded.payer_email),
    reference_raw = coalesce(t.reference_raw, excluded.reference_raw),
    reference_normalized = coalesce(t.reference_normalized, excluded.reference_normalized),
    stripe_payment_intent_id = coalesce(t.stripe_payment_intent_id, excluded.stripe_payment_intent_id),
    stripe_invoice_id = coalesce(t.stripe_invoice_id, excluded.stripe_invoice_id),
    method = coalesce(t.method, excluded.method),
    raw = case when t.raw_purged_at is null then coalesce(excluded.raw, t.raw) else t.raw end,
    match_status = case when t.match_status = 'pending' and v_state = 'completed' then 'unmatched'
                        when v_state in ('reverted', 'declined', 'failed') and t.match_status <> 'matched' then 'ignored'
                        else t.match_status end
  returning id, (xmax = 0) into v_id, v_inserted;

  if v_state in ('reverted', 'declined', 'failed') then
    update public.payments set match_reason = 'Bank transaction ' || v_state where id = v_id and match_status = 'ignored';
  end if;
  select match_status into v_status from public.payments where id = v_id;
  if v_status = 'unmatched' then
    v_status := public.ledger_auto_match(v_id);
  end if;
  return jsonb_build_object('payment_id', v_id, 'inserted', v_inserted, 'match_status', v_status);
end $$;
revoke all on function public.ledger_ingest_payment(jsonb) from public, anon, authenticated;
grant execute on function public.ledger_ingest_payment(jsonb) to service_role;

-- 11. Finance-user actions (audited; actor = auth.uid()) -----------------------------
create or replace function public.ledger_assert_finance(p_org uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'service_role' then return; end if;
  if not public.user_can_view_org_finance(p_org) then
    raise exception 'not allowed: finance role required' using errcode = '42501';
  end if;
end $$;
revoke all on function public.ledger_assert_finance(uuid) from public, anon;

-- Allocate (confirm a suggestion, or a manual split). p_allocations: [{invoice_id, order_id?, amount_pence, allocation_type?}]
create or replace function public.ledger_allocate(p_payment uuid, p_allocations jsonb, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  a jsonb;
  v_type text;
  v_inv uuid;
  v_order uuid;
  v_pass boolean := false;
begin
  select * into p from public.payments where id = p_payment for update;
  if not found then raise exception 'payment not found'; end if;
  perform public.ledger_assert_finance(p.organization_id);
  perform set_config('mason.actor', 'user', true);
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'allocations required';
  end if;
  for a in select * from jsonb_array_elements(p_allocations) loop
    v_inv := nullif(a->>'invoice_id', '')::uuid;
    v_order := nullif(a->>'order_id', '')::uuid;
    if v_inv is not null and not exists (select 1 from public.invoices where id = v_inv and organization_id = p.organization_id) then
      raise exception 'invoice not in this organisation';
    end if;
    if v_order is not null and not exists (select 1 from public.orders where id = v_order and organization_id = p.organization_id) then
      raise exception 'order not in this organisation';
    end if;
    v_type := coalesce(a->>'allocation_type', case when v_inv is not null then public.ledger_invoice_alloc_type(v_inv) else 'deposit' end);
    if v_type = 'permit' then v_pass := true; end if;
    perform public.ledger_allocate_internal(p.id, v_inv, v_order, (a->>'amount_pence')::bigint, v_type, 'user');
  end loop;
  update public.payments set match_status = 'matched', matched_by = 'user', matched_by_user_id = (select auth.uid()),
    matched_at = now(), match_confidence = coalesce(match_confidence, 100),
    match_reason = coalesce(nullif(p_note, ''), 'Matched by hand'),
    is_pass_through = is_pass_through or v_pass
  where id = p.id;
  delete from public.payment_match_suggestions where payment_id = p.id;
  return jsonb_build_object('payment_id', p.id, 'match_status', 'matched');
end $$;
revoke all on function public.ledger_allocate(uuid, jsonb, text) from public, anon;
grant execute on function public.ledger_allocate(uuid, jsonb, text) to authenticated, service_role;

create or replace function public.ledger_confirm_suggestion(p_payment uuid, p_invoice uuid default null, p_order uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  s public.payment_match_suggestions;
  v_remaining bigint;
begin
  select * into p from public.payments where id = p_payment;
  if not found then raise exception 'payment not found'; end if;
  perform public.ledger_assert_finance(p.organization_id);
  select * into s from public.payment_match_suggestions
  where payment_id = p_payment and invoice_id is not distinct from p_invoice and (p_order is null or order_id = p_order)
  order by score desc limit 1;
  if not found then raise exception 'no such suggestion'; end if;
  if s.invoice_id is null then raise exception 'raise an invoice for this order first (every deposit gets its own invoice)'; end if;
  select remaining_pence into v_remaining from public.invoice_balances where invoice_id = s.invoice_id;
  return public.ledger_allocate(p_payment,
    jsonb_build_array(jsonb_build_object('invoice_id', s.invoice_id, 'amount_pence', least(p.gross_pence, greatest(v_remaining, 0)))),
    'Confirmed suggestion (' || array_to_string(s.reasons, ', ') || ')');
end $$;
revoke all on function public.ledger_confirm_suggestion(uuid, uuid, uuid) from public, anon;
grant execute on function public.ledger_confirm_suggestion(uuid, uuid, uuid) to authenticated, service_role;

-- Undo a match: remove allocations (audited) and re-queue.
create or replace function public.ledger_unmatch(p_payment uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.payments;
begin
  select * into p from public.payments where id = p_payment for update;
  if not found then raise exception 'payment not found'; end if;
  perform public.ledger_assert_finance(p.organization_id);
  if coalesce(trim(p_reason), '') = '' then raise exception 'a reason is required to undo a match'; end if;
  perform set_config('mason.actor', 'user', true);
  delete from public.payment_allocations where payment_id = p.id;
  update public.payments set match_status = 'unmatched', matched_by = null, matched_by_user_id = null, matched_at = null,
    match_confidence = null, match_reason = 'Undone: ' || p_reason, is_pass_through = false where id = p.id;
  return jsonb_build_object('payment_id', p.id, 'match_status', public.ledger_auto_match_suggest_only(p.id));
end $$;

-- Re-run suggestions without auto-allocating (used after an undo).
create or replace function public.ledger_auto_match_suggest_only(p_payment uuid)
returns public.payment_match_status language plpgsql security definer set search_path = '' as $$
declare v public.payment_match_status;
begin
  -- Run matching inside a savepoint and keep only suggestions, never allocations.
  begin
    v := public.ledger_auto_match(p_payment);
    if v = 'matched' then raise exception using errcode = 'P0001', message = 'rollback_auto'; end if;
  exception when sqlstate 'P0001' then
    v := 'unmatched';
    update public.payments set match_status = 'suggested', match_reason = 'Exact match found — confirm to re-apply'
    where id = p_payment;
    insert into public.payment_match_suggestions (payment_id, organization_id, order_id, invoice_id, score, reasons)
    select p.id, p.organization_id, i.order_id, i.id, 100, array['Exact reference / Stripe link']
    from public.payments p
    join public.invoices i on i.organization_id = p.organization_id
      and ((p.stripe_invoice_id is not null and i.stripe_invoice_id = p.stripe_invoice_id)
        or i.invoice_number = any(public.ledger_reference_invoice_numbers(p.reference_raw))
        or i.order_id in (select o.id from public.orders o where o.organization_id = p.organization_id
                          and o.order_number = any(public.ledger_reference_order_numbers(p.reference_raw))))
    where p.id = p_payment and i.deleted_at is null
    on conflict do nothing;
    v := 'suggested';
  end;
  return v;
end $$;
revoke all on function public.ledger_auto_match_suggest_only(uuid) from public, anon, authenticated;
revoke all on function public.ledger_unmatch(uuid, text) from public, anon;
grant execute on function public.ledger_unmatch(uuid, text) to authenticated, service_role;

create or replace function public.ledger_ignore(p_payment uuid, p_reason text, p_superseded_by uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.payments;
begin
  select * into p from public.payments where id = p_payment for update;
  if not found then raise exception 'payment not found'; end if;
  perform public.ledger_assert_finance(p.organization_id);
  if exists (select 1 from public.payment_allocations where payment_id = p.id) then
    raise exception 'undo the match before ignoring';
  end if;
  perform set_config('mason.actor', 'user', true);
  update public.payments set match_status = 'ignored', match_reason = coalesce(nullif(p_reason, ''), 'Ignored'),
    superseded_by = p_superseded_by, matched_by = 'user', matched_by_user_id = (select auth.uid()), matched_at = now()
  where id = p.id;
  delete from public.payment_match_suggestions where payment_id = p.id;
  return jsonb_build_object('payment_id', p.id, 'match_status', 'ignored');
end $$;
revoke all on function public.ledger_ignore(uuid, text, uuid) from public, anon;
grant execute on function public.ledger_ignore(uuid, text, uuid) to authenticated, service_role;

-- Manual (cash / cheque / other) entry by a finance user; can allocate in one go.
create or replace function public.ledger_record_manual_payment(
  p_org uuid, p_gross_pence bigint, p_received_at timestamptz, p_method text, p_payer_name text,
  p_reference text default null, p_invoice uuid default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_remaining bigint;
begin
  perform public.ledger_assert_finance(p_org);
  if p_gross_pence is null or p_gross_pence <= 0 then raise exception 'amount must be positive'; end if;
  perform set_config('mason.actor', 'user', true);
  insert into public.payments (organization_id, source, external_id, gross_pence, received_at, payer_name, reference_raw,
    reference_normalized, method, match_status, match_reason)
  values (p_org, 'manual', gen_random_uuid()::text, p_gross_pence, coalesce(p_received_at, now()), nullif(trim(p_payer_name), ''),
    p_reference, public.ledger_normalize_reference(p_reference), coalesce(p_method, 'other'), 'unmatched', p_note)
  returning id into v_id;
  if p_invoice is not null then
    select remaining_pence into v_remaining from public.invoice_balances where invoice_id = p_invoice;
    perform public.ledger_allocate(v_id, jsonb_build_array(jsonb_build_object('invoice_id', p_invoice,
      'amount_pence', least(p_gross_pence, greatest(coalesce(v_remaining, 0), 0)))), coalesce(p_note, 'Manual payment'));
  else
    perform public.ledger_auto_match_suggest_only(v_id);
  end if;
  return jsonb_build_object('payment_id', v_id);
end $$;
revoke all on function public.ledger_record_manual_payment(uuid, bigint, timestamptz, text, text, text, uuid, text) from public, anon;
grant execute on function public.ledger_record_manual_payment(uuid, bigint, timestamptz, text, text, text, uuid, text) to authenticated, service_role;

-- Finance-only raw payload read.
create or replace function public.ledger_payment_raw(p_payment uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid; v_raw jsonb;
begin
  select organization_id, raw into v_org, v_raw from public.payments where id = p_payment;
  if v_org is null then return null; end if;
  perform public.ledger_assert_finance(v_org);
  return v_raw;
end $$;
revoke all on function public.ledger_payment_raw(uuid) from public, anon;
grant execute on function public.ledger_payment_raw(uuid) to authenticated, service_role;

-- Retention: drop raw webhook payloads after N days (default 180).
create or replace function public.ledger_purge_raw(p_days int default 180)
returns int language sql security definer set search_path = '' as $$
  with u as (
    update public.payments set raw = null, raw_purged_at = now()
    where raw is not null and created_at < now() - make_interval(days => p_days)
    returning 1)
  select count(*)::int from u;
$$;
revoke all on function public.ledger_purge_raw(int) from public, anon, authenticated;
grant execute on function public.ledger_purge_raw(int) to service_role;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('ledger-purge-raw', '17 3 * * *', 'select public.ledger_purge_raw(180)');
  end if;
exception when others then null;
end $$;

-- 12. Totals (Europe/London calendar) — no double counting by construction ------------
create or replace function public.ledger_totals(p_org uuid, p_from date, p_to date)
returns table (received_pence bigint, fees_pence bigint, net_pence bigint, pass_through_pence bigint,
               revenue_pence bigint, unallocated_pence bigint, refunds_pence bigint, payment_count int)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.ledger_assert_finance(p_org);
  return query
  with p as (
    select * from public.payments
    where organization_id = p_org and match_status <> 'ignored' and match_status <> 'pending'
      and (received_at at time zone 'Europe/London')::date between p_from and p_to
  ), a as (
    select a.payment_id, sum(a.amount_pence) filter (where a.allocation_type <> 'permit') as rev,
           sum(a.amount_pence) filter (where a.allocation_type = 'permit') as permit,
           sum(a.amount_pence) as total
    from public.payment_allocations a where a.payment_id in (select id from p) group by a.payment_id
  )
  select coalesce(sum(p.gross_pence), 0)::bigint,
         coalesce(sum(p.fee_pence), 0)::bigint,
         coalesce(sum(p.net_pence), 0)::bigint,
         coalesce(sum(case when p.is_pass_through then coalesce(a.permit, p.gross_pence) else coalesce(a.permit, 0) end), 0)::bigint,
         coalesce(sum(case when p.is_pass_through and a.permit is null then 0 else coalesce(a.rev, 0) end), 0)::bigint,
         coalesce(sum(p.gross_pence - coalesce(a.total, 0)), 0)::bigint,
         coalesce(sum(p.gross_pence) filter (where p.gross_pence < 0), 0)::bigint,
         count(*)::int
  from p left join a on a.payment_id = p.id;
end $$;
revoke all on function public.ledger_totals(uuid, date, date) from public, anon;
grant execute on function public.ledger_totals(uuid, date, date) to authenticated, service_role;

-- 13. RLS: org-scoped, finance roles only; payments insert-only from ingestion -------
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.payment_match_suggestions enable row level security;
alter table public.payment_audit_log enable row level security;

drop policy if exists payments_finance_select on public.payments;
create policy payments_finance_select on public.payments for select to authenticated
  using (public.user_can_view_org_finance(organization_id));
drop policy if exists payment_allocations_finance_select on public.payment_allocations;
create policy payment_allocations_finance_select on public.payment_allocations for select to authenticated
  using (public.user_can_view_org_finance(organization_id));
drop policy if exists payment_match_suggestions_finance_select on public.payment_match_suggestions;
create policy payment_match_suggestions_finance_select on public.payment_match_suggestions for select to authenticated
  using (public.user_can_view_org_finance(organization_id));
drop policy if exists payment_audit_log_finance_select on public.payment_audit_log;
create policy payment_audit_log_finance_select on public.payment_audit_log for select to authenticated
  using (public.user_can_view_org_finance(organization_id));

-- No browser writes at all; changes go through the audited functions above.
revoke all on public.payments, public.payment_allocations, public.payment_match_suggestions, public.payment_audit_log from anon, authenticated;
grant select on public.payment_allocations, public.payment_match_suggestions, public.payment_audit_log to authenticated;
-- Raw payload is not readable column-wise from the browser (use ledger_payment_raw).
grant select (id, organization_id, source, external_id, kind, parent_payment_id, gross_pence, fee_pence, net_pence, currency,
  received_at, payer_name, payer_email, payer_person_id, reference_raw, reference_normalized, method, stripe_payment_intent_id,
  stripe_invoice_id, is_pass_through, match_status, match_confidence, match_reason, matched_by, matched_by_user_id, matched_at,
  superseded_by, legacy_table, legacy_id, raw_purged_at, created_at, updated_at) on public.payments to authenticated;
grant all on public.payments, public.payment_allocations, public.payment_match_suggestions, public.payment_audit_log to service_role;
grant select on public.invoice_balances to authenticated, service_role;
revoke all on public.invoice_balances from anon;

comment on table public.payments is 'Append-only payments ledger (bigint pence). One row per money movement; refunds negative. Writes: ledger_ingest_payment (service role) and audited ledger_* RPCs.';
comment on table public.payment_allocations is 'Payment → invoice/order allocations (pence). Invoice paid/remaining derive from these (invoice_balances).';
comment on column public.invoices.total_pence is 'Invoice total in pence (source of truth). invoices.amount (pounds) kept in sync until the contract migration.';

-- 14. Order paid amount (orders_with_balance.amount_paid) from allocations, not
--     "sum of paid invoices' totals". Permit pass-through excluded. Pounds (numeric) as before.
do $$
declare v text;
begin
  v := pg_get_viewdef('public.orders_with_balance'::regclass);
  if position('payment_allocations' in v) = 0 then
    v := replace(v,
      $old$( SELECT invoices.order_id,
            sum(invoices.amount) AS amount_paid
           FROM invoices
          WHERE ((invoices.status = 'paid'::text) AND (invoices.order_id IS NOT NULL))
          GROUP BY invoices.order_id) pay$old$,
      $new$( SELECT COALESCE(a.order_id, i.order_id) AS order_id,
            (sum(a.amount_pence)::numeric / 100.0) AS amount_paid
           FROM (payment_allocations a
             LEFT JOIN invoices i ON ((i.id = a.invoice_id)))
          WHERE ((a.allocation_type <> 'permit'::text) AND (COALESCE(a.order_id, i.order_id) IS NOT NULL))
          GROUP BY COALESCE(a.order_id, i.order_id)) pay$new$);
    if position('payment_allocations' in v) = 0 then
      raise notice 'orders_with_balance definition differs from expected; amount_paid left unchanged';
    else
      execute 'create or replace view public.orders_with_balance with (security_invoker = true) as ' || v;
    end if;
  end if;
end $$;
