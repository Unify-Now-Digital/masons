-- Create order_deceased join table for multiple deceased names per order with one primary
-- Purpose: progressive multi-name deceased model mirroring order_people; dual-write primary → orders.customer_name
-- Affected: new table public.order_deceased; backfill from orders where customer_name ≠ person_name (normalized)
-- Notes: equal-name rows are NOT backfilled (treated as deceased missing). No auto “A and B” splits.

create table if not exists public.order_deceased (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  organization_id uuid not null references public.organizations (id),
  full_name text not null,
  date_of_birth date null,
  date_of_death date null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint order_deceased_full_name_nonempty check (length(trim(full_name)) > 0)
);

comment on table public.order_deceased is
  'Deceased / memorial names for an order; exactly one primary per order. Primary full_name dual-writes to orders.customer_name.';

-- At most one primary deceased per order
create unique index if not exists idx_order_deceased_one_primary_per_order
  on public.order_deceased (order_id) where is_primary = true;

create index if not exists idx_order_deceased_order_id on public.order_deceased (order_id);
create index if not exists idx_order_deceased_organization_id on public.order_deceased (organization_id);

alter table public.order_deceased enable row level security;

create policy "order_deceased_select" on public.order_deceased
  for select to anon, authenticated using (true);

create policy "order_deceased_insert" on public.order_deceased
  for insert to anon, authenticated with check (true);

create policy "order_deceased_update" on public.order_deceased
  for update to anon, authenticated using (true) with check (true);

create policy "order_deceased_delete" on public.order_deceased
  for delete to anon, authenticated using (true);

-- Backfill ONLY orders where customer_name is nonempty and differs from person_name (trim + case-insensitive).
-- Leave equal-name rows untouched (deceased missing — staff review). Do not split “A and B”.
insert into public.order_deceased (order_id, organization_id, full_name, is_primary, sort_order)
select
  o.id,
  o.organization_id,
  trim(o.customer_name),
  true,
  0
from public.orders o
where o.organization_id is not null
  and nullif(trim(o.customer_name), '') is not null
  and lower(trim(o.customer_name)) is distinct from lower(trim(coalesce(o.person_name, '')))
  and not exists (
    select 1 from public.order_deceased od where od.order_id = o.id
  );
