-- ghl_connections: one GoHighLevel location binding per organization (Phase 1 GHL Inbox)
-- Pilot seed row is applied separately via Dashboard SQL (see specs/009-ghl-inbox-readonly/quickstart.md)

create table if not exists public.ghl_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ghl_location_id text not null,
  status text not null default 'disconnected'
    check (status in ('active', 'disconnected', 'error')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ghl_connections_organization_id_unique unique (organization_id)
);

comment on table public.ghl_connections is
  'Maps a Mason organization to one GHL sub-account location. No GHL message data stored here.';

create index if not exists ghl_connections_ghl_location_id_idx
  on public.ghl_connections (ghl_location_id);

alter table public.ghl_connections enable row level security;

-- members: read connection metadata for their org
create policy ghl_connections_select_member
  on public.ghl_connections
  for select
  to authenticated
  using (public.user_is_member_of_org (organization_id));

-- admins: insert connection row (pilot / future connect flow)
create policy ghl_connections_insert_admin
  on public.ghl_connections
  for insert
  to authenticated
  with check (public.user_is_admin_of_org (organization_id));

-- admins: update status / verification (disconnect, etc.)
create policy ghl_connections_update_admin
  on public.ghl_connections
  for update
  to authenticated
  using (public.user_is_admin_of_org (organization_id))
  with check (public.user_is_admin_of_org (organization_id));

-- admins: delete connection row
create policy ghl_connections_delete_admin
  on public.ghl_connections
  for delete
  to authenticated
  using (public.user_is_admin_of_org (organization_id));

-- keep updated_at current on admin-driven updates
create or replace function public.set_ghl_connections_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ghl_connections_set_updated_at on public.ghl_connections;

create trigger ghl_connections_set_updated_at
  before update on public.ghl_connections
  for each row
  execute function public.set_ghl_connections_updated_at();

-- realtime: webhook pulses updated_at → browser invalidates React Query
-- if this fails on apply (table already in publication), run manually in Dashboard:
--   alter publication supabase_realtime add table public.ghl_connections;
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ghl_connections'
  ) then
    alter publication supabase_realtime add table public.ghl_connections;
  end if;
exception
  when duplicate_object then
    null;
end;
$$;
