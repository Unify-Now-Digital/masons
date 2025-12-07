-- Create jobs table for Phase 1 (installations/map view)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  customer_name text not null,
  location_name text not null,
  address text not null,
  latitude decimal(10,8),
  longitude decimal(11,8),
  status text default 'scheduled' check (status in ('scheduled', 'in_progress', 'ready_for_installation', 'completed', 'cancelled')),
  scheduled_date date,
  estimated_duration text,
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.jobs enable row level security;

-- Create policies
create policy "Allow all access to jobs" on public.jobs
  for all using (true) with check (true);

-- Create updated_at trigger
create trigger update_jobs_updated_at
  before update on public.jobs
  for each row execute function public.update_updated_at_column();

