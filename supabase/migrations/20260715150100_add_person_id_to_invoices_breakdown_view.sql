-- Adds person_id to the invoices_with_breakdown view (explicit column list, so it
-- must be added here or the sidebar can't read it). person_id appended last because
-- create-or-replace can only append columns, not reorder. Preserves security_invoker.
-- Applied to prod via Dashboard SQL editor on 2026-07-15; recorded here for parity.

create or replace view public.invoices_with_breakdown
with (security_invoker = true) as
 SELECT i.id,
    i.order_id,
    i.invoice_number,
    i.customer_name,
    i.amount,
    i.status,
    i.due_date,
    i.issue_date,
    i.payment_method,
    i.payment_date,
    i.notes,
    i.created_at,
    i.updated_at,
    i.stripe_checkout_session_id,
    i.stripe_payment_intent_id,
    i.stripe_status,
    i.paid_at,
    i.stripe_invoice_id,
    i.stripe_invoice_status,
    i.user_id,
    i.hosted_invoice_url,
    i.amount_paid,
    i.amount_remaining,
    i.revised_from_invoice_id,
    i.locked_at,
    i.deleted_at,
    i.organization_id,
    i.is_test,
    COALESCE(o.value, 0::numeric) AS main_product_total,
    COALESCE(opt.additional_options_total, 0::numeric) AS additional_options_total,
    COALESCE(o.permit_cost, 0::numeric) AS permit_total_cost,
    i.intended_deposit_pence,
    i.person_id
   FROM invoices i
     LEFT JOIN orders o ON o.id = i.order_id
     LEFT JOIN ( SELECT order_additional_options.order_id,
            sum(order_additional_options.cost) AS additional_options_total
           FROM order_additional_options
          GROUP BY order_additional_options.order_id) opt ON opt.order_id = i.order_id;