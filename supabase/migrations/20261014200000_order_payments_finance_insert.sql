-- NOT APPLIED. Needs Arin's approval.
-- Finance · Record payment (feat/mason-today-finance) inserts a manual Revolut / bank / cash
-- payment into order_payments from the browser. Today only edge functions (service role) can
-- insert, because order_payments has SELECT + UPDATE policies but no INSERT policy, so the
-- client insert is refused by RLS.
-- Same gate as the existing SELECT/UPDATE policies (admin/member of that org). Manual rows only:
-- they must be 'matched', linked to an order in the same org, and carry a manual: external_id,
-- so a browser can never forge a Stripe/Revolut-webhook row.

create policy order_payments_finance_insert_manual
  on public.order_payments
  for insert
  to authenticated
  with check (
    organization_id is not null
    and (select public.user_can_view_org_finance(organization_id))
    and status = 'matched'
    and external_id like 'manual:%'
    and source in ('revolut', 'bank', 'cash')
    and amount > 0
    and order_id is not null
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.organization_id = order_payments.organization_id
    )
  );

-- Rollback:
-- drop policy if exists order_payments_finance_insert_manual on public.order_payments;
