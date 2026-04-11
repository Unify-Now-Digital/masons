-- Multi-org tenancy: registry tables (002-multi-org-tenancy)

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_organization_members_user_id
  on public.organization_members (user_id);

create index if not exists idx_organization_members_organization_id
  on public.organization_members (organization_id);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Members can read their own membership rows
create policy "organization_members_select_own"
  on public.organization_members
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Users can read organization rows they belong to
create policy "organizations_select_member"
  on public.organizations
  for select
  to authenticated
  using (
    id in (
      select organization_id
      from public.organization_members
      where user_id = (select auth.uid())
    )
  );

-- No insert/update/delete for authenticated on these tables in v1 (operator / admin policies added later)
comment on table public.organizations is 'Tenant registry for multi-organization isolation.';
comment on table public.organization_members is 'Links auth users to organizations with a role.';
