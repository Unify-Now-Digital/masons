-- Add region / postcode / council columns to public.cemeteries so masons
-- can record the administrative location of each burial ground.
--
-- Best-effort backfill: extract a UK-shaped postcode from the existing
-- address column. The pattern matches the canonical UK format
--   <area><district> <sector><unit>
-- e.g. "M21 7GL", "BS4 3EW", "CF24 4PY". Only the postcode is
-- backfilled — region and council require knowledge the database
-- doesn't have, so they're left null for the user to fill in.

alter table public.cemeteries add column if not exists region text;
alter table public.cemeteries add column if not exists postcode text;
alter table public.cemeteries add column if not exists council text;

update public.cemeteries
set postcode = upper(trim(matches[1]))
from (
  select id,
         regexp_match(address,
           '([A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2})'
         ) as matches
  from public.cemeteries
  where address is not null
) m
where m.matches is not null
  and public.cemeteries.id = m.id
  and public.cemeteries.postcode is null;
