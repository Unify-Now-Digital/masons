-- Create order_additional_options table
create table if not exists public.order_additional_options (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  name text not null,
  description text null,
  cost numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create index on order_id for efficient queries
create index if not exists idx_order_additional_options_order_id 
  on public.order_additional_options(order_id);

-- Enable RLS
alter table public.order_additional_options enable row level security;

-- Create policy (consistent with orders table pattern)
create policy "Allow all access to order_additional_options" 
  on public.order_additional_options
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_order_additional_options_updated_at
  before update on public.order_additional_options
  for each row
  execute function public.update_updated_at_column();

-- Create view for orders with pre-calculated additional_options_total
-- This view prevents N+1 queries by aggregating options in a single query
create or replace view public.orders_with_options_total as
select
  o.*,
  coalesce(ao.additional_options_total, 0) as additional_options_total
from public.orders o
left join (
  select order_id, sum(cost) as additional_options_total
  from public.order_additional_options
  group by order_id
) ao on ao.order_id = o.id;

-- Add comment to view
comment on view public.orders_with_options_total is 
  'View of orders with pre-calculated additional_options_total to avoid N+1 queries.';

