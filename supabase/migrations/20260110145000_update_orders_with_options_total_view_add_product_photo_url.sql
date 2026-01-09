-- Update orders_with_options_total view to include product_photo_url column
-- Drop and recreate to ensure all columns from orders table are included, including product_photo_url

drop view if exists public.orders_with_options_total;

create view public.orders_with_options_total as
select
  o.*,
  coalesce(sum(ao.cost), 0)::numeric as additional_options_total
from public.orders o
left join public.order_additional_options ao
  on ao.order_id = o.id
group by o.id;

comment on view public.orders_with_options_total is
  'View of orders with pre-calculated additional_options_total to avoid N+1 queries. Includes all order columns including product_photo_url and renovation fields.';

