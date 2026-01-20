-- Add order_number column to orders table for human-friendly order IDs (ORD-000123 format)
-- New orders will automatically get a unique order_number via sequence
-- Existing orders remain null and will display UUID fallback in UI

-- Create sequence for auto-incrementing order numbers
create sequence if not exists public.orders_order_number_seq;

-- Add nullable order_number column to orders table
alter table public.orders 
  add column if not exists order_number bigint null;

-- Set default for new inserts (existing rows remain null)
alter table public.orders 
  alter column order_number set default nextval('public.orders_order_number_seq');

-- Add unique index on order_number (partial index, only for non-null values)
create unique index if not exists orders_order_number_uidx 
  on public.orders(order_number) 
  where order_number is not null;

-- Add column comment explaining purpose
comment on column public.orders.order_number is 'Human-friendly numeric order identifier (ORD-xxxxxx format). Auto-assigned for new orders via sequence. Existing orders remain null and display UUID fallback.';
