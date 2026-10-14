-- =============================================================================
-- Payments ledger: one-off backfill from order_payments + invoice_payments, then
-- freeze the old tables (read-only, NOT dropped).
-- Run AFTER the ledger edge functions (stripe-webhook, revolut-webhook,
-- revolut-sync-transactions) are deployed, so nothing still writes the old tables.
-- Idempotent: re-running inserts nothing new (unique (org, source, external_id)).
-- =============================================================================

create table if not exists public.ledger_backfill_snapshot (
  invoice_id uuid primary key,
  organization_id uuid,
  old_amount_paid bigint,
  old_amount_remaining bigint,
  old_status text,
  old_paid_at timestamptz,
  taken_at timestamptz not null default now()
);
alter table public.ledger_backfill_snapshot enable row level security;
revoke all on public.ledger_backfill_snapshot from anon, authenticated;

create or replace function public.ledger_backfill_legacy()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_id uuid;
  v_inv uuid;
  v_type text;
  v_ip int := 0; v_ip_skipped int := 0; v_op int := 0; v_op_dupes int := 0; v_synthetic int := 0; v_reversals int := 0;
  v_amount bigint;
begin
  perform set_config('mason.actor', 'backfill', true);

  insert into public.ledger_backfill_snapshot (invoice_id, organization_id, old_amount_paid, old_amount_remaining, old_status, old_paid_at)
  select id, organization_id, amount_paid, amount_remaining, status, paid_at from public.invoices
  on conflict (invoice_id) do nothing;

  -- 1. invoice_payments (pence). Only real paid rows; reversed ones get a refund row.
  for r in
    select ip.*, i.organization_id as inv_org, i.invoice_type
    from public.invoice_payments ip join public.invoices i on i.id = ip.invoice_id
    where ip.status = 'paid' and coalesce(ip.organization_id, i.organization_id) is not null and ip.amount > 0
    order by coalesce(ip.received_at, ip.created_at)
  loop
    insert into public.payments (organization_id, source, external_id, gross_pence, received_at, method, reference_raw,
      reference_normalized, stripe_payment_intent_id, stripe_invoice_id, match_status, match_reason, matched_by, matched_at,
      legacy_table, legacy_id)
    values (coalesce(r.organization_id, r.inv_org),
      case when r.stripe_charge_id is not null or r.stripe_payment_intent_id is not null or r.source = 'stripe' then 'stripe' else 'manual' end::public.payment_source,
      coalesce(r.stripe_charge_id, r.stripe_payment_intent_id, r.stripe_invoice_payment_id, nullif(r.external_reference, ''), 'legacy-ip:' || r.id),
      r.amount, coalesce(r.received_at, r.created_at),
      case when r.stripe_charge_id is not null or r.stripe_payment_intent_id is not null then 'card'
           when r.method in ('card', 'bank_transfer', 'cash', 'cheque') then r.method else 'other' end,
      r.external_reference, public.ledger_normalize_reference(r.external_reference), r.stripe_payment_intent_id, r.stripe_invoice_id,
      'matched', 'Backfilled from invoice_payments', 'backfill', coalesce(r.verified_at, r.created_at), 'invoice_payments', r.id)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then v_ip_skipped := v_ip_skipped + 1; continue; end if;
    v_ip := v_ip + 1;
    v_type := case when r.invoice_type = 'deposit' then 'deposit' else 'balance' end;
    if coalesce(r.permit_amount_pence, 0) > 0 and r.permit_amount_pence < r.amount then
      perform public.ledger_allocate_internal(v_id, r.invoice_id, null, r.permit_amount_pence, 'permit', 'backfill');
      perform public.ledger_allocate_internal(v_id, r.invoice_id, null, r.amount - r.permit_amount_pence, v_type, 'backfill');
    elsif coalesce(r.permit_amount_pence, 0) >= r.amount then
      perform public.ledger_allocate_internal(v_id, r.invoice_id, null, r.amount, 'permit', 'backfill');
      update public.payments set is_pass_through = true where id = v_id;
    else
      perform public.ledger_allocate_internal(v_id, r.invoice_id, null, r.amount, v_type, 'backfill');
    end if;
    if r.reversed_at is not null then
      insert into public.payments (organization_id, source, external_id, kind, parent_payment_id, gross_pence, received_at,
        match_status, match_reason, matched_by, matched_at, legacy_table, legacy_id)
      values (coalesce(r.organization_id, r.inv_org), 'manual', 'legacy-ip-reversal:' || r.id, 'refund', v_id, -r.amount,
        r.reversed_at, 'matched', coalesce('Reversal: ' || r.reversal_reason, 'Reversal'), 'backfill', r.reversed_at, 'invoice_payments', r.id)
      returning id into v_id;
      perform public.ledger_allocate_internal(v_id, r.invoice_id, null, -r.amount, v_type, 'backfill');
      v_reversals := v_reversals + 1;
    end if;
  end loop;

  -- 2. order_payments (pounds → pence). Stripe rows already seen via invoice_payments collapse here.
  for r in
    select op.*, o.invoice_id as order_invoice_id
    from public.order_payments op left join public.orders o on o.id = op.order_id
    where op.organization_id is not null and op.amount > 0
    order by op.received_at
  loop
    v_amount := round(r.amount * 100)::bigint;
    if r.source = 'stripe' and exists (
      select 1 from public.payments p
      where p.organization_id = r.organization_id and p.source = 'stripe'
        and (p.external_id = r.external_id or p.stripe_payment_intent_id = r.external_id)) then
      v_op_dupes := v_op_dupes + 1;
      continue;
    end if;
    v_id := null;
    insert into public.payments (organization_id, source, external_id, gross_pence, received_at, method, reference_raw,
      reference_normalized, stripe_payment_intent_id, is_pass_through, match_status, match_reason, matched_by, matched_at,
      legacy_table, legacy_id)
    values (r.organization_id,
      case when r.source in ('stripe', 'revolut') then r.source else 'manual' end::public.payment_source,
      r.external_id, v_amount, r.received_at,
      case when r.source = 'revolut' then 'bank_transfer' when r.source = 'stripe' then 'card' else 'other' end,
      r.reference, public.ledger_normalize_reference(r.reference),
      case when r.external_id like 'pi\_%' then r.external_id end,
      r.status = 'pass_through',
      case r.status when 'matched' then 'matched' when 'pass_through' then 'matched' when 'dismissed' then 'ignored' else 'unmatched' end::public.payment_match_status,
      coalesce(r.match_reason, 'Backfilled from order_payments'), case when r.status in ('matched', 'pass_through') then coalesce(r.matched_by, 'backfill') end,
      r.matched_at, 'order_payments', r.id)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then v_op_dupes := v_op_dupes + 1; continue; end if;
    v_op := v_op + 1;
    if r.status in ('matched', 'pass_through') and r.order_id is not null then
      v_type := case when r.status = 'pass_through' or r.payment_type = 'permit' then 'permit'
                     when r.payment_type in ('deposit', 'balance', 'extra') then r.payment_type
                     when r.payment_type = 'final' then 'balance' else 'deposit' end;
      -- Prefer an invoice of that order with money left (deposit invoice for deposits), else order-level.
      select i.id into v_inv from public.invoices i join public.invoice_balances b on b.invoice_id = i.id
      where i.order_id = r.order_id and i.deleted_at is null and b.remaining_pence >= v_amount
      order by (coalesce(i.status, '') <> 'paid') desc, (i.invoice_type = 'deposit') = (v_type = 'deposit') desc, i.issue_date, i.created_at limit 1;
      perform public.ledger_allocate_internal(v_id, v_inv, r.order_id, v_amount, v_type, 'backfill');
      v_inv := null;
    elsif r.status = 'unmatched' then
      perform public.ledger_auto_match(v_id);
    end if;
  end loop;

  -- 3. Invoices marked paid in the old world with no recorded payment: keep them paid
  --    with an explicit, labelled manual ledger row for the shortfall.
  for r in
    select i.id, i.organization_id, i.paid_at, i.payment_date, i.payment_method, i.invoice_type, b.remaining_pence
    from public.invoices i join public.invoice_balances b on b.invoice_id = i.id
    where i.status = 'paid' and i.deleted_at is null and i.organization_id is not null and b.remaining_pence > 0
  loop
    insert into public.payments (organization_id, source, external_id, gross_pence, received_at, method, match_status,
      match_reason, matched_by, matched_at, legacy_table, legacy_id)
    values (r.organization_id, 'manual', 'legacy-paid-invoice:' || r.id, r.remaining_pence,
      coalesce(r.paid_at, r.payment_date::timestamptz, now()),
      case when r.payment_method ilike '%stripe%' or r.payment_method ilike '%card%' then 'card'
           when r.payment_method ilike '%bank%' or r.payment_method ilike '%transfer%' then 'bank_transfer'
           when r.payment_method ilike '%cash%' then 'cash' else 'other' end,
      'matched', 'Invoice was marked paid before the ledger (no payment row) — check', 'backfill', now(), 'invoices', r.id)
    on conflict do nothing
    returning id into v_id;
    if v_id is not null then
      perform public.ledger_allocate_internal(v_id, r.id, null, r.remaining_pence,
        case when r.invoice_type = 'deposit' then 'deposit' else 'balance' end, 'backfill');
      v_synthetic := v_synthetic + 1;
    end if;
    v_id := null;
  end loop;

  return jsonb_build_object('invoice_payments', v_ip, 'invoice_payments_already_in_ledger', v_ip_skipped,
    'reversals', v_reversals, 'order_payments', v_op, 'order_payments_duplicates_collapsed', v_op_dupes,
    'paid_invoices_without_payment_rows', v_synthetic);
