-- ============================================================
-- Migration: order_proof_versions
-- Purpose: track the v1 → v2 → v3 timeline of each proof plus a
--          pre-flight AI-check log per version, so the Proof Review
--          page can show history and flag issues before a proof is
--          sent to the customer.
-- ============================================================

-- 1. Version history: one row per proof-version event
create table if not exists public.order_proof_versions (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.order_proofs(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  version int not null check (version > 0),
  event text not null check (event in (
    'inscription_received',
    'draft_started',
    'first_proof_sent',
    'revisions_requested',
    'revised_proof_sent',
    'approved',
    'rejected',
    'note'
  )),
  actor text not null,
  note text,
  render_url text,
  days_from_inscription int,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_proof_versions_proof
  on public.order_proof_versions (proof_id, version desc);

create index if not exists idx_order_proof_versions_organization_id
  on public.order_proof_versions (organization_id);

alter table public.order_proof_versions enable row level security;

create policy "Allow read access to order_proof_versions in same org"
  on public.order_proof_versions
  for select
  using (
    organization_id is null
    or organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

create policy "Allow write access to order_proof_versions in same org"
  on public.order_proof_versions
  for all
  using (
    organization_id is null
    or organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  )
  with check (
    organization_id is null
    or organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

-- 2. Pre-flight AI checks per render (pass / info / warn / fail)
create table if not exists public.order_proof_ai_checks (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.order_proofs(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  version int not null check (version > 0),
  level text not null check (level in ('pass', 'info', 'warn', 'fail')),
  label text not null,
  suggest text,
  dismissed_at timestamptz,
  dismissed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_proof_ai_checks_proof
  on public.order_proof_ai_checks (proof_id, version desc);

create index if not exists idx_order_proof_ai_checks_organization_id
  on public.order_proof_ai_checks (organization_id);

alter table public.order_proof_ai_checks enable row level security;

create policy "Allow read access to order_proof_ai_checks in same org"
  on public.order_proof_ai_checks
  for select
  using (
    organization_id is null
    or organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

create policy "Allow write access to order_proof_ai_checks in same org"
  on public.order_proof_ai_checks
  for all
  using (
    organization_id is null
    or organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  )
  with check (
    organization_id is null
    or organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

-- 3. Track when the customer's inscription text was received (drives
--    the "days since inscription received" queue sort in the design)
alter table public.order_proofs
  add column if not exists inscription_received_at timestamptz;
