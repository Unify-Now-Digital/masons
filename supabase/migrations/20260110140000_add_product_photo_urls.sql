-- Add photo_url to products (memorials) table
alter table public.memorials
  add column if not exists photo_url text null;

comment on column public.memorials.photo_url is 
  'Optional URL to a product photo/image. Used for visual reference in product catalog and order creation.';

-- Add product_photo_url to orders table
alter table public.orders
  add column if not exists product_photo_url text null;

comment on column public.orders.product_photo_url is 
  'Snapshot of the product photo URL at the time of order creation/update. Only used for New Memorial order types. Preserves historical product appearance even if product photo changes.';

-- Note: orders_with_options_total view uses o.* which will automatically include product_photo_url
-- No need to recreate the view unless issues arise
-- The view definition is: select o.*, coalesce(sum(ao.cost), 0)::numeric as additional_options_total
-- Since it uses o.*, new columns are automatically included

