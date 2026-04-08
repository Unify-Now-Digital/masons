-- Add deceased_name to quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS deceased_name text NULL;

COMMENT ON COLUMN public.quotes.deceased_name IS 'Deceased / memorial name; maps to orders.customer_name when converting quote to order.';

-- Add product_id to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_id uuid NULL
  REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_product_id ON public.orders (product_id);

COMMENT ON COLUMN public.orders.product_id IS 'Optional FK to products row; grave/plot reference stays in orders.sku.';

-- Drop views with CASCADE to handle dependencies
DROP VIEW IF EXISTS public.invoices_with_breakdown CASCADE;
DROP VIEW IF EXISTS public.orders_with_options_total CASCADE;

-- Recreate orders_with_options_total
CREATE VIEW public.orders_with_options_total AS
SELECT
  o.*,
  COALESCE(SUM(ao.cost), 0)::numeric AS additional_options_total
FROM public.orders o
LEFT JOIN public.order_additional_options ao
  ON ao.order_id = o.id
GROUP BY o.id;

-- Recreate invoices_with_breakdown
CREATE VIEW public.invoices_with_breakdown AS
SELECT
  i.*,
  b.main_product_total,
  b.permit_total_cost,
  b.additional_options_total
FROM public.invoices i
LEFT JOIN LATERAL (
  SELECT
    SUM(
      CASE
        WHEN owt.order_type = 'Renovation' THEN COALESCE(owt.renovation_service_cost, 0)
        ELSE COALESCE(owt.value, 0)
      END
    )::numeric AS main_product_total,
    SUM(COALESCE(owt.permit_cost, 0))::numeric AS permit_total_cost,
    SUM(COALESCE(owt.additional_options_total, 0))::numeric AS additional_options_total
  FROM public.orders_with_options_total owt
  WHERE owt.invoice_id = i.id
) b ON true;