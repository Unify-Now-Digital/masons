-- Backfill any cemeteries that still have NULL organization_id so they show
-- up in the front-end Cemeteries page (which scopes by organization).
-- Falls back to the Churchill default org used by the original backfill.

do $$
declare
  v_org uuid;
begin
  select id into v_org
  from public.organizations
  where name = 'Churchill'
  limit 1;

  if v_org is null then
    insert into public.organizations (name)
    values ('Churchill')
    returning id into v_org;
  end if;

  update public.cemeteries
  set organization_id = v_org
  where organization_id is null;
end $$;
