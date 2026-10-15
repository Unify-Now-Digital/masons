-- NOT APPLIED. Needs Arin's OK. Requires public.user_can_view_org_finance(uuid) (on prod since 14 Oct via
-- rls_finance_helper, version 20261014155723..; PR #37's 20261014130050). Apply BEFORE deploying the
-- app build whose Record payment dialog calls this function (until then the dialog shows an error).
--
-- Record payment (Finance · Record payment / order side panel) in ONE server-side step:
--   1. insert a manual, matched order_payments row (revolut / bank / cash), and
--   2. set orders.deposit_date / second_payment_date if still empty,
-- only for finance roles (public.user_can_view_org_finance: admin + member; staff excluded).
-- Replaces the browser doing both writes directly. Supersedes 20261014200000_order_payments_finance_insert
-- (an INSERT policy, never applied): don't apply that one; the browser no longer inserts into order_payments.

do $$ begin
  if to_regprocedure('public.user_can_view_org_finance(uuid)') is null then
    raise exception 'public.user_can_view_org_finance(uuid) is missing: apply the RLS finance helper first';
  end if;
end $$;

create or replace function public.record_manual_payment(
  p_order_id uuid,
  p_amount numeric,
  p_received_at date,
  p_source text,
  p_payment_type text,
  p_reference text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select o.organization_id into v_org from public.orders o where o.id = p_order_id;
  if v_org is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if not public.user_can_view_org_finance(v_org) then
    raise exception 'Only finance roles (admin or member) can record payments' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be more than £0' using errcode = '22023';
  end if;
  if p_source not in ('revolut', 'bank', 'cash') then
    raise exception 'Unknown payment source %', p_source using errcode = '22023';
  end if;
  if p_payment_type not in ('deposit', 'final') then
    raise exception 'Unknown payment type %', p_payment_type using errcode = '22023';
  end if;
  if p_received_at is null or p_received_at > (current_date + 1) then
    raise exception 'Received date is missing or in the future' using errcode = '22023';
  end if;

  insert into public.order_payments (
    organization_id, order_id, user_id, source, external_id, amount, currency, payment_type,
    reference, match_reason, matched_at, matched_by, status, received_at
  ) values (
    v_org, p_order_id, v_uid, p_source, 'manual:' || gen_random_uuid()::text, round(p_amount, 2), 'GBP',
    p_payment_type, nullif(btrim(coalesce(p_reference, '')), ''), 'manual entry (Finance · Record payment)',
    now(), coalesce((select auth.jwt() ->> 'email'), v_uid::text), 'matched',
    (p_received_at::timestamp + time '12:00') at time zone 'Europe/London'
  )
  returning id into v_id;

  -- Back-compat until deposit_date / second_payment_date are retired: only fill an empty date.
  if p_payment_type = 'deposit' then
    update public.orders set deposit_date = p_received_at where id = p_order_id and deposit_date is null;
  else
    update public.orders set second_payment_date = p_received_at where id = p_order_id and second_payment_date is null;
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_manual_payment(uuid, numeric, date, text, text, text) from public, anon;
grant execute on function public.record_manual_payment(uuid, numeric, date, text, text, text) to authenticated;

-- Rollback:
-- drop function if exists public.record_manual_payment(uuid, numeric, date, text, text, text);
