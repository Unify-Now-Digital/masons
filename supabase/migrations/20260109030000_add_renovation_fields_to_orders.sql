-- Add renovation_service_description column to orders table
alter table public.orders
  add column renovation_service_description text null;

-- Add renovation_service_cost column to orders table
alter table public.orders
  add column renovation_service_cost numeric(10,2) not null default 0;

-- Add column comments for clarity
comment on column public.orders.renovation_service_description is 
  'Free-text description of the renovation service (e.g., "Headstone cleaning and relettering"). Only used for Renovation order types.';

comment on column public.orders.renovation_service_cost is 
  'Cost of the renovation service in GBP. Only used for Renovation order types. Defaults to 0.';

