-- ============================================================================
-- Permit Tracker: Add columns to orders, create cemeteries & order_comments
-- ============================================================================

-- 1. Add permit tracking timestamp columns to orders
alter table public.orders add column if not exists permit_form_sent_at timestamptz;
alter table public.orders add column if not exists permit_submitted_at timestamptz;
alter table public.orders add column if not exists permit_approved_at timestamptz;

-- 2. Add email thread locking columns to orders
alter table public.orders add column if not exists permit_correspondence_email text;
alter table public.orders add column if not exists permit_cemetery_email text;
alter table public.orders add column if not exists permit_gmail_thread_id text;

-- 3. Update permit_status check constraint to include 'not_started'
alter table public.orders drop constraint if exists orders_permit_status_check;
alter table public.orders add constraint orders_permit_status_check
  check (permit_status in ('not_started', 'form_sent', 'customer_completed', 'pending', 'approved'));

-- 4. Create cemeteries table
create table if not exists public.cemeteries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_email text,
  phone text,
  address text,
  avg_approval_days int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cemeteries enable row level security;

create policy "Allow all access to cemeteries"
  on public.cemeteries
  for all using (true) with check (true);

create trigger update_cemeteries_updated_at
  before update on public.cemeteries
  for each row execute function public.update_updated_at_column();

-- 5. Add cemetery_id FK to orders
alter table public.orders add column if not exists cemetery_id uuid references public.cemeteries(id);

-- 6. Create order_comments table
create table if not exists public.order_comments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  author text not null,
  body text not null,
  comment_type text not null default 'note' check (comment_type in ('note', 'system', 'chase_sent')),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_comments_order_id on public.order_comments (order_id);
create index if not exists idx_order_comments_created on public.order_comments (created_at desc);

alter table public.order_comments enable row level security;

create policy "Allow all access to order_comments"
  on public.order_comments
  for all using (true) with check (true);
