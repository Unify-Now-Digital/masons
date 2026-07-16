-- orders_with_options_total is an explicit-column-list view; it did not inherit the new
-- orders.custom_product_name column, breaking all three Stripe edge functions (42703).
-- Recreated with the column APPENDED (CREATE OR REPLACE VIEW can only add at the end).
-- NOTE: CREATE OR REPLACE VIEW resets reloptions — security_invoker was silently dropped
-- and had to be re-set. Applied via Dashboard SQL editor 2026-07-16.
--
-- Evidence (select relname, reloptions from pg_class where relname = 'orders_with_options_total'):
--   after CREATE OR REPLACE VIEW: reloptions = null           (confirms the silent reset)
--   after ALTER VIEW ... SET:     reloptions = ["security_invoker=on"]

create or replace view orders_with_options_total as
 SELECT o.id,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.order_type,
    o.sku,
    o.material,
    o.color,
    o.stone_status,
    o.permit_status,
    o.proof_status,
    o.deposit_date,
    o.second_payment_date,
    o.due_date,
    o.installation_date,
    o.location,
    o.value,
    o.progress,
    o.assigned_to,
    o.priority,
    o.timeline_weeks,
    o.notes,
    o.created_at,
    o.updated_at,
    o.invoice_id,
    o.latitude,
    o.longitude,
    o.permit_cost,
    o.renovation_service_description,
    o.renovation_service_cost,
    o.geocode_status,
    o.geocode_error,
    o.geocoded_at,
    o.geocode_place_id,
    o.order_number,
    o.person_id,
    o.person_name,
    o.product_photo_url,
    o.permit_form_id,
    o.partner_id,
    o.edit_token,
    o.product_config,
    o.status,
    o.quote_id,
    o.tracking_token,
    o.inscription_text,
    o.inscription_status,
    o.proof_url,
    o.proof_uploaded_at,
    o.proof_notes,
    o.estimated_completion,
    o.permit_transferred_at,
    o.permit_fee,
    o.inscription_font,
    o.inscription_font_other,
    o.inscription_layout,
    o.inscription_additional,
    o.product_id,
    o.organization_id,
    COALESCE(sum(ao.cost), 0::numeric) AS additional_options_total,
    o.custom_product_name
   FROM orders o
     LEFT JOIN order_additional_options ao ON ao.order_id = o.id
  GROUP BY o.id;

alter view orders_with_options_total set (security_invoker = on);