end $$;
revoke all on function public.ledger_backfill_legacy() from public, anon, authenticated;

-- Pre-flight / post-check: per invoice, old cached paid vs ledger allocations (pence).
create or replace view public.ledger_backfill_diff with (security_invoker = true) as
select s.invoice_id, s.organization_id, s.old_amount_paid, b.paid_pence as ledger_paid_pence,
       b.paid_pence - coalesce(s.old_amount_paid, 0) as diff_pence, s.old_status, i.status as new_status
from public.ledger_backfill_snapshot s
join public.invoice_balances b on b.invoice_id = s.invoice_id
join public.invoices i on i.id = s.invoice_id
where b.paid_pence <> coalesce(s.old_amount_paid, 0) or i.status is distinct from s.old_status;
revoke all on public.ledger_backfill_diff from anon, authenticated;

select public.ledger_backfill_legacy();

-- Freeze the old tables: read-only for everyone (trigger), writes revoked from browser roles.
create or replace function public.trg_legacy_payments_frozen()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('mason.allow_legacy_payment_write', true) = 'on' then
    return coalesce(new, old);
  end if;
  raise exception '% is frozen: payments now live in public.payments (ledger)', tg_table_name using errcode = '42501';
end $$;
drop trigger if exists trg_order_payments_frozen on public.order_payments;
create trigger trg_order_payments_frozen before insert or update or delete on public.order_payments
  for each row execute function public.trg_legacy_payments_frozen();
drop trigger if exists trg_invoice_payments_frozen on public.invoice_payments;
create trigger trg_invoice_payments_frozen before insert or update or delete on public.invoice_payments
  for each row execute function public.trg_legacy_payments_frozen();
revoke insert, update, delete, truncate on public.order_payments, public.invoice_payments from anon, authenticated;
-- The old "sum matched order_payments into orders" trigger (repo migration 20260403) if present:
drop trigger if exists trg_order_payments_update_amount on public.order_payments;
comment on table public.order_payments is 'FROZEN 2026-10: read-only history; see public.payments.';
comment on table public.invoice_payments is 'FROZEN 2026-10: read-only history; see public.payments.';

-- is_customer: a person is a customer when the ledger shows money allocated to their invoice.
create or replace function public.trg_allocations_recompute_customer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.recompute_person_is_customer((select person_id from public.invoices where id = coalesce(new.invoice_id, old.invoice_id)));
  return null;
exception when undefined_function then return null;
end $$;
drop trigger if exists trg_allocations_recompute_customer on public.payment_allocations;
create trigger trg_allocations_recompute_customer after insert or delete on public.payment_allocations
  for each row execute function public.trg_allocations_recompute_customer();
