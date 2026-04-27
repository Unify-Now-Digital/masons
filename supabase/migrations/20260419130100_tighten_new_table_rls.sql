-- ============================================================
-- Migration: tighten_new_table_rls
-- Purpose: close a soft RLS policy on order_proof_versions and
--          order_proof_ai_checks. The original policies allowed
--          `organization_id is null` to match, which meant any
--          row inserted without an org_id would be readable by
--          every authenticated user. Now that both tables are
--          established (and currently empty post-migration), we
--          can tighten the policies to strict org membership.
--
--          Also enforce NOT NULL on organization_id so future
--          inserts must populate it. The column was nullable to
--          allow the original `is null or` escape; it's not
--          needed anymore.
--
--          Safe to re-run. No data rewrite required while the
--          tables are empty.
-- ============================================================

-- 1. order_proof_versions
drop policy if exists "Allow read access to order_proof_versions in same org"
  on public.order_proof_versions;
drop policy if exists "Allow write access to order_proof_versions in same org"
  on public.order_proof_versions;

alter table public.order_proof_versions
  alter column organization_id set not null;

create policy "Allow read access to order_proof_versions in same org"
  on public.order_proof_versions
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

create policy "Allow write access to order_proof_versions in same org"
  on public.order_proof_versions
  for all
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  )
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

-- 2. order_proof_ai_checks
drop policy if exists "Allow read access to order_proof_ai_checks in same org"
  on public.order_proof_ai_checks;
drop policy if exists "Allow write access to order_proof_ai_checks in same org"
  on public.order_proof_ai_checks;

alter table public.order_proof_ai_checks
  alter column organization_id set not null;

create policy "Allow read access to order_proof_ai_checks in same org"
  on public.order_proof_ai_checks
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

create policy "Allow write access to order_proof_ai_checks in same org"
  on public.order_proof_ai_checks
  for all
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  )
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );
