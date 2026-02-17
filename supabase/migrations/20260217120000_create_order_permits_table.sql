-- Create order_permits table for AI-powered permit tracking
create table if not exists public.order_permits (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  permit_phase text not null default 'REQUIRED' check (permit_phase in (
    'REQUIRED', 'SEARCHING', 'FORM_FOUND', 'PREFILLED', 'SENT_TO_CLIENT', 'SUBMITTED', 'APPROVED'
  )),
  authority_name text,
  authority_contact text,
  form_url text,
  readiness_score integer not null default 0 check (readiness_score >= 0 and readiness_score <= 100),
  fee_paid boolean not null default false,
  submission_date date,
  prefilled_data jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create unique index if not exists idx_order_permits_order_id on public.order_permits (order_id);
create index if not exists idx_order_permits_phase on public.order_permits (permit_phase);

-- Enable RLS
alter table public.order_permits enable row level security;

-- RLS policies
create policy "Allow all access to order_permits"
  on public.order_permits
  for all using (true) with check (true);

-- updated_at trigger
create trigger update_order_permits_updated_at
  before update on public.order_permits
  for each row execute function public.update_updated_at_column();

-- Create permit_activity_log table for timeline tracking
create table if not exists public.permit_activity_log (
  id uuid primary key default gen_random_uuid(),
  order_permit_id uuid not null references public.order_permits(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'SEARCH_STARTED', 'FORM_FOUND', 'PREFILLED', 'SENT_TO_CLIENT',
    'CLIENT_RETURNED', 'SUBMITTED', 'FOLLOW_UP_SENT', 'APPROVED', 'NOTE'
  )),
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_permit_activity_log_permit on public.permit_activity_log (order_permit_id);
create index if not exists idx_permit_activity_log_created on public.permit_activity_log (created_at desc);

-- Enable RLS
alter table public.permit_activity_log enable row level security;

-- RLS policies
create policy "Allow all access to permit_activity_log"
  on public.permit_activity_log
  for all using (true) with check (true);
