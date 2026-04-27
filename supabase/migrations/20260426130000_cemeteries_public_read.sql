-- Allow any authenticated user to read every cemetery row, regardless of
-- which organisation owns it. Cemeteries are shared reference data — the
-- previous tenant-isolation policy from
-- 20260411140600_org_rls_policies_tenant_isolation.sql made cross-org
-- cemeteries invisible on the front end.
--
-- INSERT / UPDATE / DELETE remain locked to the row's organisation via the
-- existing cemeteries_org_insert / cemeteries_org_update /
-- cemeteries_org_delete policies, so write paths stay tenant-isolated.

drop policy if exists "cemeteries_public_read" on public.cemeteries;

create policy "cemeteries_public_read"
  on public.cemeteries
  for select
  to authenticated
  using (true);
