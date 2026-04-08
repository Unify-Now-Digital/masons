-- Optional link from an order back to its source quote (when created from quoting flow).
alter table public.orders
  add column if not exists quote_id uuid null;

comment on column public.orders.quote_id is 'Source quote when the order was created from a quote; null otherwise.';

-- Recreate aggregate view so new column is exposed (view uses select o.* … group by o.id).
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
  'View of orders with pre-calculated additional_options_total. Includes all order columns (e.g. person_id, quote_id, product_photo_url, renovation fields, order_number).';
