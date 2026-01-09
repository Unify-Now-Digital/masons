-- Add geocode metadata fields to orders table (all nullable for backward compatibility)
-- These fields track the status and results of geocoding order addresses

alter table public.orders
  add column if not exists geocode_status text null,
  add column if not exists geocode_error text null,
  add column if not exists geocoded_at timestamptz null,
  add column if not exists geocode_place_id text null;

-- Add column comments for documentation
comment on column public.orders.geocode_status is 'Status of last geocoding attempt: idle (never attempted), ok (success), failed (error occurred)';
comment on column public.orders.geocode_error is 'Error message if geocoding failed, for debugging';
comment on column public.orders.geocoded_at is 'Timestamp of last successful geocoding';
comment on column public.orders.geocode_place_id is 'Optional place ID from geocoding provider (Google Places API, etc.)';

