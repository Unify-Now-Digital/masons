-- ============================================================
-- Migration: add_is_test_columns
-- Purpose: tag rows as test data so a single org (Sears Melvin)
--          can seed a demo dataset and clear it cleanly before
--          going live, without ever touching production rows in
--          other organisations.
--
--          Companion migration adds seed/clear RPCs scoped to
--          the Sears Melvin organisation.
-- ============================================================

-- Tables that always exist
alter table public.orders
  add column if not exists is_test boolean not null default false;
alter table public.customers
  add column if not exists is_test boolean not null default false;
alter table public.jobs
  add column if not exists is_test boolean not null default false;
alter table public.cemeteries
  add column if not exists is_test boolean not null default false;
alter table public.invoices
  add column if not exists is_test boolean not null default false;
alter table public.payments
  add column if not exists is_test boolean not null default false;
alter table public.inscriptions
  add column if not exists is_test boolean not null default false;

create index if not exists idx_orders_org_test       on public.orders (organization_id) where is_test;
create index if not exists idx_customers_org_test    on public.customers (organization_id) where is_test;
create index if not exists idx_jobs_org_test         on public.jobs (organization_id) where is_test;
create index if not exists idx_cemeteries_org_test   on public.cemeteries (organization_id) where is_test;
create index if not exists idx_invoices_org_test     on public.invoices (organization_id) where is_test;
create index if not exists idx_payments_org_test     on public.payments (organization_id) where is_test;
create index if not exists idx_inscriptions_org_test on public.inscriptions (organization_id) where is_test;

-- Conditionally-present tables — add only if the table exists in this DB.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='companies') then
    execute 'alter table public.companies add column if not exists is_test boolean not null default false';
    execute 'create index if not exists idx_companies_org_test on public.companies (organization_id) where is_test';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='quotes') then
    execute 'alter table public.quotes add column if not exists is_test boolean not null default false';
    execute 'create index if not exists idx_quotes_org_test on public.quotes (organization_id) where is_test';
  end if;
end $$;

-- Recreate dependent views so `is_test` propagates to consumers that read
-- through them (orders_with_options_total, invoices_with_breakdown). Definitions
-- mirror the latest migration (20260411140900_refresh_orders_views_after_org_id).
drop view if exists public.invoices_with_breakdown cascade;
drop view if exists public.orders_with_options_total cascade;

create view public.orders_with_options_total as
select
  o.*,
  coalesce(sum(ao.cost), 0)::numeric as additional_options_total
from public.orders o
left join public.order_additional_options ao
  on ao.order_id = o.id
group by o.id;

create view public.invoices_with_breakdown as
select
  i.*,
  b.main_product_total,
  b.permit_total_cost,
  b.additional_options_total
from public.invoices i
left join lateral (
  select
    sum(
      case
        when owt.order_type = 'Renovation' then coalesce(owt.renovation_service_cost, 0)
        else coalesce(owt.value, 0)
      end
    )::numeric as main_product_total,
    sum(coalesce(owt.permit_cost, 0))::numeric as permit_total_cost,
    sum(coalesce(owt.additional_options_total, 0))::numeric as additional_options_total
  from public.orders_with_options_total owt
  where owt.invoice_id = i.id
) b on true;
