-- Jobs pipeline schema (status_v2). Applied manually via Dashboard 01 Aug 2026,
-- statement-by-statement with read-backs. This file is the record, not the applier.
-- Spec: status_v2-implementation-spec.md. Product sign-off: Arin, 30 Jul (WhatsApp).

create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id),
  person_id        uuid references public.people(id),
  conversation_id  uuid references public.inbox_conversations(id),
  enquiry_id       uuid references public.enquiries(id),
  source           text not null check (source in ('website','email','whatsapp','ghl','manual')),
  stage            text not null default 'enquired'
                   check (stage in ('enquired','quoted','invoiced',
                                    'confirmed','in_production','fixed','complete')),
  stage_status     text,
  paid_at          timestamptz,
  exit_reason      text check (exit_reason in ('lost','closed','dormant','on_hold','cancelled')),
  exited_at        timestamptz,
  wake_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint jobs_dormant_needs_wake check (exit_reason is distinct from 'dormant' or wake_at is not null),
  constraint jobs_exit_pairs check ((exit_reason is null) = (exited_at is null))
);
-- read-back: to_regclass('public.jobs') = 'jobs'

alter table public.jobs enable row level security;
-- (enabled via Dashboard "Run and enable RLS" at create time)

create policy jobs_org_select on public.jobs
  for select to authenticated using (user_is_member_of_org(organization_id));
create policy jobs_org_insert on public.jobs
  for insert to authenticated with check (user_is_member_of_org(organization_id));
create policy jobs_org_update on public.jobs
  for update to authenticated
  using (user_is_member_of_org(organization_id))
  with check (user_is_member_of_org(organization_id));
-- No DELETE policy by design: jobs exit (lost/closed/dormant/...), never delete.
-- read-back: pg_policies shows 3 rows, pattern identical to orders_org_*

create index jobs_org_stage_idx  on public.jobs (organization_id, stage)       where exit_reason is null;
create index jobs_org_exited_idx on public.jobs (organization_id, exit_reason) where exit_reason is not null;
-- read-back: pg_indexes = jobs_pkey, jobs_org_stage_idx, jobs_org_exited_idx

create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute function enquiries_set_updated_at();
-- read-back: pg_trigger = trg_jobs_updated_at

alter table public.orders   add column job_id uuid references public.jobs(id);
create index orders_job_idx   on public.orders (job_id)   where job_id is not null;
alter table public.invoices add column job_id uuid references public.jobs(id);
create index invoices_job_idx on public.invoices (job_id) where job_id is not null;
-- read-back: information_schema.columns shows job_id on orders + invoices

-- Amendment 01 Aug 2026 (applied via Dashboard): add 'sms' to source values —
-- Twilio SMS conversations are a real intake channel for Add-to-pipeline.
alter table public.jobs drop constraint jobs_source_check;
alter table public.jobs add constraint jobs_source_check
  check (source in ('website','email','whatsapp','sms','ghl','manual'));
-- read-back: pg_get_constraintdef confirms all six values incl. 'sms'