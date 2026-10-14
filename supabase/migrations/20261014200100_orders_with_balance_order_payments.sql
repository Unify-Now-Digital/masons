-- NOT APPLIED. Needs Arin's approval.
-- orders_with_balance.amount_paid only summed PAID INVOICES, so every order paid by Revolut or
-- by a Stripe link (order_payments) showed its full value as balance_due (e.g. SM #272: £1,943
-- paid by Revolut, still "£1,943 due"). New definition:
--   amount_paid = Σ order_payments (status 'matched')
--               + Σ paid invoices whose Stripe payment-intent is NOT already an order_payments row
-- (deduped on the payment-intent id, so one payment is never counted twice).
-- Columns, names and order are unchanged (CREATE OR REPLACE requires that); security_invoker kept.

create or replace view public.orders_with_balance
with (security_invoker = true) as
select o.id, o.customer_name, o.customer_email, o.customer_phone, o.order_type, o.sku, o.material, o.color,
  o.stone_status, o.permit_status, o.proof_status, o.deposit_date, o.second_payment_date, o.due_date,
  o.installation_date, o.location, o.value, o.progress, o.assigned_to, o.priority, o.timeline_weeks, o.notes,
  o.created_at, o.updated_at, o.invoice_id, o.latitude, o.longitude, o.permit_cost,
  o.renovation_service_description, o.renovation_service_cost, o.geocode_status, o.geocode_error,
  o.geocoded_at, o.geocode_place_id, o.order_number, o.person_id, o.person_name, o.product_photo_url,
  o.permit_form_id, o.partner_id, o.edit_token, o.product_config, o.status, o.quote_id, o.tracking_token,
  o.inscription_text, o.inscription_status, o.proof_url, o.proof_uploaded_at, o.proof_notes,
  o.estimated_completion, o.permit_transferred_at, o.permit_fee, o.inscription_font, o.inscription_font_other,
  o.inscription_layout, o.inscription_additional, o.product_id, o.organization_id, o.cemetery_id,
  o.admin_notes, o.is_test,
  (coalesce(o.value, 0) + coalesce(o.renovation_service_cost, 0) + coalesce(opt.additional_options_total, 0)) as total_order_value,
  (coalesce(op.paid, 0) + coalesce(pay.amount_paid, 0)) as amount_paid,
  greatest(
    coalesce(o.value, 0) + coalesce(o.renovation_service_cost, 0) + coalesce(opt.additional_options_total, 0)
      - (coalesce(op.paid, 0) + coalesce(pay.amount_paid, 0)),
    0
  ) as balance_due,
  fin.final_invoice_id,
  fin.final_invoice_sent_at
from public.orders o
left join (
  select order_id, sum(cost) as additional_options_total
  from public.order_additional_options group by order_id
) opt on opt.order_id = o.id
left join (
  select order_id, sum(amount) as paid
  from public.order_payments
  where status = 'matched' and order_id is not null
  group by order_id
) op on op.order_id = o.id
left join (
  select i.order_id, sum(i.amount) as amount_paid
  from public.invoices i
  where i.status = 'paid' and i.order_id is not null
    and not exists (
      select 1 from public.order_payments p
      where p.external_id is not null and p.external_id = i.stripe_payment_intent_id
    )
  group by i.order_id
) pay on pay.order_id = o.id
left join lateral (
  select i.id as final_invoice_id, i.issue_date as final_invoice_sent_at
  from public.invoices i
  where i.order_id = o.id
  order by i.issue_date desc nulls last, i.created_at desc
  limit 1
) fin on true;

-- Rollback: re-run the previous definition (pay = Σ paid invoices only), saved in
-- docs/finance/orders_with_balance_before_20261014.sql.
