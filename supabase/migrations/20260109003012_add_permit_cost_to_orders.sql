-- Add permit_cost column to orders table
alter table public.orders
  add column permit_cost decimal(10,2) not null default 0;

-- Add column comment for clarity
comment on column public.orders.permit_cost is 
  'Cost of cemetery permits in GBP. Manually entered and included in order total.';

