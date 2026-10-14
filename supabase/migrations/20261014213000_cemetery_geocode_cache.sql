-- PROPOSED, NOT APPLIED. Cache cemetery coordinates so the Logistics map does
-- not geocode the same cemetery client-side in every browser.
-- The map already prefers orders.latitude/longitude, then cemeteries.latitude/longitude,
-- and only then geocodes the cemetery address/postcode (cached in localStorage).
-- Applying this lets a later job (or a "Save location" action) persist those results.
alter table public.cemeteries
  add column if not exists geocode_status text check (geocode_status in ('ok', 'failed', 'manual')),
  add column if not exists geocoded_at timestamptz,
  add column if not exists geocode_place_id text,
  add column if not exists geocode_query text;

comment on column public.cemeteries.geocode_query is
  'Address string that produced latitude/longitude (name, address, postcode).';

-- Backfill candidates: active cemeteries with an address/postcode but no coordinates.
-- select id, name, address, postcode from public.cemeteries
--  where latitude is null and (coalesce(address, '') <> '' or coalesce(postcode, '') <> '');
