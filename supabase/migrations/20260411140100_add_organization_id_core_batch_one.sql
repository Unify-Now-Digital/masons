-- Nullable organization_id on core operational tables (batch one)

alter table public.orders
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.invoices
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.jobs
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.workers
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.worker_availability
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.job_workers
  add column if not exists organization_id uuid references public.organizations (id);

create index if not exists idx_orders_organization_id on public.orders (organization_id);
create index if not exists idx_invoices_organization_id on public.invoices (organization_id);
create index if not exists idx_jobs_organization_id on public.jobs (organization_id);
create index if not exists idx_workers_organization_id on public.workers (organization_id);
create index if not exists idx_worker_availability_organization_id on public.worker_availability (organization_id);
create index if not exists idx_job_workers_organization_id on public.job_workers (organization_id);
