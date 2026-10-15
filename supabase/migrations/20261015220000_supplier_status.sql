-- NOT APPLIED. Apply by hand in the Dashboard SQL editor, statement by statement.
-- Do not supabase db push. Additive only: new tables, no changes to orders or invoices.
--
-- Ogee (Monday board 895721886) is read once a day by the supplier-sync edge
-- function. Make calls that function. Mason does not schedule it (pg_cron is
-- not installed). High-confidence rows link themselves; weaker rows wait in
-- order_supplier_links until a person confirms or rejects them.
-- A rejected link is kept so the next read does not suggest the same pair.
-- No customer names are written by this file.

-- ---------------------------------------------------------------------------
-- supplier_jobs: one Monday job (several parts can share a job code)
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  board_id text not null,
  board_item_id text not null,
  job_code text,
  customer_reference text,
  batch_code text,
  container_code text,
  status text,
  normalized_status text,
  delivery_sch text,
  delivery_date date,
  delivery_estimate text,
  group_title text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  stale boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.supplier_jobs is
  'One Ogee Monday job for an organisation. delivery_date is set only when DELIVERY SCH parses as a date. delivery_estimate is staff-only text.';

create unique index if not exists supplier_jobs_board_item_uidx
  on public.supplier_jobs (organization_id, board_id, board_item_id);

create index if not exists supplier_jobs_org_idx
  on public.supplier_jobs (organization_id, synced_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'supplier_jobs_normalized_status_check') then
    alter table public.supplier_jobs
      add constraint supplier_jobs_normalized_status_check
      check (normalized_status is null or normalized_status in ('waiting', 'production', 'transit', 'arrived'));
  end if;
end $$;

drop trigger if exists trg_supplier_jobs_updated_at on public.supplier_jobs;
create trigger trg_supplier_jobs_updated_at
  before update on public.supplier_jobs
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- supplier_parts: the stones under a job. The order label uses the most advanced.
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.supplier_jobs (id) on delete cascade,
  board_item_id text not null,
  description text,
  status text,
  normalized_status text,
  qty numeric,
  synced_at timestamptz not null default now()
);

comment on table public.supplier_parts is
  'Parts on an Ogee job. The Orders label shows the most advanced part and a +N hint for the rest.';

create unique index if not exists supplier_parts_board_item_uidx
  on public.supplier_parts (organization_id, board_item_id);

create index if not exists supplier_parts_job_idx
  on public.supplier_parts (job_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'supplier_parts_normalized_status_check') then
    alter table public.supplier_parts
      add constraint supplier_parts_normalized_status_check
      check (normalized_status is null or normalized_status in ('waiting', 'production', 'transit', 'arrived'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- order_supplier_links: auto, confirmed, suggested, or rejected
-- ---------------------------------------------------------------------------
create table if not exists public.order_supplier_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  job_id uuid not null references public.supplier_jobs (id) on delete cascade,
  confidence text not null,
  rule text not null,
  link_status text not null default 'suggested',
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.order_supplier_links is
  'Order ↔ Ogee job. link_status auto/confirmed drives the Orders label. suggested waits. rejected is remembered.';

create unique index if not exists order_supplier_links_order_job_uidx
  on public.order_supplier_links (order_id, job_id);

create index if not exists order_supplier_links_org_order_idx
  on public.order_supplier_links (organization_id, order_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_supplier_links_confidence_check') then
    alter table public.order_supplier_links
      add constraint order_supplier_links_confidence_check
      check (confidence in ('high', 'medium', 'low'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_supplier_links_status_check') then
    alter table public.order_supplier_links
      add constraint order_supplier_links_status_check
      check (link_status in ('auto', 'confirmed', 'suggested', 'rejected'));
  end if;
end $$;

drop trigger if exists trg_order_supplier_links_updated_at on public.order_supplier_links;
create trigger trg_order_supplier_links_updated_at
  before update on public.order_supplier_links
  for each row execute function public.update_updated_at_column();

alter table public.supplier_jobs enable row level security;
alter table public.supplier_parts enable row level security;
alter table public.order_supplier_links enable row level security;

drop policy if exists supplier_jobs_select_member on public.supplier_jobs;
drop policy if exists supplier_jobs_select_anon on public.supplier_jobs;
drop policy if exists supplier_parts_select_member on public.supplier_parts;
drop policy if exists supplier_parts_select_anon on public.supplier_parts;
drop policy if exists order_supplier_links_select_member on public.order_supplier_links;
drop policy if exists order_supplier_links_update_member on public.order_supplier_links;
drop policy if exists order_supplier_links_select_anon on public.order_supplier_links;
drop policy if exists order_supplier_links_update_anon on public.order_supplier_links;

-- Members read the board. Writes are the service role (supplier-sync), except
-- confirming or rejecting a suggested link.
create policy supplier_jobs_select_member
  on public.supplier_jobs
  for select
  to authenticated
  using (public.user_is_member_of_org(organization_id));

create policy supplier_jobs_select_anon
  on public.supplier_jobs
  for select
  to anon
  using (false);

create policy supplier_parts_select_member
  on public.supplier_parts
  for select
  to authenticated
  using (public.user_is_member_of_org(organization_id));

create policy supplier_parts_select_anon
  on public.supplier_parts
  for select
  to anon
  using (false);

create policy order_supplier_links_select_member
  on public.order_supplier_links
  for select
  to authenticated
  using (public.user_is_member_of_org(organization_id));

create policy order_supplier_links_select_anon
  on public.order_supplier_links
  for select
  to anon
  using (false);

create policy order_supplier_links_update_member
  on public.order_supplier_links
  for update
  to authenticated
  using (public.user_is_member_of_org(organization_id))
  with check (public.user_is_member_of_org(organization_id));

create policy order_supplier_links_update_anon
  on public.order_supplier_links
  for update
  to anon
  using (false)
  with check (false);

revoke all on table public.supplier_jobs from anon, authenticated;
revoke all on table public.supplier_parts from anon, authenticated;
revoke all on table public.order_supplier_links from anon, authenticated;

grant select on table public.supplier_jobs to authenticated;
grant select on table public.supplier_parts to authenticated;
grant select on table public.order_supplier_links to authenticated;
grant update (link_status, confirmed_by, confirmed_at, updated_at)
  on table public.order_supplier_links to authenticated;

grant all on table public.supplier_jobs to service_role;
grant all on table public.supplier_parts to service_role;
grant all on table public.order_supplier_links to service_role;
