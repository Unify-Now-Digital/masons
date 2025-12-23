-- Add latitude and longitude columns to orders table
alter table public.orders
  add column latitude numeric(10, 8),
  add column longitude numeric(10, 8);

