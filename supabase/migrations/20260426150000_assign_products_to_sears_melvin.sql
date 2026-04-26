-- Re-assign every row in public.products to the Sears Melvin organisation.
-- The front-end Products page (Memorials route) scopes by the active org,
-- and on staging the catalogue should belong to Sears Melvin so it shows
-- up there. Skips silently if the Sears Melvin org doesn't exist
-- (e.g. on environments where it hasn't been provisioned yet) so the
-- migration stays safe across environments.

do $$
declare
  v_org uuid;
begin
  select id into v_org
  from public.organizations
  where lower(name) = lower('Sears Melvin')
  limit 1;

  if v_org is null then
    raise notice 'Sears Melvin organisation not found — skipping products reassignment';
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'organization_id'
  ) then
    raise notice 'public.products.organization_id missing — skipping reassignment';
    return;
  end if;

  update public.products
  set organization_id = v_org
  where organization_id is distinct from v_org;
end $$;
