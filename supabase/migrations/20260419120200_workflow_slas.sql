-- ============================================================
-- Migration: workflow_slas
-- Purpose: per-organization, per-workflow, per-stage SLA thresholds
--          (target / warn / max days in stage). Feeds the dwell-time
--          bars in Proof Review, Permit Chase and Install Planner.
-- ============================================================

create table if not exists public.workflow_slas (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow text not null check (workflow in ('proof', 'permit', 'install')),
  stage text not null,
  target_days int not null check (target_days >= 0),
  warn_days int not null check (warn_days >= target_days),
  max_days int not null check (max_days >= warn_days),
  updated_at timestamptz not null default now(),
  primary key (organization_id, workflow, stage)
);

alter table public.workflow_slas enable row level security;

create policy "Allow read access to workflow_slas in same org"
  on public.workflow_slas
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = (select auth.uid())
    )
  );

create policy "Allow write access to workflow_slas in same org"
  on public.workflow_slas
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

-- Keep updated_at fresh
create trigger update_workflow_slas_updated_at
  before update on public.workflow_slas
  for each row execute function public.update_updated_at_column();

-- Seed the design's recommended defaults for every existing org.
-- Re-running is safe (primary-key conflict → skip).
insert into public.workflow_slas (organization_id, workflow, stage, target_days, warn_days, max_days)
select o.id, w.workflow, w.stage, w.target, w.warn, w.max
from public.organizations o
cross join (values
  ('proof',  'first_proof',    3,  5,  7),
  ('proof',  'revision',       1,  2,  3),
  ('permit', 'form_needed',    2,  3,  5),
  ('permit', 'with_customer',  7, 10, 14),
  ('permit', 'completing',     2,  3,  5),
  ('permit', 'submitted',     21, 25, 28),
  ('install','awaiting_slot',  7, 14, 21)
) as w(workflow, stage, target, warn, max)
on conflict (organization_id, workflow, stage) do nothing;
