-- Create inbox_muted_senders: per-org list of muted inbox senders, keyed by
-- normalized handle. Tenant-isolation RLS follows the canonical member-level
-- <table>_org_<op> pattern from 20260411140600_org_rls_policies_tenant_isolation.sql.

create table public.inbox_muted_senders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  normalized_handle text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, normalized_handle)
);

comment on table public.inbox_muted_senders is
  'Muted inbox senders per org. normalized_handle is a lowercase-trimmed email or last-10-digit phone, pinned in lockstep with src/modules/inbox/utils/conversationGroupKey.ts.';

alter table public.inbox_muted_senders enable row level security;

drop policy if exists inbox_muted_senders_org_select on public.inbox_muted_senders;
drop policy if exists inbox_muted_senders_org_insert on public.inbox_muted_senders;
drop policy if exists inbox_muted_senders_org_update on public.inbox_muted_senders;
drop policy if exists inbox_muted_senders_org_delete on public.inbox_muted_senders;

create policy inbox_muted_senders_org_select on public.inbox_muted_senders
  for select to authenticated
  using (public.user_is_member_of_org(organization_id));

create policy inbox_muted_senders_org_insert on public.inbox_muted_senders
  for insert to authenticated
  with check (public.user_is_member_of_org(organization_id));

create policy inbox_muted_senders_org_update on public.inbox_muted_senders
  for update to authenticated
  using (public.user_is_member_of_org(organization_id))
  with check (public.user_is_member_of_org(organization_id));

create policy inbox_muted_senders_org_delete on public.inbox_muted_senders
  for delete to authenticated
  using (public.user_is_member_of_org(organization_id));
