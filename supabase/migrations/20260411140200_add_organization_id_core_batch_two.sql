-- Nullable organization_id — CRM, catalogue, order satellites (batch two)

alter table public.customers
  add column if not exists organization_id uuid references public.organizations (id);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'companies'
  ) then
    execute 'alter table public.companies add column if not exists organization_id uuid references public.organizations (id)';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) then
    execute 'alter table public.products add column if not exists organization_id uuid references public.organizations (id)';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'quotes'
  ) then
    execute 'alter table public.quotes add column if not exists organization_id uuid references public.organizations (id)';
  end if;
end $$;

alter table public.inscriptions
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.order_people
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.order_additional_options
  add column if not exists organization_id uuid references public.organizations (id);

create index if not exists idx_customers_organization_id on public.customers (organization_id);
create index if not exists idx_inscriptions_organization_id on public.inscriptions (organization_id);
create index if not exists idx_order_people_organization_id on public.order_people (organization_id);
create index if not exists idx_order_additional_options_organization_id on public.order_additional_options (organization_id);
