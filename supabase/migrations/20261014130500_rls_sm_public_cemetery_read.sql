-- RLS hardening 6/6 (OPTIONAL, separate so it can be skipped): public cemetery read for the
-- Sears Melvin website. Today anon has no cemeteries policy in prod, so the SM site's
-- permit checker, memorial quote form and contact form cemetery pickers get [] (see
-- SearsMelvin/migrations/2026-08-26-fix-public-cemetery-read-and-audit-log.sql, never applied).
-- Scoped to Sears Melvin's own active, non-test rows; other tenants stay private.
drop policy if exists cemeteries_sm_public_read on public.cemeteries;
create policy cemeteries_sm_public_read on public.cemeteries for select to anon
  using (is_active and coalesce(is_test, false) = false
         and organization_id = '3770972d-1bbd-417b-b413-297e844db285'::uuid);
